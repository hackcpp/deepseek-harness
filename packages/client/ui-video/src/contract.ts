/** One parsed scene from a video's script.json file. */
export interface VideoSceneView {
  readonly id: string
  readonly title: string
  readonly narration: string
  readonly durationSeconds: number
  readonly visualType: 'html' | 'image' | 'unknown'
  readonly visualDescription: string
  readonly thumbnailUrl?: string
  readonly audioUrl?: string
}

/** Browser-facing summary of one video project directory. */
export interface VideoProjectView {
  readonly id: string
  readonly path: string
  readonly title: string
  readonly summary: string
  readonly status: string
  readonly aspectRatio: string
  readonly updatedAt: number
  readonly scenes: readonly VideoSceneView[]
  readonly previewUrl?: string
}

/** Complete project catalog returned by the Host. */
export interface VideoProjectCatalog {
  readonly projects: readonly VideoProjectView[]
}
