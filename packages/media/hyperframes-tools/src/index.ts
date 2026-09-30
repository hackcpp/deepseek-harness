/** 面向 Agent 的 Hyperframes 项目检查与渲染工具。 @module @deepseek-ai/dsh-hyperframes-tools */

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { SubprocessCollect, SubprocessOutputReader } from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-settings'
import { defineTool } from '@deepseek-ai/dsh-tools'

/** Cordis 插件名称。 */
export const name = 'hyperframes-tools'
/** 注册和执行 Agent 工具所需的服务。 */
export const inject = ['tools', 'subprocess']
/** 插件开关使用的设置命名空间。 */
export const SETTINGS_NAMESPACE = 'hyperframes-tools'
const BUNDLED_HYPERFRAMES_CLI = fileURLToPath(new URL('./bin/hyperframes.mjs', import.meta.resolve('hyperframes/package.json')))

/** Hyperframes 工具注册和 CLI 执行的部署设置。 */
export interface Config {
  /** 为 true 时注册全部三个工具，默认为 true。 */
  enabled?: boolean
  /** 子进程执行环境中的 Hyperframes 可执行文件名称或绝对路径。 */
  executable?: string
  /** 单次 CLI 调用的最长时间。 */
  timeoutMs?: number
  /** 每个 stdout 和 stderr 流最多保留的字节数。 */
  maxOutputBytes?: number
}

/** Loader 和设置共用的 schema。 */
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  executable: z.string(),
  timeoutMs: z.number().step(1).min(1).default(600000),
  maxOutputBytes: z.number().step(1).min(1024).default(262144),
})

interface ResolvedConfig {
  enabled: boolean
  executable: string | undefined
  timeoutMs: number
  maxOutputBytes: number
}

/** 在插件边界解析设置，并覆盖未经 Loader 归一化的直接挂载。 */
function resolveConfig(config: Config): ResolvedConfig {
  const resolved = {
    enabled: config.enabled ?? true,
    executable: config.executable,
    timeoutMs: config.timeoutMs ?? 600000,
    maxOutputBytes: config.maxOutputBytes ?? 262144,
  }
  if (resolved.executable !== undefined && !resolved.executable.trim()) {
    throw new Error('hyperframes-tools: executable must be non-empty when provided')
  }
  if (!Number.isSafeInteger(resolved.timeoutMs) || resolved.timeoutMs < 1) {
    throw new Error('hyperframes-tools: timeoutMs must be a positive safe integer')
  }
  if (!Number.isSafeInteger(resolved.maxOutputBytes) || resolved.maxOutputBytes < 1024) {
    throw new Error('hyperframes-tools: maxOutputBytes must be at least 1024')
  }
  return resolved
}

function projectDirectory(value: string): string {
  const path = value.trim()
  if (!path) throw new Error('projectPath must be non-empty')
  return path
}

function output(reader: SubprocessOutputReader | undefined): string {
  return reader?.readFrom(0).text ?? ''
}

interface RunResult {
  exitCode: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
}

async function runCli(
  ctx: Context,
  active: ResolvedConfig,
  projectPath: string,
  args: readonly string[],
  signal: AbortSignal,
): Promise<RunResult> {
  const executionSignal = AbortSignal.any([signal, AbortSignal.timeout(active.timeoutMs)])
  const command = active.executable ?? process.execPath
  const executable = await ctx.subprocess.resolveExecutable(command, undefined, executionSignal)
  const prefix = active.executable === undefined ? [BUNDLED_HYPERFRAMES_CLI] : []
  const collect = (maxBytes: number): SubprocessCollect => ({ maxBytes, spill: { maxBytes } })
  const handle = ctx.subprocess.spawn({
    argv: [executable, ...prefix, ...args],
    cwd: projectPath,
    stdio: {
      stdin: 'ignore',
      stdout: collect(active.maxOutputBytes),
      stderr: collect(active.maxOutputBytes),
    },
    graceMs: 3000,
    signal: executionSignal,
  })
  const result = await handle.done
  return { ...result, stdout: output(handle.collected.stdout), stderr: output(handle.collected.stderr) }
}

function commandError(command: string, result: RunResult): never {
  const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim()
  throw new Error(`${command} failed (exit ${String(result.exitCode)}): ${detail || 'Hyperframes returned no diagnostics'}`)
}

interface HyperframesLintJson {
  ok: boolean
  errorCount: number
  warningCount: number
  findings: unknown[]
}

function lintJson(text: string): HyperframesLintJson {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('video_lint received invalid JSON from Hyperframes')
  }
  if (value === null || typeof value !== 'object') throw new Error('video_lint received invalid JSON from Hyperframes')
  const body = value as Record<string, unknown>
  if (typeof body['ok'] !== 'boolean'
    || !Number.isSafeInteger(body['errorCount'])
    || !Number.isSafeInteger(body['warningCount'])
    || !Array.isArray(body['findings'])) {
    throw new Error('video_lint received invalid JSON from Hyperframes')
  }
  return {
    ok: body['ok'],
    errorCount: body['errorCount'] as number,
    warningCount: body['warningCount'] as number,
    findings: body['findings'],
  }
}

