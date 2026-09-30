/** The video bundle must keep one parseable, self-contained Web extension layer. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as yaml from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'

describe('video application bundle', () => {
  it('packages the UI and every video-production tool behind the video preset', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      dsh?: { bundle?: { patch?: string } }
    }
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(Object.keys(manifest.dependencies ?? {})).toEqual(expect.arrayContaining([
      '@deepseek-ai/dsh-client-ui-video',
      '@deepseek-ai/dsh-hyperframes-tools',
      '@deepseek-ai/dsh-image-generation-evolink',
      '@deepseek-ai/dsh-speech-generation-qwen',
    ]))
    const parsed = yaml.load(
      readFileSync(resolve(root, manifest.dsh!.bundle!.patch!), 'utf8'),
      { schema: entryListSchema },
    ) as { id?: string; config?: Record<string, unknown>; insert?: { id?: string; name?: string }[] }[]
    expect(parsed.find(row => row.id === 'agent-presets')?.config).toEqual({ default: 'video' })
    expect(parsed.flatMap(row => row.insert ?? [])).toContainEqual(expect.objectContaining({
      id: 'ui-video', name: '@deepseek-ai/dsh-client-ui-video',
    }))
    const inserted = parsed.flatMap(row => row.insert ?? []) as { id?: string; config?: Record<string, unknown> }[]
    for (const id of ['speech-generation-qwen', 'image-generation-evolink', 'hyperframes-tools']) {
      expect(inserted.find(row => row.id === id)?.config?.enabled).toBe(true)
    }
  })

  it('keeps every video package out of the shared base bundle', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const baseRoot = resolve(root, '..', 'base')
    const manifest = JSON.parse(readFileSync(resolve(baseRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
    const patch = readFileSync(resolve(baseRoot, 'cordis.patch.yml'), 'utf8')
    const videoPackages = [
      '@deepseek-ai/dsh-client-ui-video',
      '@deepseek-ai/dsh-hyperframes-tools',
      '@deepseek-ai/dsh-image-generation-evolink',
      '@deepseek-ai/dsh-speech-generation-qwen',
    ]
    for (const packageName of videoPackages) {
      expect(manifest.dependencies).not.toHaveProperty(packageName)
      expect(patch).not.toContain(packageName)
    }
  })
})
