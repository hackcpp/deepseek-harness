// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { VideoWorkspaceController } from '../src/client/controller.ts'

afterEach(() => { vi.unstubAllGlobals() })

describe('VideoWorkspaceController', () => {
  it('loads the project catalog and preserves a selected project across refreshes', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      root: '/videos',
      projects: [
        { id: 'one', path: '/videos/one', title: 'One', summary: '', status: 'script', aspectRatio: '16:9', updatedAt: 2, scenes: [] },
        { id: 'two', path: '/videos/two', title: 'Two', summary: '', status: 'script', aspectRatio: '16:9', updatedAt: 1, scenes: [] },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)
    const controller = new VideoWorkspaceController()
    await controller.refresh()
    expect(controller.snapshot.getSnapshot()).toMatchObject({ phase: 'ready', selectedId: 'one' })
    controller.select('two')
    await controller.refresh()
    expect(controller.snapshot.getSnapshot()).toMatchObject({ selectedId: 'two' })
  })

  it('publishes a visible error without discarding the last catalog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const controller = new VideoWorkspaceController()
    await controller.refresh()
    expect(controller.snapshot.getSnapshot()).toMatchObject({ phase: 'error', error: 'offline', projects: [] })
  })
})
