/** Evolink Z-Image-Turbo Agent tool and settings-controlled registration. @module @deepseek-ai/dsh-image-generation-evolink */

import { setTimeout as delay } from 'node:timers/promises'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import type {} from '@deepseek-ai/dsh-settings'
import { defineTool } from '@deepseek-ai/dsh-tools'

/** Cordis plugin name. */
export const name = 'image-generation-evolink'
/** Tool registry required for Agent registration. */
export const inject = ['tools']
/** Settings namespace used by the Host and Plugins card. */
export const SETTINGS_NAMESPACE = 'image-generation-evolink'
/** Evolink API root. */
export const DEFAULT_API_BASE_URL = 'https://api.evolink.ai/v1/'
/** Default interval between task-status requests. */
export const DEFAULT_POLL_INTERVAL_MS = 5000

/** Deployment settings for image generation. */
export interface Config {
  /** Register the tool while true; defaults to true. */
  enabled?: boolean
  /** Credential reference resolved for each tool call. */
  apiKeyEnv?: string
  /** HTTPS Evolink API root. */
  apiBaseUrl?: string
  /** Delay between task-status requests. */
  pollIntervalMs?: number
  /** Total time allowed for creation, polling, and results. */
  timeoutMs?: number
}

/** Loader and Settings schema. */
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  apiKeyEnv: z.string().role('credential-ref').default('EVOLINK_API_KEY'),
  apiBaseUrl: z.string().default(DEFAULT_API_BASE_URL),
  pollIntervalMs: z.number().step(1).min(1).default(DEFAULT_POLL_INTERVAL_MS),
  timeoutMs: z.number().step(1).min(1).default(180000),
})

interface ResolvedConfig {
  enabled: boolean
  apiKeyEnv: string
  apiBaseUrl: string
  pollIntervalMs: number
  timeoutMs: number
}

function resolveConfig(config: Config): ResolvedConfig {
  const resolved = {
    enabled: config.enabled ?? true,
    apiKeyEnv: config.apiKeyEnv ?? 'EVOLINK_API_KEY',
    apiBaseUrl: config.apiBaseUrl ?? DEFAULT_API_BASE_URL,
    pollIntervalMs: config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    timeoutMs: config.timeoutMs ?? 180000,
  }
  credentialRef(resolved.apiKeyEnv)
  const url = new URL(resolved.apiBaseUrl)
  if (url.protocol !== 'https:' || url.search || url.hash || !url.pathname.endsWith('/')) {
    throw new Error('image-generation-evolink: apiBaseUrl must be an HTTPS directory URL')
  }
  if (!Number.isSafeInteger(resolved.pollIntervalMs) || resolved.pollIntervalMs < 1) {
    throw new Error('image-generation-evolink: pollIntervalMs must be a positive safe integer')
  }
  if (!Number.isSafeInteger(resolved.timeoutMs) || resolved.timeoutMs < 1) {
    throw new Error('image-generation-evolink: timeoutMs must be a positive safe integer')
  }
  return resolved
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Evolink returned an invalid response')
  }
  return value as Record<string, unknown>
}

function imageUrls(value: unknown): string[] {
  const results = record(value)['results']
  if (!Array.isArray(results) || results.length === 0 || !results.every(url =>
    typeof url === 'string' && /^https?:\/\//u.test(url))) {
    throw new Error('Evolink completed without valid image URLs')
  }
  return results as string[]
}

/** Register an optional image tool that waits for Evolink's terminal task status. */
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
      name: 'generate_image',
      description: 'Generate an image from a prompt with Evolink Z-Image-Turbo. Returns image URLs that expire after 24 hours.',
      parameters: {
        prompt: { type: 'string', required: true, description: 'Describe the image to generate (up to 2000 characters).' },
        size: { type: 'string', enum: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '1:2', '2:1'], description: 'Image aspect ratio; defaults to 1:1.' },
        seed: { type: 'integer', description: 'Optional reproducible random seed (1 to 2147483647).' },
        nsfw_check: { type: 'boolean', description: 'Enable stricter content filtering.' },
      },
      output: {
        schema: {
          type: 'object', additionalProperties: false,
          properties: {
            taskId: { type: 'string', required: true },
            imageUrls: { type: 'array', required: true, items: { type: 'string' } },
          },
        },
        render: (_args, value) => [{ type: 'text', text: `Images (URLs expire after 24 hours):\n${value.imageUrls.join('\n')}` }],
      },
      async execute(args, exec) {
        const active = resolveConfig(current())
        if (!active.enabled) throw new Error('Evolink image generation is disabled')
        const prompt = args.prompt.trim()
        if (!prompt || Array.from(prompt).length > 2000) throw new Error('prompt must contain 1-2000 characters')
        if (args.seed !== undefined && (!Number.isSafeInteger(args.seed) || args.seed < 1 || args.seed > 2147483647)) {
          throw new Error('seed must be an integer between 1 and 2147483647')
        }
        const ref = credentialRef(active.apiKeyEnv)
        const credentials = ctx.get('credentials')
        const key = credentials === undefined
          ? launchEnvironmentOf(ctx).get(ref)?.value
          : (await credentials.resolve(ref))?.value
        if (!key) throw new Error(`Evolink requires ${active.apiKeyEnv}`)
        const signal = AbortSignal.any([exec.signal, AbortSignal.timeout(active.timeoutMs)])
        const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
        const base = active.apiBaseUrl
        const request = async (url: string, init?: RequestInit): Promise<Record<string, unknown>> => {
          const response = await fetch(url, { ...init, headers, signal })
          if (!response.ok) throw new Error(`Evolink request failed with HTTP ${response.status}`)
          return record(await response.json())
        }
        const created = await request(new URL('images/generations', base).href, {
          method: 'POST',
          body: JSON.stringify({ model: 'z-image-turbo', prompt, size: args.size ?? '1:1',
            ...(args.seed === undefined ? {} : { seed: args.seed }),
            nsfw_check: args.nsfw_check ?? false }),
        })
        const taskId = created['id']
        if (typeof taskId !== 'string' || !taskId.trim()) throw new Error('Evolink returned no task ID')
        const taskUrl = new URL(`tasks/${encodeURIComponent(taskId)}`, base).href
        while (true) {
          await delay(active.pollIntervalMs, undefined, { signal })
          const result = await request(taskUrl)
          switch (result['status']) {
            case 'pending':
            case 'processing':
              break
            case 'completed':
              return { taskId, imageUrls: imageUrls(result) }
            case 'failed':
              throw new Error('Evolink image generation failed')
            case 'cancelled':
            case 'canceled':
              throw new Error('Evolink image generation was cancelled')
            default:
              throw new Error('Evolink returned an unknown task status')
          }
        }
      },
      presentCall(args) {
        return { card: 'generic', title: 'Generate image', kind: 'other', rawInput: args.prompt }
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
  ctx.effect(() => () => { unregister?.() }, 'image-generation-evolink: registration')
}
