/** Package-owned invariant companion for the video application bundle. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

export const name = 'video-app-invariant'
export const inject = ['invariants']
// No runtime invariant: the package owns only a static profile patch.
const install: InvariantInstaller = () => {}

/** Register static bundle ownership. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register('@deepseek-ai/dsh-video-app', install))
