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
  const refresh = (): void => { void controller.refresh() }
  const createProject = (): void => {
    const root = controller.snapshot.getSnapshot().root
    void ctx.sessions.create(root === undefined ? {} : { cwd: root }).then((id) => { ctx.sessions.open(id) })
  }
  const injected = (): VideoProjectListInjected => ({
    hooks: { projects: controller.snapshot },
    selectProject: (id) => { controller.select(id) },
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
    inject: () => ({ hooks: { projects: controller.snapshot } }),
  }, VideoCanvas))
  const timer = window.setInterval(refresh, 3000)
  ctx.effect(() => {
    refresh()
    return () => { window.clearInterval(timer) }
  }, 'ui-video: project refresh')
}
