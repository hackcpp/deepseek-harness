import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import type { ConnectionFetchRoute, HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import * as VideoUi from '@deepseek-ai/dsh-client-ui-video'

let root: string | undefined
let context: Context | undefined
const routes: ConnectionFetchRoute[] = []

const ConnectionFixture = {
  name: 'test-connection',
  apply(ctx: Context) {
    ctx.provide('connection', {
      fetch: {
        register(route: ConnectionFetchRoute) {
          routes.push(route)
          return async () => { routes.splice(routes.indexOf(route), 1) }
        },
      },
    } as unknown as HostConnectionHandle)
  },
}

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  routes.splice(0)
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('video UI Loader composition', () => {
  it('loads from cordis.yml and serves the project catalog', { timeout: 60_000 }, async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-video-ui-loader-'))
    const project = join(root, 'demo')
    await mkdir(project, { recursive: true })
    await writeFile(join(project, 'script.json'), JSON.stringify({ title: 'Demo', scenes: [] }))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: 'test-connection'",
      "- name: '@deepseek-ai/dsh-client-ui-video'",
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['test-connection', ConnectionFixture],
      ['@deepseek-ai/dsh-client-ui-video', VideoUi],
    ])
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({
      name: 'cordis:include', config: { path: pathToFileURL(configPath).href },
    })
    await context.loader.await()

    expect([...context.loader.entries()].filter(entry => entry.fiber === undefined && !entry.disabled)).toEqual([])
    const catalogRoute = routes.find(route => route.path === '/api/video.projects')
    expect(catalogRoute).toBeDefined()
    const catalogUrl = new URL('http://dsh/api/video.projects')
    catalogUrl.searchParams.append('cwd', project)
    const response = await catalogRoute!.fetch(new Request(catalogUrl))
    const body = await response.json() as { projects: { title: string }[] }
    expect(body.projects).toEqual([expect.objectContaining({ title: 'Demo' })])
  })
})
