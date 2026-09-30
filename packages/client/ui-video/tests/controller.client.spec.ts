// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { VideoWorkspaceController } from '../src/client/controller.ts'

afterEach(() => { vi.unstubAllGlobals() })

describe('VideoWorkspaceController', () => {
  it('loads the project catalog and preserves a selected project across refreshes', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      projects: [
        { id: 'one', path: '/videos/one', title: 'One', summary: '', status: 'script', aspectRatio: '16:9', updatedAt: 2, scenes: [{ id: 'one-a' }, { id: 'one-b' }] },
        { id: 'two', path: '/videos/two', title: 'Two', summary: '', status: 'script', aspectRatio: '16:9', updatedAt: 1, scenes: [{ id: 'two-a' }] },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)
    const controller = new VideoWorkspaceController()
    await controller.refresh(['/videos/one', '/videos/two'], '/videos/two')
    expect(fetch).toHaveBeenCalledWith(
      '/api/video.projects?cwd=%2Fvideos%2Fone&cwd=%2Fvideos%2Ftwo',
      expect.any(Object),
    )
    expect(controller.snapshot.getSnapshot()).toMatchObject({ phase: 'ready', selectedId: 'two', selectedSceneId: 'two-a' })
    controller.select('one')
    controller.selectScene('one-b')
    await controller.refresh(['/videos/one', '/videos/two'])
    expect(controller.snapshot.getSnapshot()).toMatchObject({ selectedId: 'one', selectedSceneId: 'one-b' })
  })

  it('publishes a visible error without discarding the last catalog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const controller = new VideoWorkspaceController()
    await controller.refresh()
    expect(controller.snapshot.getSnapshot()).toMatchObject({ phase: 'error', error: 'offline', projects: [] })
  })
})
