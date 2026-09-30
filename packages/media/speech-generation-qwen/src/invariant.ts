/** Package-owned invariant companion. @module @deepseek-ai/dsh-speech-generation-qwen/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-speech-generation-qwen'

/** Cordis companion plugin name. */
export const name = 'speech-generation-qwen-invariant'
/** Service required to register this package's invariant owner. */
export const inject = ['invariants']

/** No runtime invariant: tool availability is the tool registry's owned state. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant owner. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
