import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { createLaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as EvolinkImage from '@deepseek-ai/dsh-image-generation-evolink'

const delay = vi.hoisted(() => vi.fn<(
  delayMs: number,
  value?: unknown,
  options?: { signal?: AbortSignal },
) => Promise<void>>(() => Promise.resolve()))

vi.mock('node:timers/promises', () => ({ setTimeout: delay }))

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

async function boot(key?: string, config: EvolinkImage.Config = {}) {
  const ctx = new Context()
  ctx.provide('launchEnvironment', createLaunchEnvironmentSnapshot([
    { source: 'process', values: key === undefined ? {} : { EVOLINK_API_KEY: key } },
  ]))
  await ctx.plugin(SystemPrompt).await()
  await ctx.plugin(ToolRuntime).await()
  await ctx.plugin(MemorySettings).await()
  const fiber = ctx.plugin(EvolinkImage, config)
  await fiber.await()
  const call = (arguments_: Record<string, unknown> = { prompt: 'A moonlit lake' }) => ctx.tools.execute({
    signal: new AbortController().signal,
    callId: ToolCallId('image-test'),
    name: 'generate_image',
    arguments: arguments_,
  })
  return { ctx, fiber, call }
}

function jsonBody(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== 'string') throw new Error('expected a JSON string request body')
  return JSON.parse(init.body) as unknown
}

afterEach(() => {
  delay.mockReset()
  delay.mockResolvedValue(undefined)
  vi.restoreAllMocks()
})

