import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { createLaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as QwenSpeech from '@deepseek-ai/dsh-speech-generation-qwen'

class MemorySettings extends SettingsProvider {
  doc: Record<string, unknown> = {}

  get writable(): boolean { return true }

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve(structuredClone(this.doc))
  }

  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.doc = { ...this.doc, [ns]: structuredClone(section) }
    return Promise.resolve()
  }
}

async function boot(key?: string, enabled?: boolean, config: QwenSpeech.Config = {}) {
  const ctx = new Context()
  ctx.provide('launchEnvironment', createLaunchEnvironmentSnapshot([
    { source: 'process', values: key === undefined ? {} : { DASHSCOPE_API_KEY: key } },
  ]))
  await ctx.plugin(SystemPrompt).await()
  await ctx.plugin(ToolRuntime).await()
  await ctx.plugin(MemorySettings).await()
  const fiber = ctx.plugin(QwenSpeech, enabled === undefined ? config : Object.assign({}, config, { enabled }))
  try {
    await fiber.await()
  } catch (error) {
    await ctx.fiber.dispose()
    throw error
  }
  const call = (voice = 'Cherry') => ctx.tools.execute({
    signal: new AbortController().signal,
    callId: ToolCallId('speech-test'),
    name: 'generate_speech',
    arguments: { text: 'Hello', voice },
  })
  return { ctx, fiber, call }
}

afterEach(() => { vi.restoreAllMocks() })

