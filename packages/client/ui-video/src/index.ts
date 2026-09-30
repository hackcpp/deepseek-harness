/** Host half of the video workspace: project discovery and authenticated assets. */
import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import type { VideoProjectCatalog, VideoProjectView, VideoSceneView } from './contract.ts'

export const name = 'ui-video'
export const inject = ['connection']

/** Host configuration for video project discovery. */
export interface Config {
  /** Directory scanned for video project folders. */
  projectsRoot?: string
  /** Maximum directory depth searched for script.json. */
  scanDepth?: number
}

export const Config: z<Config> = z.object({
  projectsRoot: z.string(),
  scanDepth: z.natural().max(5).default(2),
})

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

function sceneView(projectId: string, value: unknown, index: number): VideoSceneView | undefined {
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
    durationSeconds: typeof scene.durationSeconds === 'number' && scene.durationSeconds > 0
      ? scene.durationSeconds
      : 1,
    visualType,
    visualDescription: text(visual?.description),
    ...(assetPath !== '' && IMAGE_EXTENSIONS.has(extname(assetPath).toLowerCase())
      ? { thumbnailUrl: assetUrl(projectId, assetPath) }
      : {}),
    ...(audioPath !== '' && AUDIO_EXTENSIONS.has(extname(audioPath).toLowerCase())
      ? { audioUrl: assetUrl(projectId, audioPath) }
      : {}),
  }
}

async function findPreview(projectDir: string, projectId: string): Promise<string | undefined> {
  const entries = await readdir(projectDir, { withFileTypes: true })
  const candidate = entries.find(entry => entry.isFile() && VIDEO_EXTENSIONS.has(extname(entry.name).toLowerCase()))
  return candidate === undefined ? undefined : assetUrl(projectId, candidate.name)
}

async function readProject(root: string, scriptPath: string): Promise<VideoProjectView | undefined> {
  try {
    const projectDir = resolve(scriptPath, '..')
    const projectId = relative(root, projectDir).split(sep).join('/') || '.'
    const raw = record(JSON.parse(await readFile(scriptPath, 'utf8')))
    if (raw === undefined) return undefined
    const scenes = Array.isArray(raw.scenes)
      ? raw.scenes.map((scene, index) => sceneView(projectId, scene, index)).filter(scene => scene !== undefined)
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

async function scriptFiles(root: string, depth: number): Promise<string[]> {
  const found: string[] = []
  const visit = async (dir: string, remaining: number): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === 'script.json' && entry.isFile()) found.push(join(dir, entry.name))
      if (remaining > 0 && entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        await visit(join(dir, entry.name), remaining - 1)
      }
    }
  }
  await visit(root, depth)
  return found
}

async function catalog(root: string, depth: number): Promise<VideoProjectCatalog> {
  const scripts = await scriptFiles(root, depth)
  const projects = (await Promise.all(scripts.map(path => readProject(root, path))))
    .filter(project => project !== undefined)
    .sort((left, right) => right.updatedAt - left.updatedAt)
  return { root, projects }
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
export function apply(ctx: Context, config?: Config): void {
  const root = resolve(config?.projectsRoot ?? process.env.DSH_VIDEO_PROJECTS_ROOT ?? process.cwd())
  const depth = config?.scanDepth ?? 2
  const connection: HostConnectionHandle = ctx.connection
  ctx.effect(() => connection.fetch.register({
    path: '/api/video.projects',
    methods: ['GET'],
    fetch: async () => Response.json(await catalog(root, depth)),
  }), 'ui-video: project catalog route')
  ctx.effect(() => connection.fetch.register({
    path: '/api/video.asset',
    methods: ['GET', 'HEAD'],
    fetch: async (request) => {
      const url = new URL(request.url)
      const project = url.searchParams.get('project') ?? ''
      const path = url.searchParams.get('path') ?? ''
      const projectRel = safeRelative(root, project)
      if (projectRel === undefined) return new Response('forbidden', { status: 403 })
      const projectDir = resolve(root, projectRel)
      const assetRel = safeRelative(projectDir, path)
      if (assetRel === undefined || assetRel === '') return new Response('forbidden', { status: 403 })
      try {
        const body = await readFile(resolve(projectDir, assetRel))
        const headers = { 'content-type': mediaType(assetRel), 'cache-control': 'no-store' }
        return request.method === 'HEAD' ? new Response(null, { headers }) : new Response(body, { headers })
      } catch {
        return new Response('not found', { status: 404 })
      }
    },
  }), 'ui-video: project asset route')
}
