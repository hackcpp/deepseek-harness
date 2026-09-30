import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { VideoWorkspaceSnapshot } from './controller.ts'
import css from './VideoWorkspace.module.css'

interface CanvasInjected {
  hooks: { projects: { getSnapshot(): VideoWorkspaceSnapshot; subscribe(fn: () => void): () => void } }
}

type Props = PropsRuntime<'shell.mode.canvas'> & InjectFace<CanvasInjected> & PropsLocale<'video'>

/** Preview and three-track timeline for the selected video project. */
export function VideoCanvas({ useProjects, t }: Props) {
  const state = useProjects(value => value)
  const project = state.projects.find(candidate => candidate.id === state.selectedId)
  if (project === undefined) return <main className={css.emptyPreview}>{t('preview.empty')}</main>
  const total = Math.max(1, project.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0))
  const width = (duration: number): string => `${String(Math.max(8, duration / total * 100))}%`
  const firstVisual = project.scenes.find(scene => scene.thumbnailUrl !== undefined)
  return (
    <main className={css.canvas}>
      <header className={css.projectHeader}>
        <div><h1>{project.title}</h1><p>{project.summary}</p></div>
        <span>{t('preview.status', { status: project.status })}</span>
      </header>
      <section className={css.preview}>
        {project.previewUrl !== undefined
          ? <video controls src={project.previewUrl} />
          : firstVisual?.thumbnailUrl !== undefined
            ? <img src={firstVisual.thumbnailUrl} alt={firstVisual.title} />
            : <div className={css.previewPlaceholder}>{project.scenes[0]?.visualDescription ?? project.title}</div>}
      </section>
      <section className={css.timeline}>
        <div className={css.track}>
          <strong>{t('timeline.subtitle')}</strong>
          <div className={css.clips}>{project.scenes.map(scene => (
            <div className={css.subtitleClip} style={{ width: width(scene.durationSeconds) }} key={scene.id} title={scene.narration}>
              {scene.narration}
            </div>
          ))}</div>
        </div>
        <div className={css.track}>
          <strong>{t('timeline.visual')}</strong>
          <div className={css.clips}>{project.scenes.map(scene => (
            <div className={css.visualClip} style={{ width: width(scene.durationSeconds) }} key={scene.id}>
              {scene.thumbnailUrl === undefined
                ? <span>{scene.title}</span>
                : <img src={scene.thumbnailUrl} alt={scene.title} />}
              <small>{t('preview.duration', { seconds: scene.durationSeconds })}</small>
            </div>
          ))}</div>
        </div>
        <div className={css.track}>
          <strong>{t('timeline.audio')}</strong>
          <div className={css.clips}>{project.scenes.map(scene => (
            <div className={css.audioClip} style={{ width: width(scene.durationSeconds) }} key={scene.id}>
              <span>{scene.audioUrl === undefined ? t('timeline.noAudio') : '▥▥▥▥▥'}</span>
            </div>
          ))}</div>
        </div>
      </section>
    </main>
  )
}