describe('Evolink image generation tool', () => {
  it('registers by default, follows settings, and unregisters on disposal', async () => {
    const { ctx, fiber } = await boot('test-key')
    expect(ctx.tools.get('generate_image')).toBeDefined()

    await ctx.settings.update(EvolinkImage.SETTINGS_NAMESPACE, { enabled: false })
    expect(ctx.tools.get('generate_image')).toBeUndefined()

    await ctx.settings.update(EvolinkImage.SETTINGS_NAMESPACE, { enabled: true })
    await fiber.dispose()
    expect(ctx.tools.get('generate_image')).toBeUndefined()
    expect(ctx.settings.describe().map(row => String(row.ns))).not.toContain(EvolinkImage.SETTINGS_NAMESPACE)
    await ctx.fiber.dispose()
  })

  it('creates a task and polls every five seconds until images are ready', async () => {
    const { ctx, call } = await boot('test-key', { enabled: true })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'task/a b', status: 'pending' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'task/a b', status: 'pending' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'task/a b', status: 'processing' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'task/a b', status: 'completed', results: ['https://images.example/generated.png'],
      })))

    const result = await call({ prompt: ' A moonlit lake ', size: '16:9', seed: 42, nsfw_check: true })

    expect(result.isError).toBe(false)
    expect(JSON.stringify(result)).toContain('https://images.example/generated.png')
    expect(delay).toHaveBeenCalledTimes(3)
    expect(delay.mock.calls.map(call_ => call_[0])).toEqual([
      EvolinkImage.DEFAULT_POLL_INTERVAL_MS,
      EvolinkImage.DEFAULT_POLL_INTERVAL_MS,
      EvolinkImage.DEFAULT_POLL_INTERVAL_MS,
    ])
    const [createUrl, createInit] = fetchSpy.mock.calls[0]!
    expect(createUrl).toBe('https://api.evolink.ai/v1/images/generations')
    expect(createInit?.headers).toMatchObject({ Authorization: 'Bearer test-key' })
    expect(jsonBody(createInit)).toEqual({
      model: 'z-image-turbo', prompt: 'A moonlit lake', size: '16:9', seed: 42, nsfw_check: true,
    })
    expect(fetchSpy.mock.calls.slice(1).map(call_ => call_[0])).toEqual([
      'https://api.evolink.ai/v1/tasks/task%2Fa%20b',
      'https://api.evolink.ai/v1/tasks/task%2Fa%20b',
      'https://api.evolink.ai/v1/tasks/task%2Fa%20b',
    ])
    expect(ctx.tools.get('generate_image')?.presentCall?.({ prompt: 'A moonlit lake' })).toMatchObject({
      card: 'generic', title: 'Generate image', rawInput: 'A moonlit lake',
    })
    await ctx.fiber.dispose()
  })

  it('uses request defaults and a configured polling interval', async () => {
    const { ctx, call } = await boot('test-key', {
      enabled: true,
      apiKeyEnv: 'EVOLINK_API_KEY',
      apiBaseUrl: EvolinkImage.DEFAULT_API_BASE_URL,
      pollIntervalMs: 25,
      timeoutMs: 180_000,
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'task-1' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'completed', results: ['https://images.example/default.png'],
      })))

    await call()

    expect(jsonBody(fetchSpy.mock.calls[0]![1])).toEqual({
      model: 'z-image-turbo', prompt: 'A moonlit lake', size: '1:1', nsfw_check: false,
    })
    expect(delay.mock.calls[0]?.[0]).toBe(25)
    expect(delay.mock.calls[0]?.[2]?.signal).toBeInstanceOf(AbortSignal)
    await ctx.fiber.dispose()
  })

  it('resolves the API key from the credentials service when present', async () => {
    const { ctx, call } = await boot(undefined, { enabled: true })
    const resolve = vi.fn(() => Promise.resolve({ value: 'credential-key', source: 'file' as const }))
    ctx.provide('credentials', { resolve } as never)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'task-1' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'completed', results: ['https://images.example/credential.png'],
      })))

    const result = await call()

    expect(result.isError).toBe(false)
    expect(resolve).toHaveBeenCalledOnce()
    expect(fetchSpy.mock.calls[0]![1]?.headers).toMatchObject({ Authorization: 'Bearer credential-key' })
    await ctx.fiber.dispose()
  })

  it('rejects a retained tool definition after settings disable it', async () => {
    const { ctx } = await boot('test-key', { enabled: true })
    const definition = ctx.tools.get('generate_image')!
    await ctx.settings.update(EvolinkImage.SETTINGS_NAMESPACE, { enabled: false })

    await expect(definition.execute({ prompt: 'A moonlit lake' }, {} as never))
      .rejects.toThrow('is disabled')
    await ctx.fiber.dispose()
  })

  it('fails without a key before making a network request', async () => {
    const { ctx, call } = await boot(undefined, { enabled: true })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await call()

    expect(result.isError).toBe(true)
    expect(JSON.stringify(result)).toContain('EVOLINK_API_KEY')
    expect(fetchSpy).not.toHaveBeenCalled()
    await ctx.fiber.dispose()
  })

  it('rejects invalid prompt and seed values before making a request', async () => {
    const { ctx, call } = await boot('test-key', { enabled: true })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    expect((await call({ prompt: '   ' })).isError).toBe(true)
    expect((await call({ prompt: 'ok', seed: 0 })).isError).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
    await ctx.fiber.dispose()
  })

  it.each([
    ['failed', 'generation failed'],
    ['cancelled', 'was cancelled'],
    ['canceled', 'was cancelled'],
    ['mystery', 'unknown task status'],
  ])('reports terminal provider status %s', async (status, message) => {
    const { ctx, call } = await boot('test-key', { enabled: true })
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'task-1' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status })))

    const result = await call()

    expect(result.isError).toBe(true)
    expect(JSON.stringify(result)).toContain(message)
    await ctx.fiber.dispose()
  })

  it('reports HTTP and malformed provider responses', async () => {
    const { ctx, call } = await boot('test-key', { enabled: true })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'pending' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'task-1' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'completed', results: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify([])))

    expect(JSON.stringify(await call())).toContain('HTTP 503')
    expect(JSON.stringify(await call())).toContain('no task ID')
    expect(JSON.stringify(await call())).toContain('without valid image URLs')
    expect(JSON.stringify(await call())).toContain('invalid response')
    expect(fetchSpy).toHaveBeenCalledTimes(5)
    await ctx.fiber.dispose()
  })

  it('rejects invalid provider configuration through settings', async () => {
    const { ctx } = await boot('test-key')

    await expect(ctx.settings.update(EvolinkImage.SETTINGS_NAMESPACE, {
      apiBaseUrl: 'http://api.evolink.ai/v1/',
    })).rejects.toThrow('HTTPS directory URL')
    await expect(ctx.settings.update(EvolinkImage.SETTINGS_NAMESPACE, {
      pollIntervalMs: 0,
    })).rejects.toThrow('pollIntervalMs')
    await expect(ctx.settings.update(EvolinkImage.SETTINGS_NAMESPACE, {
      timeoutMs: 0,
    })).rejects.toThrow('timeoutMs')
    await ctx.fiber.dispose()
  })

  it('validates direct mounts before registering effects', () => {
    const ctx = new Context()

    expect(() => { EvolinkImage.apply(ctx, { pollIntervalMs: 1.5 }) }).toThrow('pollIntervalMs')
    expect(() => { EvolinkImage.apply(ctx, { timeoutMs: Number.MAX_SAFE_INTEGER + 1 }) }).toThrow('timeoutMs')
  })
})
