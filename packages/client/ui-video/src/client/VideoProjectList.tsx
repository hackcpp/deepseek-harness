import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { VideoWorkspaceSnapshot } from './controller.ts'
import css from './VideoWorkspace.module.css'

export interface VideoProjectListInjected {
  hooks: { projects: { getSnapshot(): VideoWorkspaceSnapshot; subscribe(fn: () => void): () => void } }
  selectProject(id: string): void
  refresh(): void
  createProject(): void
}

type Props = PropsRuntime<'shell.mode.navigation'> & InjectFace<VideoProjectListInjected> & PropsLocale<'video'>

/** Video project navigation column. */
export function VideoProjectList({ useProjects, selectProject, refresh, createProject, t }: Props) {
  const state = useProjects(value => value)
  return (
    <aside className={css.projects}>
      <header>
        <h2>{t('projects.title')}</h2>
        <button type="button" className={css.iconButton} aria-label={t('projects.refresh')} onClick={refresh}>↻</button>
      </header>
      <button type="button" className={css.newProject} onClick={createProject}>＋ {t('projects.new')}</button>
      <div className={css.projectList}>
        {state.phase === 'loading' && state.projects.length === 0 && <p>{t('projects.loading')}</p>}
        {state.phase === 'error' && state.projects.length === 0 && <p>{t('projects.error')}</p>}
        {state.phase === 'ready' && state.projects.length === 0 && <p>{t('projects.empty')}</p>}
        {state.projects.map(project => (
          <button
            type="button"
            className={css.projectRow}
            data-active={project.id === state.selectedId || undefined}
            key={project.id}
            onClick={() => { selectProject(project.id) }}
          >
            <strong>{project.title}</strong>
            <span>{project.status}</span>
            <small>{project.scenes.length} · {project.aspectRatio}</small>
          </button>
        ))}
      </div>
    </aside>
  )
}
