/** Package-owned invariant companion. @module @deepseek-ai/dsh-image-generation-evolink/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

/** Cordis companion plugin name. */
export const name = 'image-generation-evolink-invariant'
/** Service required to register this package's invariant owner. */
export const inject = ['invariants']

/** No runtime invariant: the tool registry owns tool availability. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant owner. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register('@deepseek-ai/dsh-image-generation-evolink', install))
