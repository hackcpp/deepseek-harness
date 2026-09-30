/** 包拥有的 invariant 配套插件。 @module @deepseek-ai/dsh-hyperframes-tools/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-hyperframes-tools'

/** Cordis 配套插件名称。 */
export const name = 'hyperframes-tools-invariant'
/** invariant 注册表所需的服务。 */
export const inject = ['invariants']

/** No runtime invariant: 工具注册关系由 dsh-tools 注册表负责。 */
const install: InvariantInstaller = () => {}

/** 注册此包的 invariant 所有者。 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
