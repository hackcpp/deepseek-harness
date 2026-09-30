import type { Readable, Writable } from 'node:stream'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import type {
  SubprocessCollectedOutputs,
  SubprocessHandle,
  SubprocessOutcome,
  SubprocessOutputRead,
  SubprocessOutputReader,
  SubprocessSpawnSpec,
} from '@deepseek-ai/dsh-subprocess'
import { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as HyperframesTools from '@deepseek-ai/dsh-hyperframes-tools'

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

class FixedReader implements SubprocessOutputReader {
  constructor(private readonly text: string) {}

  readFrom(_fromByte: number): SubprocessOutputRead {
    return { text: this.text, nextOffset: Buffer.byteLength(this.text), lossy: false }
  }
}

interface ScriptedRun extends SubprocessOutcome {
  stdout?: string
  stderr?: string
}

class FixedHandle implements SubprocessHandle {
  readonly pid = 123
  readonly stdin: Writable | undefined = undefined
  readonly stdout: Readable | undefined = undefined
  readonly stderr: Readable | undefined = undefined
  readonly collected: SubprocessCollectedOutputs
  readonly done: Promise<SubprocessOutcome>

  constructor(run: ScriptedRun) {
    this.collected = {
      stdout: new FixedReader(run.stdout ?? ''),
      stderr: new FixedReader(run.stderr ?? ''),
    }
    this.done = Promise.resolve({ exitCode: run.exitCode, signal: run.signal })
  }

  terminate(): void {}
  waitForExit(): Promise<boolean> { return Promise.resolve(true) }
}

class FakeSubprocess extends SubprocessRuntime {
  readonly resolutions: string[] = []
  readonly spawns: SubprocessSpawnSpec[] = []
  handler: (spec: SubprocessSpawnSpec) => ScriptedRun = spec => ({
    exitCode: 0,
    signal: null,
    stdout: spec.argv.includes('snapshot') ? 'contact-sheet.jpg (grid view for AI review)' : '',
  })

  override resolveExecutable(command: string): Promise<string> {
    this.resolutions.push(command)
    return Promise.resolve(`/resolved/${command.replaceAll('/', '_')}`)
  }

  override spawn(spec: SubprocessSpawnSpec): SubprocessHandle {
    this.spawns.push(spec)
    return new FixedHandle(this.handler(spec))
  }

  override spawnTerminal(): Promise<never> {
    throw new Error('Hyperframes tools do not allocate terminals')
  }
}

let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
})

async function boot(enabled?: boolean) {
  const ctx = new Context()
  context = ctx
  await ctx.plugin(SystemPrompt).await()
  await ctx.plugin(ToolRuntime).await()
  await ctx.plugin(FakeSubprocess).await()
  const subprocess = ctx.subprocess as FakeSubprocess
  await ctx.plugin(MemorySettings).await()
  const fiber = ctx.plugin(HyperframesTools, enabled === undefined ? {} : { enabled })
  await fiber.await()
  const call = (name: string, args: Record<string, unknown>) => ctx.tools.execute({
    signal: new AbortController().signal,
    callId: ToolCallId(`hyperframes-${name}`),
    name,
    arguments: args,
  })
  return { ctx, subprocess, fiber, call }
}

