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
    await writeFile(join(project, 'frame.png'), 'png')
    await writeFile(join(project, 'script.json'), JSON.stringify({
      title: 'Launch',
      status: 'production',
      scenes: [{
        id: 'opening', title: 'Opening', narration: 'Hello', durationSeconds: 2,
        visual: { type: 'image', description: 'A title card', assetPath: 'frame.png' },
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
    const fiber = ctx.plugin({ inject: [...inject], apply }, { projectsRoot: root, scanDepth: 1 })
    await fiber.await()

    const catalogRoute = routes.find(route => route.path === '/api/video.projects')!
    const response = await catalogRoute.fetch(new Request('http://dsh/api/video.projects'))
    const catalog = await response.json() as { root: string; projects: { id: string; scenes: { thumbnailUrl?: string }[] }[] }
    expect(catalog.root).toBe(root)
    expect(catalog.projects).toHaveLength(1)
    expect(catalog.projects[0]?.id).toBe('launch')
    expect(catalog.projects[0]?.scenes[0]?.thumbnailUrl).toContain('project=launch')

    const assetRoute = routes.find(route => route.path === '/api/video.asset')!
    const asset = await assetRoute.fetch(new Request('http://dsh/api/video.asset?project=launch&path=frame.png'))
    expect(asset.status).toBe(200)
    expect(await asset.text()).toBe('png')
    const escaped = await assetRoute.fetch(new Request('http://dsh/api/video.asset?project=..&path=outside'))
    expect(escaped.status).toBe(403)

    await fiber.dispose()
    expect(routes).toHaveLength(0)
  })
})
