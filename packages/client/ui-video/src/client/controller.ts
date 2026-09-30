import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { VideoProjectCatalog, VideoProjectView } from '../contract.ts'

/** Current project-catalog load and selection state. */
export interface VideoWorkspaceSnapshot {
  readonly phase: 'loading' | 'ready' | 'error'
  readonly projects: readonly VideoProjectView[]
  readonly selectedId?: string
  readonly selectedSceneId?: string
  readonly error?: string
}

function isCatalog(value: unknown): value is VideoProjectCatalog {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { projects?: unknown }
  return Array.isArray(candidate.projects)
}

/** Browser-side project catalog and selected-project state. */
export class VideoWorkspaceController {
  /** Observable project catalog consumed by both video workspace columns. */
  readonly snapshot: SnapshotStore<VideoWorkspaceSnapshot>

  constructor() {
    this.snapshot = createSnapshotStore<VideoWorkspaceSnapshot>({ phase: 'loading', projects: [] })
  }

  /**
   * Reload the Host project catalog while retaining the previous visible data on failure.
   * @returns completion of the current catalog request.
   */
  async refresh(cwds: readonly string[] = [], preferredPath?: string): Promise<void> {
    const previous = this.snapshot.getSnapshot()
    this.snapshot.set({ ...previous, phase: 'loading' })
    try {
      const query = new URLSearchParams()
      for (const cwd of cwds) query.append('cwd', cwd)
      const response = await globalThis.fetch(`/api/video.projects?${query.toString()}`, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
      const value: unknown = await response.json()
      if (!isCatalog(value)) throw new Error('invalid project catalog')
      const selectedId = value.projects.find(project => project.path === preferredPath)?.id
        ?? (value.projects.some(project => project.id === previous.selectedId) ? previous.selectedId : undefined)
        ?? value.projects[0]?.id
      const selectedProject = value.projects.find(project => project.id === selectedId)
      const selectedSceneId = selectedId === previous.selectedId
        && selectedProject?.scenes.some(scene => scene.id === previous.selectedSceneId) === true
        ? previous.selectedSceneId
        : selectedProject?.scenes[0]?.id
      this.snapshot.set({
        phase: 'ready',
        projects: value.projects,
        ...(selectedId === undefined ? {} : { selectedId }),
        ...(selectedSceneId === undefined ? {} : { selectedSceneId }),
      })
    } catch (error) {
      this.snapshot.set({
        ...previous,
        phase: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Select an id present in the current catalog.
   * @param id - project id to preview.
   */
  select(id: string): void {
    const current = this.snapshot.getSnapshot()
    const project = current.projects.find(candidate => candidate.id === id)
    if (project === undefined) return
    const selectedSceneId = project.scenes[0]?.id
    this.snapshot.set({
      ...current,
      selectedId: id,
      ...(selectedSceneId === undefined ? {} : { selectedSceneId }),
    })
  }

  /** 选择当前项目中要预览的镜头。 */
  selectScene(id: string): void {
    const current = this.snapshot.getSnapshot()
    const project = current.projects.find(candidate => candidate.id === current.selectedId)
    if (project?.scenes.some(scene => scene.id === id) !== true) return
    this.snapshot.set({ ...current, selectedSceneId: id })
  }
}
