import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as HyperframesTools from '@deepseek-ai/dsh-hyperframes-tools'

class CompositionSubprocess extends SubprocessRuntime {
  override resolveExecutable(command: string): Promise<string> { return Promise.resolve(command) }
  override spawn(_spec: SubprocessSpawnSpec): SubprocessHandle { throw new Error('composition test does not execute tools') }
  override spawnTerminal(): Promise<never> { throw new Error('composition test does not allocate terminals') }
}

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('Hyperframes tools Loader composition', () => {
  it('loads from cordis.yml and exposes the three Agent tools', { timeout: 60_000 }, async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-hyperframes-tools-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@deepseek-ai/dsh-system-prompt'",
      "- name: '@deepseek-ai/dsh-tools'",
      "- name: 'test-subprocess'",
      "- name: '@deepseek-ai/dsh-hyperframes-tools'",
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
      ['@deepseek-ai/dsh-tools', ToolRuntime],
      ['test-subprocess', CompositionSubprocess],
      ['@deepseek-ai/dsh-hyperframes-tools', HyperframesTools],
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
    expect(context.tools.schemas().map(schema => schema.name)).toEqual(expect.arrayContaining([
      'video_lint', 'video_snapshot', 'video_render',
    ]))
  })
})
