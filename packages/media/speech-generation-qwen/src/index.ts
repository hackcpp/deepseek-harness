/** Model-facing Qwen3 text-to-speech tool and its settings-controlled registration. @module @deepseek-ai/dsh-speech-generation-qwen */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-settings'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { defineTool } from '@deepseek-ai/dsh-tools'

/** Cordis plugin name. */
export const name = 'speech-generation-qwen'
/** Tool registry required to expose speech synthesis to an Agent. */
export const inject = ['tools']

/** Settings namespace for the Qwen text-to-speech tool. */
export const SETTINGS_NAMESPACE = 'speech-generation-qwen'

/** Default non-streaming Qwen-TTS endpoint in the Beijing region. */
export const DEFAULT_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

/** Deployment settings for the tool and its provider request. */
export interface Config {
  /** Register the Agent tool when true; defaults to true. */
  enabled?: boolean
  /** Credential reference resolved at execution time. */
  apiKeyEnv?: string
  /** Qwen-TTS model identifier. */
  model?: string
  /** Non-streaming DashScope generation endpoint. */
  endpoint?: string
  /** Maximum accepted text length in Unicode code points. */
  maxTextLength?: number
  /** Cooperative request timeout in milliseconds. */
  timeoutMs?: number
}

/** Settings schema shared by Loader config and the user settings document. */
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  apiKeyEnv: z.string().role('credential-ref').default('DASHSCOPE_API_KEY'),
  model: z.string().default('qwen3-tts-flash'),
  endpoint: z.string().default(DEFAULT_ENDPOINT),
  maxTextLength: z.number().step(1).min(1).default(500),
  timeoutMs: z.number().step(1).min(1).default(60000),
})

interface ResolvedConfig {
  enabled: boolean
  apiKeyEnv: string
  model: string
  endpoint: string
  maxTextLength: number
  timeoutMs: number
}

/** Resolve settings at the plugin boundary, including direct mounts without Loader normalization. */
function resolveConfig(config: Config): ResolvedConfig {
  const resolved = {
    enabled: config.enabled ?? true,
    apiKeyEnv: config.apiKeyEnv ?? 'DASHSCOPE_API_KEY',
    model: config.model ?? 'qwen3-tts-flash',
    endpoint: config.endpoint ?? DEFAULT_ENDPOINT,
    maxTextLength: config.maxTextLength ?? 500,
    timeoutMs: config.timeoutMs ?? 60000,
  }
  credentialRef(resolved.apiKeyEnv)
  if (!resolved.model.trim()) throw new Error('speech-generation-qwen: model must be non-empty')
  const endpoint = new URL(resolved.endpoint)
  if (endpoint.protocol !== 'https:') throw new Error('speech-generation-qwen: endpoint must use HTTPS')
  if (!Number.isSafeInteger(resolved.maxTextLength) || resolved.maxTextLength < 1) {
    throw new Error('speech-generation-qwen: maxTextLength must be a positive safe integer')
  }
  if (!Number.isSafeInteger(resolved.timeoutMs) || resolved.timeoutMs < 1) {
    throw new Error('speech-generation-qwen: timeoutMs must be a positive safe integer')
  }
  return resolved
}

/** Narrow an untrusted provider response before its audio URL reaches the model. */
function audioResult(value: unknown): { audioUrl: string; expiresAt: number } {
  if (value === null || typeof value !== 'object') throw new Error('Qwen TTS returned an invalid response')
  const body = value as Record<string, unknown>
  const output = body['output']
  if (output === null || typeof output !== 'object') throw new Error('Qwen TTS returned no output')
  const audio = (output as Record<string, unknown>)['audio']
  if (audio === null || typeof audio !== 'object') throw new Error('Qwen TTS returned no audio')
  const result = audio as Record<string, unknown>
  const url = result['url']
  const expiresAt = result['expires_at']
  if (typeof url !== 'string' || !/^https?:\/\//u.test(url)
    || typeof expiresAt !== 'number' || !Number.isSafeInteger(expiresAt) || expiresAt < 1) {
    throw new Error('Qwen TTS returned an invalid audio URL or expiry')
  }
  return { audioUrl: url, expiresAt }
}

/** Register the optional tool, and follow the user settings document without a restart. */
export function apply(ctx: Context, config: Config = {}): void {
  let current: () => Config = () => config
  let unregister: (() => void) | undefined

  const sync = (): void => {
    const options = resolveConfig(current())
    if (options.enabled === (unregister !== undefined)) return
    unregister?.()
    unregister = undefined
    if (!options.enabled) return
    unregister = ctx.tools.register(defineTool({
      name: 'generate_speech',
      description: 'Generate spoken audio from text with Qwen3-TTS. Choose a supported voice such as Cherry or Serena. Returns a downloadable audio URL that expires.',
      parameters: {
        text: { type: 'string', required: true, description: 'Text to speak.' },
        voice: { type: 'string', required: true, description: 'Qwen3-TTS voice ID, for example Cherry or Serena.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            audioUrl: { type: 'string', required: true },
            voice: { type: 'string', required: true },
            expiresAt: { type: 'integer', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: `Audio: ${value.audioUrl}\nVoice: ${value.voice}\nURL expires at: ${new Date(value.expiresAt * 1000).toISOString()}` }],
      },
      async execute(args, exec) {
        const active = resolveConfig(current())
        if (!active.enabled) throw new Error('Qwen text-to-speech is disabled')
        const text = args.text.trim()
        const voice = args.voice.trim()
        if (!text || Array.from(text).length > active.maxTextLength) {
          throw new Error(`text must contain 1-${active.maxTextLength} characters`)
        }
        if (!voice) throw new Error('voice must be non-empty')
        const ref = credentialRef(active.apiKeyEnv)
        const credentials = ctx.get('credentials')
        const key = credentials === undefined
          ? launchEnvironmentOf(ctx).get(ref)?.value
          : (await credentials.resolve(ref))?.value
        if (!key) throw new Error(`Qwen TTS requires ${active.apiKeyEnv}`)
        const signal = AbortSignal.any([exec.signal, AbortSignal.timeout(active.timeoutMs)])
        const response = await fetch(active.endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: active.model, input: { text, voice } }),
          signal,
        })
        if (!response.ok) throw new Error(`Qwen TTS request failed with HTTP ${response.status}`)
        const result: unknown = await response.json()
        return { ...audioResult(result), voice }
      },
      presentCall(args) {
        return { card: 'generic', title: `Generate speech (${args.voice})`, kind: 'other', rawInput: args.text }
      },
    }))
  }

  sync()
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, SETTINGS_NAMESPACE, Config, config, {
      setSource: (source) => { current = source },
      validate: (value) => { resolveConfig(value) },
      onChange: sync,
    })
  })
  ctx.effect(() => () => { unregister?.() }, 'speech-generation-qwen: registration')
}
