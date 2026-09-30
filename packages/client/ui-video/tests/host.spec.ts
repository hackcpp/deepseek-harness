import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { ConnectionFetchRoute, HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import { apply, inject } from '../src/index.ts'

const temporary: string[] = []

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('ui-video Host routes', () => {
  it('discovers script.json projects and confines project assets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-video-'))
    temporary.push(root)
    const project = join(root, 'launch')
    await mkdir(project)
    await mkdir(join(project, 'snapshots'))
    await mkdir(join(project, 'renders'))
    await writeFile(join(project, 'frame.png'), 'png')
    await writeFile(join(project, 'snapshots', 'frame-00-at-1s.png'), 'snapshot')
    await writeFile(join(project, 'renders', 'render.mp4'), '0123456789')
    await writeFile(join(project, 'script.json'), JSON.stringify({
      title: 'Launch',
      status: 'production',
      scenes: [{
        id: 'opening', title: 'Opening', narration: 'Hello', durationSeconds: 2,
        visual: { type: 'html', description: 'A title card', assetPath: null },
      }],
    }))

    const routes: ConnectionFetchRoute[] = []
    const ctx = new Context()
    ctx.provide('connection', {
      fetch: {
        register(route: ConnectionFetchRoute) {
          routes.push(route)
          return async () => { routes.splice(routes.indexOf(route), 1) }
        },
      },
    } as unknown as HostConnectionHandle)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    const catalogRoute = routes.find(route => route.path === '/api/video.projects')!
    const catalogUrl = new URL('http://dsh/api/video.projects')
    catalogUrl.searchParams.append('cwd', project)
    const response = await catalogRoute.fetch(new Request(catalogUrl))
    const catalog = await response.json() as { projects: { id: string; previewUrl?: string; scenes: { thumbnailUrl?: string }[] }[] }
    expect(catalog.projects).toHaveLength(1)
    expect(catalog.projects[0]?.id).toBe(project)
    expect(catalog.projects[0]?.previewUrl).toContain('path=renders%2Frender.mp4')
    expect(catalog.projects[0]?.scenes[0]?.thumbnailUrl).toContain('path=snapshots%2Fframe-00-at-1s.png')

    const assetRoute = routes.find(route => route.path === '/api/video.asset')!
    const assetUrl = new URL('http://dsh/api/video.asset')
    assetUrl.searchParams.set('project', project)
    assetUrl.searchParams.set('path', 'frame.png')
    const asset = await assetRoute.fetch(new Request(assetUrl))
    expect(asset.status).toBe(200)
    expect(await asset.text()).toBe('png')

    assetUrl.searchParams.set('path', 'renders/render.mp4')
    const partial = await assetRoute.fetch(new Request(assetUrl, { headers: { range: 'bytes=2-5' } }))
    expect(partial.status).toBe(206)
    expect(partial.headers.get('accept-ranges')).toBe('bytes')
    expect(partial.headers.get('content-range')).toBe('bytes 2-5/10')
    expect(await partial.text()).toBe('2345')

    const unsatisfied = await assetRoute.fetch(new Request(assetUrl, { headers: { range: 'bytes=20-' } }))
    expect(unsatisfied.status).toBe(416)
    expect(unsatisfied.headers.get('content-range')).toBe('bytes */10')

    assetUrl.searchParams.set('path', '../outside')
    const escaped = await assetRoute.fetch(new Request(assetUrl))
    expect(escaped.status).toBe(403)

    await fiber.dispose()
    expect(routes).toHaveLength(0)
  })
})