describe('Hyperframes Agent tools', () => {
  it('registers all three tools only while enabled and removes them on disposal', async () => {
    const { ctx, fiber } = await boot(false)
    const names = () => ctx.tools.schemas().map(schema => schema.name)
    expect(names()).not.toContain('video_lint')

    await ctx.settings.update(HyperframesTools.SETTINGS_NAMESPACE, { enabled: true })
    expect(names()).toEqual(expect.arrayContaining(['video_lint', 'video_snapshot', 'video_render']))
    await ctx.settings.update(HyperframesTools.SETTINGS_NAMESPACE, { enabled: false })
    expect(names()).not.toContain('video_lint')

    await ctx.settings.update(HyperframesTools.SETTINGS_NAMESPACE, { enabled: true })
    await fiber.dispose()
    expect(names()).not.toContain('video_lint')
    expect(ctx.settings.describe().map(row => String(row.ns))).not.toContain(HyperframesTools.SETTINGS_NAMESPACE)
  })

  it('returns lint findings as a successful domain result even when Hyperframes exits one', async () => {
    const { subprocess, call } = await boot()
    subprocess.handler = () => ({
      exitCode: 1,
      signal: null,
      stdout: JSON.stringify({
        ok: false,
        errorCount: 1,
        warningCount: 2,
        findings: [{ severity: 'error', message: 'Unexpected token' }],
      }),
    })

    const result = await call('video_lint', { projectPath: '/work/video' })
    expect(result).toMatchObject({
      isError: false,
      value: { passed: false, errorCount: 1, warningCount: 2 },
    })
    expect(subprocess.spawns[0]?.cwd).toBe('/work/video')
    expect(subprocess.resolutions).toEqual([process.execPath])
    expect(subprocess.spawns[0]?.argv[1]).toMatch(/hyperframes\/bin\/hyperframes\.mjs$/u)
    expect(subprocess.spawns[0]?.argv.slice(-3)).toEqual(['lint', '/work/video', '--json'])
  })

  it('passes at most nine exact timestamps and returns the Hyperframes contact sheet', async () => {
    const { subprocess, call } = await boot()
    const times = [0, 1, 2, 3, 4, 5, 6, 7, 8]
    const result = await call('video_snapshot', { projectPath: '/work/video', times })

    expect(result).toMatchObject({
      isError: false,
      value: {
        contactSheetPath: '/work/video/snapshots/contact-sheet.jpg',
        snapshotsDirectory: '/work/video/snapshots',
        times,
      },
    })
    expect(subprocess.spawns[0]?.argv.slice(-7)).toEqual([
      'snapshot', '/work/video', '--at', '0,1,2,3,4,5,6,7,8', '--no-end', '--output', '/work/video/snapshots',
    ])

    const invalid = await call('video_snapshot', { projectPath: '/work/video', times: [...times, 9] })
    expect(invalid.isError).toBe(true)
    expect(JSON.stringify(invalid)).toContain('one to nine')
    expect(subprocess.spawns).toHaveLength(1)
  })

  it('renders MP4 through Hyperframes and follows live executable settings', async () => {
    const { ctx, subprocess, call } = await boot()
    await ctx.settings.update(HyperframesTools.SETTINGS_NAMESPACE, {
      enabled: true,
      executable: '/opt/hyperframes/bin/hyperframes',
    })

    const result = await call('video_render', { projectPath: '/work/video' })
    expect(result).toMatchObject({
      isError: false,
      value: { outputPath: '/work/video/renders/render.mp4' },
    })
    expect(subprocess.resolutions).toEqual(['/opt/hyperframes/bin/hyperframes'])
    expect(subprocess.spawns[0]?.argv).toEqual([
      '/resolved/_opt_hyperframes_bin_hyperframes',
      'render', '/work/video', '--format', 'mp4', '--output', '/work/video/renders/render.mp4',
    ])
  })

  it('contains CLI failures and invalid lint JSON as tool errors', async () => {
    const { subprocess, call } = await boot()
    subprocess.handler = spec => spec.argv.includes('snapshot')
      ? { exitCode: 2, signal: null, stderr: 'Chrome unavailable' }
      : { exitCode: 0, signal: null, stdout: 'not-json' }

    const snapshot = await call('video_snapshot', { projectPath: '/work/video', times: [1] })
    expect(snapshot.isError).toBe(true)
    expect(JSON.stringify(snapshot)).toContain('Chrome unavailable')
    const lint = await call('video_lint', { projectPath: '/work/video' })
    expect(lint.isError).toBe(true)
    expect(JSON.stringify(lint)).toContain('invalid JSON')
  })
})
