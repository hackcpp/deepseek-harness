import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { VideoProjectCatalog, VideoProjectView } from '../contract.ts'

/** Current project-catalog load and selection state. */
export interface VideoWorkspaceSnapshot {
  readonly phase: 'loading' | 'ready' | 'error'
  readonly root?: string
  readonly projects: readonly VideoProjectView[]
  readonly selectedId?: string
  readonly error?: string
}

function isCatalog(value: unknown): value is VideoProjectCatalog {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { root?: unknown; projects?: unknown }
  return typeof candidate.root === 'string' && Array.isArray(candidate.projects)
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
  async refresh(): Promise<void> {
    const previous = this.snapshot.getSnapshot()
    this.snapshot.set({ ...previous, phase: 'loading' })
    try {
      const response = await globalThis.fetch('/api/video.projects', { headers: { accept: 'application/json' } })
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
      const value: unknown = await response.json()
      if (!isCatalog(value)) throw new Error('invalid project catalog')
      const selectedId = value.projects.some(project => project.id === previous.selectedId)
        ? previous.selectedId
        : value.projects[0]?.id
      this.snapshot.set({
        phase: 'ready',
        root: value.root,
        projects: value.projects,
        ...(selectedId === undefined ? {} : { selectedId }),
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
    if (!current.projects.some(project => project.id === id)) return
    this.snapshot.set({ ...current, selectedId: id })
  }
}