describe('Qwen speech generation tool', () => {
  it('registers by default', async () => {
    const { ctx } = await boot('test-key')
    expect(ctx.tools.get('generate_speech')).toBeDefined()
    await ctx.fiber.dispose()
  })

  it('registers only while enabled in settings and unregisters on plugin disposal', async () => {
    const { ctx, fiber } = await boot('test-key', false)
    expect(ctx.tools.get('generate_speech')).toBeUndefined()

    await ctx.settings.update(QwenSpeech.SETTINGS_NAMESPACE, { enabled: true })
    expect(ctx.tools.get('generate_speech')).toBeDefined()
    const registered = ctx.tools.get('generate_speech')
    await ctx.settings.update(QwenSpeech.SETTINGS_NAMESPACE, { model: 'qwen3-tts-flash-2025-11-27' })
    expect(ctx.tools.get('generate_speech')).toBe(registered)
    await ctx.settings.update(QwenSpeech.SETTINGS_NAMESPACE, { enabled: false })
    expect(ctx.tools.get('generate_speech')).toBeUndefined()

    await ctx.settings.update(QwenSpeech.SETTINGS_NAMESPACE, { enabled: true })
    await fiber.dispose()
    expect(ctx.tools.get('generate_speech')).toBeUndefined()
    expect(ctx.settings.describe().map(row => String(row.ns))).not.toContain(QwenSpeech.SETTINGS_NAMESPACE)
    await ctx.fiber.dispose()
  })

  it('sends the selected voice and returns the expiring audio URL', async () => {
    const { ctx, call } = await boot('test-key', true)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      output: { audio: { url: 'https://audio.example/speech.wav', expires_at: 2_000_000_000 } },
    }), { status: 200 }))

    const result = await call('Serena')
    expect(result.isError).toBe(false)
    expect(JSON.stringify(result)).toContain('https://audio.example/speech.wav')
    expect(JSON.stringify(result)).toContain('Serena')
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe(QwenSpeech.DEFAULT_ENDPOINT)
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-key' })
    expect(typeof init?.body).toBe('string')
    if (typeof init?.body !== 'string') throw new Error('expected a JSON request body')
    expect(JSON.parse(init.body)).toEqual({
      model: 'qwen3-tts-flash', input: { text: 'Hello', voice: 'Serena' },
    })
    expect(ctx.tools.get('generate_speech')?.presentCall?.({ text: 'Hello', voice: 'Serena' })).toEqual({
      card: 'generic', title: 'Generate speech (Serena)', kind: 'other', rawInput: 'Hello',
    })
    await ctx.fiber.dispose()
  })

  it('uses live custom settings and the credentials service for the next call', async () => {
    const { ctx, call } = await boot('ambient-key', true, {
      apiKeyEnv: 'QWEN_SPEECH_KEY',
      model: 'qwen3-tts-flash-2025-11-27',
      endpoint: 'https://dashscope.example/generate',
      maxTextLength: 12,
      timeoutMs: 5000,
    })
    const resolve = vi.fn().mockResolvedValue({ value: 'service-key', source: 'memory' })
    ctx.provide('credentials', { resolve } as never)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      output: { audio: { url: 'http://audio.example/speech.wav', expires_at: 2_000_000_000 } },
    })))

    const result = await call('Cherry')
    expect(result.isError).toBe(false)
    expect(resolve).toHaveBeenCalledWith('QWEN_SPEECH_KEY')
    expect(fetchSpy).toHaveBeenCalledWith('https://dashscope.example/generate', expect.objectContaining({
      headers: { Authorization: 'Bearer service-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3-tts-flash-2025-11-27', input: { text: 'Hello', voice: 'Cherry' },
      }),
    }))
    const [, init] = fetchSpy.mock.calls[0]!
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    await ctx.fiber.dispose()
  })

  it('fails without a key before making a network request', async () => {
    const { ctx, call } = await boot(undefined, true)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const result = await call()
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result)).toContain('DASHSCOPE_API_KEY')
    expect(fetchSpy).not.toHaveBeenCalled()
    await ctx.fiber.dispose()
  })

  it('reports provider errors and rejects an audio response without a URL', async () => {
    const { ctx, call } = await boot('test-key', true)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('failed', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ output: { audio: { expires_at: 2_000_000_000 } } })))
    const failed = await call()
    expect(failed.isError).toBe(true)
    expect(JSON.stringify(failed)).toContain('HTTP 503')
    const invalid = await call()
    expect(invalid.isError).toBe(true)
    expect(JSON.stringify(invalid)).toContain('invalid audio URL')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    await ctx.fiber.dispose()
  })

  it('rejects invalid direct-apply configuration before reading injected services', () => {
    const cases: Array<[QwenSpeech.Config, RegExp]> = [
      [{ apiKeyEnv: 'not-a-ref' }, /credential ref/],
      [{ model: ' ' }, /model must be non-empty/],
      [{ endpoint: 'http://dashscope.example/generate' }, /endpoint must use HTTPS/],
      [{ maxTextLength: 1.5 }, /maxTextLength must be a positive safe integer/],
      [{ maxTextLength: 0 }, /maxTextLength must be a positive safe integer/],
      [{ timeoutMs: 1.5 }, /timeoutMs must be a positive safe integer/],
      [{ timeoutMs: 0 }, /timeoutMs must be a positive safe integer/],
    ]
    for (const [config, message] of cases) {
      expect(() => { QwenSpeech.apply(new Context(), config) }).toThrow(message)
    }
  })

  it('rejects invalid text, voice, and a call retained after disablement', async () => {
    const { ctx, call } = await boot('test-key', true, { maxTextLength: 5 })
    const definition = ctx.tools.get('generate_speech')
    expect((await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: ToolCallId('speech-empty-text'),
      name: 'generate_speech',
      arguments: { text: ' ', voice: 'Cherry' },
    })).isError).toBe(true)
    expect((await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: ToolCallId('speech-long-text'),
      name: 'generate_speech',
      arguments: { text: '123456', voice: 'Cherry' },
    })).isError).toBe(true)
    expect((await call(' ')).isError).toBe(true)

    await ctx.settings.update(QwenSpeech.SETTINGS_NAMESPACE, { enabled: false })
    await expect(definition?.execute(
      { text: 'Hello', voice: 'Cherry' },
      {
        signal: new AbortController().signal,
        callId: ToolCallId('speech-disabled'),
        name: 'generate_speech',
        arguments: { text: 'Hello', voice: 'Cherry' },
      } as never,
    )).rejects.toThrow(/disabled/)
    await ctx.fiber.dispose()
  })

  it('rejects every malformed provider result field', async () => {
    const { ctx, call } = await boot('test-key', true)
    const responses: unknown[] = [
      null,
      'not an object',
      { output: null },
      { output: 'not an object' },
      { output: { audio: null } },
      { output: { audio: 'not an object' } },
      { output: { audio: { expires_at: 2_000_000_000 } } },
      { output: { audio: { url: 'file:///tmp/speech.wav', expires_at: 2_000_000_000 } } },
      { output: { audio: { url: 'https://audio.example/speech.wav' } } },
      { output: { audio: { url: 'https://audio.example/speech.wav', expires_at: 1.5 } } },
      { output: { audio: { url: 'https://audio.example/speech.wav', expires_at: 0 } } },
    ]
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    for (const body of responses) {
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(body)))
      expect((await call()).isError).toBe(true)
    }
    expect(fetchSpy).toHaveBeenCalledTimes(responses.length)
    await ctx.fiber.dispose()
  })
})