function registerTools(ctx: Context, source: () => Config): Array<() => void> {
  const active = (): ResolvedConfig => {
    const resolved = resolveConfig(source())
    if (!resolved.enabled) throw new Error('Hyperframes tools are disabled')
    return resolved
  }
  return [
    ctx.tools.register(defineTool({
      name: 'video_lint',
      description: 'Run Hyperframes static project checks and report syntax and composition findings.',
      parameters: {
        projectPath: { type: 'string', required: true, description: 'Absolute path to a Hyperframes project directory.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            passed: { type: 'boolean', required: true },
            errorCount: { type: 'integer', required: true },
            warningCount: { type: 'integer', required: true },
            diagnostics: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.diagnostics }],
      },
      async execute(args, exec) {
        const project = projectDirectory(args.projectPath)
        const result = await runCli(ctx, active(), project, ['lint', project, '--json'], exec.signal)
        let report: HyperframesLintJson
        try {
          report = lintJson(result.stdout)
        } catch (error) {
          if (result.exitCode !== 0) commandError('video_lint', result)
          throw error
        }
        if (result.exitCode !== 0 && result.exitCode !== 1) commandError('video_lint', result)
        return {
          passed: report.ok,
          errorCount: report.errorCount,
          warningCount: report.warningCount,
          diagnostics: JSON.stringify(report, null, 2),
        }
      },
      presentCall: args => ({
        card: 'generic', title: 'Hyperframes lint', kind: 'search', rawInput: args.projectPath,
        locations: [{ path: args.projectPath }],
      }),
    })),
    ctx.tools.register(defineTool({
      name: 'video_snapshot',
      description: 'Render one to nine Hyperframes timestamps and combine them into a three-column contact sheet.',
      parameters: {
        projectPath: { type: 'string', required: true, description: 'Absolute path to a Hyperframes project directory.' },
        times: {
          type: 'array',
          required: true,
          items: { type: 'number' },
          description: 'One to nine timestamps in seconds. Hyperframes renders them in this order.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            contactSheetPath: { type: 'string', required: true },
            snapshotsDirectory: { type: 'string', required: true },
            times: { type: 'array', required: true, items: { type: 'number' } },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: `Contact sheet: ${value.contactSheetPath}\nSnapshots: ${value.snapshotsDirectory}`,
        }],
      },
      async execute(args, exec) {
        const project = projectDirectory(args.projectPath)
        if (args.times.length < 1 || args.times.length > 9
          || !args.times.every(time => Number.isFinite(time) && time >= 0)) {
          throw new Error('times must contain one to nine non-negative finite seconds')
        }
        const snapshotsDirectory = join(project, 'snapshots')
        const result = await runCli(ctx, active(), project, [
          'snapshot', project, '--at', args.times.join(','), '--no-end', '--output', snapshotsDirectory,
        ], exec.signal)
        if (result.exitCode !== 0) commandError('video_snapshot', result)
        if (!result.stdout.includes('contact-sheet.jpg')) {
          throw new Error('video_snapshot completed without a Hyperframes contact sheet')
        }
        return {
          contactSheetPath: join(snapshotsDirectory, 'contact-sheet.jpg'),
          snapshotsDirectory,
          times: [...args.times],
        }
      },
      presentCall: args => ({
        card: 'generic', title: 'Hyperframes snapshots', kind: 'read', rawInput: args.projectPath,
        locations: [{ path: args.projectPath }],
      }),
    })),
    ctx.tools.register(defineTool({
      name: 'video_render',
      description: 'Render a Hyperframes project to an MP4 file with the Hyperframes renderer.',
      parameters: {
        projectPath: { type: 'string', required: true, description: 'Absolute path to a Hyperframes project directory.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: { outputPath: { type: 'string', required: true } },
        },
        render: (_args, value) => [{ type: 'text', text: `MP4: ${value.outputPath}` }],
      },
      async execute(args, exec) {
        const project = projectDirectory(args.projectPath)
        const outputPath = join(project, 'renders', 'render.mp4')
        const result = await runCli(ctx, active(), project, [
          'render', project, '--format', 'mp4', '--output', outputPath,
        ], exec.signal)
        if (result.exitCode !== 0) commandError('video_render', result)
        return { outputPath }
      },
      presentCall: args => ({
        card: 'generic', title: 'Hyperframes MP4 render', kind: 'other', rawInput: args.projectPath,
        locations: [{ path: args.projectPath }],
      }),
    })),
  ]
}

/** 注册由设置控制的 Hyperframes lint、截图和渲染工具。 */
export function apply(ctx: Context, config: Config = {}): void {
  let current: () => Config = () => config
  let unregister: Array<() => void> = []

  const sync = (): void => {
    const enabled = resolveConfig(current()).enabled
    if (enabled === (unregister.length > 0)) return
    for (const dispose of unregister) dispose()
    unregister = enabled ? registerTools(ctx, () => current()) : []
  }

  sync()
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, SETTINGS_NAMESPACE, Config, config, {
      setSource: (source) => { current = source },
      validate: (value) => { resolveConfig(value) },
      onChange: sync,
    })
  })
  ctx.effect(() => () => { for (const dispose of unregister) dispose() }, 'hyperframes-tools: registration')
}
