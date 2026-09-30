// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { useSyncExternalStore } from 'react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type {} from '../src/client/index.ts'
import { VideoCanvas } from '../src/client/VideoCanvas.tsx'
import { VideoModeSwitch } from '../src/client/VideoModeSwitch.tsx'
import type { VideoWorkspaceSnapshot } from '../src/client/controller.ts'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

type VideoModeSwitchProps = ComponentProps<typeof VideoModeSwitch>
const unusedHook = (() => { throw new Error('unused by VideoModeSwitch') }) as never
const standardProps = {
  useSessions: unusedHook,
  useSessionPendingInteraction: unusedHook,
  useWorkspaces: unusedHook,
}

describe('VideoCanvas', () => {
  it('switches scene previews and auditions narration from the timeline', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    const selectScene = vi.fn()
    const source = createSnapshotStore<VideoWorkspaceSnapshot>({
      phase: 'ready',
      selectedId: 'demo',
      selectedSceneId: 's1',
      projects: [{
        id: 'demo', path: '/videos/demo', title: 'Demo', summary: 'Summary', status: 'production',
        aspectRatio: '16:9', updatedAt: 1,
        scenes: [
          {
            id: 's1', title: 'Opening', narration: 'Welcome', durationSeconds: 3,
            visualType: 'image', visualDescription: 'Opening card', thumbnailUrl: '/api/frame.png', audioUrl: '/api/voice.mp3',
          },
          {
            id: 's2', title: 'Second', narration: 'Continue', durationSeconds: 4,
            visualType: 'image', visualDescription: 'Second card', thumbnailUrl: '/api/second.png', audioUrl: '/api/second.mp3',
          },
        ],
      }],
    })
    const subscribe = (listener: () => void): (() => void) => source.subscribe(listener)
    const getSnapshot = (): VideoWorkspaceSnapshot => source.getSnapshot()
    const useProjects = <T,>(selector: (snapshot: VideoWorkspaceSnapshot) => T): T =>
      selector(useSyncExternalStore(subscribe, getSnapshot))
    const t = (key: string, params?: Record<string, unknown>): string => {
      if (key === 'preview.status') return `Status: ${String(params?.status)}`
      if (key === 'preview.duration') return `${String(params?.seconds)}s`
      return key
    }
    const props = { useProjects, selectScene, t } as unknown as ComponentProps<typeof VideoCanvas>
    const view = render(<VideoCanvas {...props} />)
    expect(view.getByText('Demo')).toBeTruthy()
    expect(view.getByText('timeline.subtitle')).toBeTruthy()
    expect(view.getByText('timeline.visual')).toBeTruthy()
    expect(view.getByText('timeline.audio')).toBeTruthy()
    expect(view.getAllByAltText('Opening')).toHaveLength(2)
    expect(view.getAllByAltText('Opening')[0]?.getAttribute('src')).toBe('/api/frame.png')
    const secondThumbnail = view.getByAltText('Second')
    fireEvent.click(secondThumbnail.closest('button')!)
    expect(selectScene).toHaveBeenCalledWith('s2')

    fireEvent.click(view.getByRole('button', { name: 'timeline.audio: Opening' }))
    expect(selectScene).toHaveBeenCalledWith('s1')
    expect(pause).toHaveBeenCalled()
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('plays a rendered project and seeks it from the scene timeline', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    const source = createSnapshotStore<VideoWorkspaceSnapshot>({
      phase: 'ready',
      selectedId: 'demo',
      selectedSceneId: 's1',
      projects: [{
        id: 'demo', path: '/videos/demo', title: 'Demo', summary: '', status: 'rendered',
        aspectRatio: '16:9', updatedAt: 1, previewUrl: '/api/video.mp4',
        scenes: [
          {
            id: 's1', title: 'Opening', narration: 'Welcome', durationSeconds: 3,
            visualType: 'html', visualDescription: 'Opening card', thumbnailUrl: '/api/first.png',
          },
          {
            id: 's2', title: 'Second', narration: 'Continue', durationSeconds: 4,
            visualType: 'html', visualDescription: 'Second card', thumbnailUrl: '/api/second.png',
          },
        ],
      }],
    })
    const subscribe = (listener: () => void): (() => void) => source.subscribe(listener)
    const getSnapshot = (): VideoWorkspaceSnapshot => source.getSnapshot()
    const useProjects = <T,>(selector: (snapshot: VideoWorkspaceSnapshot) => T): T =>
      selector(useSyncExternalStore(subscribe, getSnapshot))
    const selectScene = (id: string): void => {
      source.set({ ...source.getSnapshot(), selectedSceneId: id })
    }
    const t = (key: string): string => key
    const props = { useProjects, selectScene, t } as unknown as ComponentProps<typeof VideoCanvas>
    const view = render(<VideoCanvas {...props} />)
    const video = view.container.querySelector('video')
    expect(video?.getAttribute('src')).toBe('/api/video.mp4')
    expect(video?.hasAttribute('controls')).toBe(true)

    fireEvent.click(view.getByAltText('Second').closest('button')!)
    await waitFor(() => { expect(video?.currentTime).toBe(3) })
  })
})

describe('VideoModeSwitch', () => {
  it('switches to DSH and stays there after the parent rerenders', () => {
    const setMode = vi.fn()
    const t: VideoModeSwitchProps['t'] = key => key
    const view = render(
      <VideoModeSwitch
        {...standardProps}
        mode="video"
        setMode={setMode}
        t={t}
      />,
    )

    expect(setMode).toHaveBeenCalledTimes(1)
    expect(setMode).toHaveBeenCalledWith('video')
    setMode.mockClear()

    fireEvent.click(view.getByText('mode.default'))

    expect(setMode).toHaveBeenCalledTimes(1)
    expect(setMode).toHaveBeenCalledWith('default')

    const nextSetMode = vi.fn()
    view.rerender(
      <VideoModeSwitch
        {...standardProps}
        mode="default"
        setMode={nextSetMode}
        t={t}
      />,
    )
    expect(nextSetMode).not.toHaveBeenCalled()
  })
})
