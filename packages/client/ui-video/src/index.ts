/** Host half of the video workspace: project discovery and authenticated assets. */
import { createReadStream } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import type { Context } from '@deepseek-ai/cordis'
import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import type { VideoProjectCatalog, VideoProjectView, VideoSceneView } from './contract.ts'

export const name = 'ui-video'
export const inject = ['connection']

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'])
const AUDIO_EXTENSIONS = new Set(['.aac', '.flac', '.m4a', '.mp3', '.ogg', '.wav'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm'])

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function safeRelative(base: string, candidate: string): string | undefined {
  const absolute = resolve(base, candidate)
  const rel = relative(base, absolute)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel)) ? rel : undefined
}

function assetUrl(projectId: string, assetPath: string): string {
  const query = new URLSearchParams({ project: projectId, path: assetPath })
  return `/api/video.asset?${query.toString()}`
}

interface SnapshotCandidate {
  path: string
  time?: number
}

function sceneDuration(value: unknown): number {
  const scene = record(value)
  return typeof scene?.durationSeconds === 'number' && scene.durationSeconds > 0
    ? scene.durationSeconds
    : 1
}

function sceneView(
  projectId: string,
  value: unknown,
  index: number,
  snapshotPath?: string,
): VideoSceneView | undefined {
  const scene = record(value)
  if (scene === undefined) return undefined
  const visual = record(scene.visual)
  const assetPath = text(visual?.assetPath)
  const audioPath = text(scene.audioPath)
  const visualType = visual?.type === 'html' || visual?.type === 'image' ? visual.type : 'unknown'
  return {
    id: text(scene.id, `scene-${String(index + 1)}`),
    title: text(scene.title, `Scene ${String(index + 1)}`),
    narration: text(scene.narration),
    durationSeconds: sceneDuration(scene),
    visualType,
    visualDescription: text(visual?.description),
    ...(assetPath !== '' && IMAGE_EXTENSIONS.has(extname(assetPath).toLowerCase())
      ? { thumbnailUrl: assetUrl(projectId, assetPath) }
      : snapshotPath !== undefined
        ? { thumbnailUrl: assetUrl(projectId, snapshotPath) }
        : {}),
    ...(audioPath !== '' && AUDIO_EXTENSIONS.has(extname(audioPath).toLowerCase())
      ? { audioUrl: assetUrl(projectId, audioPath) }
      : {}),
  }
}

async function findSnapshots(projectDir: string): Promise<SnapshotCandidate[]> {
  try {
    const entries = await readdir(join(projectDir, 'snapshots'), { withFileTypes: true })
    return entries
      .filter(entry => entry.isFile()
        && entry.name !== 'contact-sheet.jpg'
        && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
      .map((entry) => {
        const match = /(?:^|-)at-([0-9]+(?:\.[0-9]+)?)s(?:\.|-)/u.exec(entry.name)
        return {
          path: `snapshots/${entry.name}`,
          ...(match?.[1] === undefined ? {} : { time: Number(match[1]) }),
        }
      })
      .sort((left, right) => left.path.localeCompare(right.path))
  } catch {
    return []
  }
}

function sceneSnapshot(
  candidates: readonly SnapshotCandidate[],
  sceneId: string,
  index: number,
  midpoint: number,
): string | undefined {
  const named = candidates.find(candidate => basename(candidate.path).includes(sceneId))
  if (named !== undefined) return named.path
  const timed = candidates
    .filter((candidate): candidate is SnapshotCandidate & { time: number } => candidate.time !== undefined)
    .toSorted((left, right) => Math.abs(left.time - midpoint) - Math.abs(right.time - midpoint))[0]
  return timed?.path ?? candidates[index]?.path
}

async function findPreview(projectDir: string, projectId: string): Promise<string | undefined> {
  const directories = ['renders', '']
  for (const directory of directories) {
    try {
      const root = join(projectDir, directory)
      const entries = await readdir(root, { withFileTypes: true })
      const candidates = await Promise.all(entries
        .filter(entry => entry.isFile() && VIDEO_EXTENSIONS.has(extname(entry.name).toLowerCase()))
        .map(async entry => ({
          path: directory === '' ? entry.name : `${directory}/${entry.name}`,
          updatedAt: (await stat(join(root, entry.name))).mtimeMs,
        })))
      const preferred = candidates.find(candidate => candidate.path === 'renders/render.mp4')
        ?? candidates.toSorted((left, right) => right.updatedAt - left.updatedAt)[0]
      if (preferred !== undefined) return assetUrl(projectId, preferred.path)
    } catch {
      // 该目录尚未生成视频时继续检查下一个候选目录。
    }
  }
  return undefined
}

interface AssetRange {
  readonly start: number
  readonly end: number
}

function assetRange(value: string | null, size: number): AssetRange | undefined | false {
  if (value === null) return undefined
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value)
  if (match === null || (match[1] === '' && match[2] === '')) return false
  if (match[1] === '') {
    const length = Number(match[2])
    if (!Number.isSafeInteger(length) || length <= 0) return false
    return { start: Math.max(0, size - length), end: size - 1 }
  }
  const start = Number(match[1])
  const requestedEnd = match[2] === '' ? size - 1 : Number(match[2])
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start < 0 || start >= size || requestedEnd < start) {
    return false
  }
  return { start, end: Math.min(requestedEnd, size - 1) }
}

