// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { useSyncExternalStore } from 'react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type {} from '../src/client/index.ts'
import { VideoCanvas } from '../src/client/VideoCanvas.tsx'
import { VideoModeSwitch } from '../src/client/VideoModeSwitch.tsx'
import type { VideoWorkspaceSnapshot } from '../src/client/controller.ts'

afterEach(cleanup)

type VideoModeSwitchProps = ComponentProps<typeof VideoModeSwitch>
const unusedHook = (() => { throw new Error('unused by VideoModeSwitch') }) as never
const standardProps = {
  useSessions: unusedHook,
  useSessionPendingInteraction: unusedHook,
  useWorkspaces: unusedHook,
}

describe('VideoCanvas', () => {
  it('renders preview metadata and all three timeline tracks with thumbnails', () => {
    const source = createSnapshotStore<VideoWorkspaceSnapshot>({
      phase: 'ready',
      root: '/videos',
      selectedId: 'demo',
      projects: [{
        id: 'demo', path: '/videos/demo', title: 'Demo', summary: 'Summary', status: 'production',
        aspectRatio: '16:9', updatedAt: 1,
        scenes: [{
          id: 's1', title: 'Opening', narration: 'Welcome', durationSeconds: 3,
          visualType: 'image', visualDescription: 'Opening card', thumbnailUrl: '/api/frame.png', audioUrl: '/api/voice.mp3',
        }],
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
    const props = { useProjects, t } as unknown as ComponentProps<typeof VideoCanvas>
    const view = render(<VideoCanvas {...props} />)
    expect(view.getByText('Demo')).toBeTruthy()
    expect(view.getByText('timeline.subtitle')).toBeTruthy()
    expect(view.getByText('timeline.visual')).toBeTruthy()
    expect(view.getByText('timeline.audio')).toBeTruthy()
    expect(view.getAllByAltText('Opening')).toHaveLength(2)
    expect(view.getAllByAltText('Opening')[0]?.getAttribute('src')).toBe('/api/frame.png')
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
