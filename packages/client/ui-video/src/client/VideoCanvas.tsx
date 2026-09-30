import { useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { VideoWorkspaceSnapshot } from './controller.ts'
import css from './VideoWorkspace.module.css'

const WAVEFORM = [7, 15, 11, 20, 13, 18, 9, 16, 6, 12]

interface CanvasInjected {
  hooks: { projects: { getSnapshot(): VideoWorkspaceSnapshot; subscribe(fn: () => void): () => void } }
  selectScene(id: string): void
}

type Props = PropsRuntime<'shell.mode.canvas'> & InjectFace<CanvasInjected> & PropsLocale<'video'>

/** Preview and three-track timeline for the selected video project. */
export function VideoCanvas({ useProjects, selectScene, t }: Props) {
  const state = useProjects(value => value)
  const project = state.projects.find(candidate => candidate.id === state.selectedId)
  const selectedIndex = project?.scenes.findIndex(scene => scene.id === state.selectedSceneId) ?? -1
  const sceneIndex = selectedIndex >= 0 ? selectedIndex : 0
  const selectedScene = project?.scenes[sceneIndex]
  const sceneStart = project?.scenes.slice(0, sceneIndex)
    .reduce((sum, scene) => sum + scene.durationSeconds, 0) ?? 0
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playingAudioId, setPlayingAudioId] = useState<string>()
  useEffect(() => {
    if (videoRef.current === null || project?.previewUrl === undefined) return
    videoRef.current.pause()
    videoRef.current.currentTime = sceneStart
  }, [project?.previewUrl, sceneStart])
  useEffect(() => {
    audioRef.current?.pause()
    setPlayingAudioId(undefined)
  }, [project?.id])
  if (project === undefined) return <main className={css.emptyPreview}>{t('preview.empty')}</main>
  const total = Math.max(1, project.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0))
  const width = (duration: number): string => `${String(Math.max(8, duration / total * 100))}%`
  const previewScene = selectedScene ?? project.scenes.find(scene => scene.thumbnailUrl !== undefined)
  const stopAudio = (): void => {
    audioRef.current?.pause()
    setPlayingAudioId(undefined)
  }
  const sceneButton = (sceneId: string): { 'data-active'?: true; onClick(): void } => ({
    ...(sceneId === previewScene?.id ? { 'data-active': true } : {}),
    onClick: () => {
      stopAudio()
      selectScene(sceneId)
    },
  })
  const audition = (sceneId: string, audioUrl?: string): void => {
    selectScene(sceneId)
    const player = audioRef.current
    if (player === null || audioUrl === undefined) return
    if (playingAudioId === sceneId && !player.paused) {
      stopAudio()
      return
    }
    player.pause()
    player.src = audioUrl
    player.currentTime = 0
    void player.play()
      .then(() => { setPlayingAudioId(sceneId) })
      .catch(() => { setPlayingAudioId(undefined) })
  }
  return (
    <main className={css.canvas}>
      <header className={css.projectHeader}>
        <div><h1>{project.title}</h1><p>{project.summary}</p></div>
        <span>{t('preview.status', { status: project.status })}</span>
      </header>
      <section className={css.preview}>
        {project.previewUrl !== undefined
          ? <video ref={videoRef} controls src={project.previewUrl} />
          : previewScene?.thumbnailUrl !== undefined
            ? <img src={previewScene.thumbnailUrl} alt={previewScene.title} />
            : <div className={css.previewPlaceholder}>{previewScene?.visualDescription ?? project.title}</div>}
      </section>
      <audio ref={audioRef} onEnded={() => { setPlayingAudioId(undefined) }} />
      <section className={css.timeline}>
        <div className={css.track}>
          <strong>{t('timeline.subtitle')}</strong>
          <div className={css.clips}>{project.scenes.map(scene => (
            <button type="button" className={css.subtitleClip} style={{ width: width(scene.durationSeconds) }} key={scene.id} title={scene.narration} {...sceneButton(scene.id)}>
              {scene.narration}
            </button>
          ))}</div>
        </div>
        <div className={css.track}>
          <strong>{t('timeline.visual')}</strong>
          <div className={css.clips}>{project.scenes.map(scene => (
            <button type="button" className={css.visualClip} style={{ width: width(scene.durationSeconds) }} key={scene.id} {...sceneButton(scene.id)}>
              {scene.thumbnailUrl === undefined
                ? <span>{scene.title}</span>
                : <img src={scene.thumbnailUrl} alt={scene.title} />}
              <small>{t('preview.duration', { seconds: scene.durationSeconds })}</small>
            </button>
          ))}</div>
        </div>
        <div className={css.track}>
          <strong>{t('timeline.audio')}</strong>
          <div className={css.clips}>{project.scenes.map(scene => (
            <button
              type="button"
              className={css.audioClip}
              style={{ width: width(scene.durationSeconds) }}
              key={scene.id}
              aria-label={`${t('timeline.audio')}: ${scene.title}`}
              data-active={scene.id === previewScene?.id || undefined}
              data-playing={scene.id === playingAudioId || undefined}
              onClick={() => { audition(scene.id, scene.audioUrl) }}
            >
              {scene.audioUrl === undefined
                ? <span>{t('timeline.noAudio')}</span>
                : (
                  <span className={css.waveform} aria-hidden="true">
                    {WAVEFORM.map((height, index) => <i key={index} style={{ height }} />)}
                  </span>
                )}
            </button>
          ))}</div>
        </div>
      </section>
    </main>
  )
}
