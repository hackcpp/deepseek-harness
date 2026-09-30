import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import type { Agent } from '@deepseek-ai/dsh-agent'
import * as HyperframesTools from '@deepseek-ai/dsh-hyperframes-tools'
import * as EvolinkImage from '@deepseek-ai/dsh-image-generation-evolink'
import * as Persona from '@deepseek-ai/dsh-persona'
import { createScope, type ScopeKey } from '@deepseek-ai/dsh-scope'
import * as QwenSpeech from '@deepseek-ai/dsh-speech-generation-qwen'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import SystemPrompt, { PERSONA_SECTION } from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { afterEach, describe, expect, it } from 'vitest'
import { SHIPPED_PRESET_ROOT } from '@deepseek-ai/dsh-agent-presets'

class CompositionSubprocess extends SubprocessRuntime {
  override resolveExecutable(command: string): Promise<string> { return Promise.resolve(command) }
  override spawn(_spec: SubprocessSpawnSpec): SubprocessHandle { throw new Error('组合测试不会执行媒体工具') }
  override spawnTerminal(): Promise<never> { throw new Error('组合测试不会创建终端') }
}

const Noop = (): void => {}

let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
})

describe('video production preset composition', () => {
  it('loads the shipped composition over Host media tools with a scoped persona', async () => {
    const ctx = new Context()
    context = ctx
    await ctx.plugin(Loader)
    await ctx.plugin(SystemPrompt, { persona: 'deployment persona' })
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(CompositionSubprocess)
    await ctx.plugin(QwenSpeech, { enabled: true })
    await ctx.plugin(EvolinkImage, { enabled: true })
    await ctx.plugin(HyperframesTools, { enabled: true })

    const modules = new Map<string, unknown>([['@deepseek-ai/dsh-persona', Persona]])
    ctx.loader.internal = {
      version: 'v2',
      async import(specifier: string) { return modules.get(specifier) ?? Noop },
    } as unknown as NonNullable<typeof ctx.loader.internal>

    const key: ScopeKey = { preset: 'video-test' }
    const scope = createScope(ctx, key)
    const path = join(SHIPPED_PRESET_ROOT, 'video', 'agent.cordis.yml')
    await scope.ctx.plugin(Include, { path: pathToFileURL(path).href })

    const agent = key as Agent
    const names = ctx.tools.schemas(agent).map(schema => schema.name)
    expect(names.filter(name => name === 'generate_speech')).toHaveLength(1)
    expect(names.filter(name => name === 'generate_image')).toHaveLength(1)
    expect(names.filter(name => name === 'video_lint')).toHaveLength(1)
    expect(names.filter(name => name === 'video_snapshot')).toHaveLength(1)
    expect(names.filter(name => name === 'video_render')).toHaveLength(1)

    const prompt = await ctx.systemPrompt.assemble({ scope: key })
    const persona = prompt.sections.find(section => section.name === PERSONA_SECTION)?.text
    expect(persona).toContain('视频制作 Agent')
    expect(persona).toContain('每个阶段前都必须获得用户明确确认')
    expect(persona).toContain('除非用户明确要求渲染 MP4')
  })
})
