/** Package-owned invariant companion for the video UI plugin. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

export const name = 'ui-video-invariant'
export const inject = ['invariants']
// No runtime invariant: route ownership and slot registration fail during activation.
const install: InvariantInstaller = () => {}

/** Register the package ownership companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register('@deepseek-ai/dsh-client-ui-video', install))
