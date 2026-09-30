/** Video workspace Client plugin. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import { VideoWorkspaceController } from './controller.ts'
import { VideoCanvas } from './VideoCanvas.tsx'
import { VideoModeSwitch } from './VideoModeSwitch.tsx'
import { VideoProjectList, type VideoProjectListInjected } from './VideoProjectList.tsx'
import { en, NS, zh, type VideoKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { video: VideoKey }
}

export const inject = ['slots', 'locale', 'sessions']

/** Register the application switch, project navigation, and video canvas. */
export function apply(ctx: Context): void {
  const controller = new VideoWorkspaceController()
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'ui-video: dictionaries')
  const sessionDirectories = (): { current?: string; all: string[] } => {
    const state = ctx.sessions.list.getSnapshot()
    const current = state.current === undefined ? undefined : state.byId[state.current]?.cwd
    const all = [...new Set(state.ids.flatMap((id) => {
      const cwd = state.byId[id]?.cwd
      return cwd === undefined ? [] : [cwd]
    }))]
    if (current !== undefined && !all.includes(current)) all.unshift(current)
    return { ...(current === undefined ? {} : { current }), all }
  }
  const refresh = (): void => {
    const directories = sessionDirectories()
    void controller.refresh(directories.all, directories.current)
  }
  const createProject = (): void => {
    const cwd = sessionDirectories().current
    void ctx.sessions.create(cwd === undefined ? {} : { cwd }).then((id) => { ctx.sessions.open(id) })
  }
  const injected = (): VideoProjectListInjected => ({
    hooks: { projects: controller.snapshot },
    selectProject: (id) => {
      controller.select(id)
      const project = controller.snapshot.getSnapshot().projects.find(candidate => candidate.id === id)
      if (project === undefined) return
      const state = ctx.sessions.list.getSnapshot()
      const sessionId = state.ids.find(candidate => state.byId[candidate]?.cwd === project.path)
      if (sessionId !== undefined) ctx.sessions.open(sessionId)
    },
    refresh,
    createProject,
  })
  ctx.slots.inject('shell.mode.switcher', () => ctx.slots.register({
    name: 'shell.mode.switcher', id: 'video', order: 10, locale: NS,
  }, VideoModeSwitch))
  ctx.slots.inject('shell.mode.navigation', () => ctx.slots.register({
    name: 'shell.mode.navigation', key: 'video', locale: NS, inject: injected,
  }, VideoProjectList))
  ctx.slots.inject('shell.mode.canvas', () => ctx.slots.register({
    name: 'shell.mode.canvas', key: 'video', locale: NS,
    inject: () => ({
      hooks: { projects: controller.snapshot },
      selectScene: (id: string) => { controller.selectScene(id) },
    }),
  }, VideoCanvas))
  const timer = window.setInterval(refresh, 3000)
  ctx.effect(() => {
    const disposeSessions = ctx.sessions.list.subscribe(refresh)
    refresh()
    return () => {
      disposeSessions()
      window.clearInterval(timer)
    }
  }, 'ui-video: project refresh')
}