async function readProject(projectDir: string): Promise<VideoProjectView | undefined> {
  try {
    const scriptPath = join(projectDir, 'script.json')
    const projectId = projectDir
    const raw = record(JSON.parse(await readFile(scriptPath, 'utf8')))
    if (raw === undefined) return undefined
    const snapshots = await findSnapshots(projectDir)
    let start = 0
    const scenes = Array.isArray(raw.scenes)
      ? raw.scenes.map((scene, index) => {
        const duration = sceneDuration(scene)
        const sceneId = text(record(scene)?.id, `scene-${String(index + 1)}`)
        const snapshot = sceneSnapshot(snapshots, sceneId, index, start + duration / 2)
        start += duration
        return sceneView(projectId, scene, index, snapshot)
      }).filter(scene => scene !== undefined)
      : []
    const info = await stat(scriptPath)
    const previewUrl = await findPreview(projectDir, projectId)
    return {
      id: projectId,
      path: projectDir,
      title: text(raw.title, basename(projectDir)),
      summary: text(raw.summary),
      status: text(raw.status, 'script'),
      aspectRatio: text(raw.aspectRatio, '16:9'),
      updatedAt: info.mtimeMs,
      scenes,
      ...(previewUrl === undefined ? {} : { previewUrl }),
    }
  } catch {
    return undefined
  }
}

async function catalog(directories: readonly string[]): Promise<VideoProjectCatalog> {
  const roots = [...new Set(directories.map(directory => resolve(directory)))].slice(0, 200)
  const projects = (await Promise.all(roots.map(readProject)))
    .filter(project => project !== undefined)
    .sort((left, right) => right.updatedAt - left.updatedAt)
  return { projects }
}

function mediaType(path: string): string {
  const extension = extname(path).toLowerCase()
  const types: Record<string, string> = {
    '.aac': 'audio/aac', '.avif': 'image/avif', '.flac': 'audio/flac', '.gif': 'image/gif',
    '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4', '.ogg': 'audio/ogg', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.wav': 'audio/wav', '.webm': 'video/webm', '.webp': 'image/webp',
  }
  return types[extension] ?? 'application/octet-stream'
}

/** Register project catalog and asset routes on the authenticated Web API. */
export function apply(ctx: Context): void {
  const connection: HostConnectionHandle = ctx.connection
  ctx.effect(() => connection.fetch.register({
    path: '/api/video.projects',
    methods: ['GET'],
    fetch: async (request) => {
      const directories = new URL(request.url).searchParams.getAll('cwd').filter(isAbsolute)
      return Response.json(await catalog(directories))
    },
  }), 'ui-video: project catalog route')
  ctx.effect(() => connection.fetch.register({
    path: '/api/video.asset',
    methods: ['GET', 'HEAD'],
    fetch: async (request) => {
      const url = new URL(request.url)
      const project = url.searchParams.get('project') ?? ''
      const path = url.searchParams.get('path') ?? ''
      if (!isAbsolute(project)) return new Response('forbidden', { status: 403 })
      const projectDir = resolve(project)
      const assetRel = safeRelative(projectDir, path)
      if (assetRel === undefined || assetRel === '') return new Response('forbidden', { status: 403 })
      try {
        await stat(join(projectDir, 'script.json'))
        const assetPath = resolve(projectDir, assetRel)
        const info = await stat(assetPath)
        if (!info.isFile()) return new Response('not found', { status: 404 })
        const range = assetRange(request.headers.get('range'), info.size)
        const headers = new Headers({
          'accept-ranges': 'bytes',
          'cache-control': 'no-store',
          'content-type': mediaType(assetRel),
        })
        if (range === false) {
          headers.set('content-range', `bytes */${String(info.size)}`)
          return new Response(null, { status: 416, headers })
        }
        const start = range?.start ?? 0
        const end = range?.end ?? info.size - 1
        headers.set('content-length', String(Math.max(0, end - start + 1)))
        if (range !== undefined) headers.set('content-range', `bytes ${String(start)}-${String(end)}/${String(info.size)}`)
        if (request.method === 'HEAD') return new Response(null, { status: range === undefined ? 200 : 206, headers })
        const stream = Readable.toWeb(createReadStream(assetPath, { start, end })) as ReadableStream<Uint8Array>
        return new Response(stream, { status: range === undefined ? 200 : 206, headers })
      } catch {
        return new Response('not found', { status: 404 })
      }
    },
  }), 'ui-video: project asset route')
}
