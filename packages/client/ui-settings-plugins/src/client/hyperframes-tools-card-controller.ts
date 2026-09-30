/** Hyperframes Agent 工具的暂存启用表单。 */
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import { CardForm, type CardActions, type CardShell } from './card-form.ts'

/** Hyperframes 工具插件拥有的设置命名空间。 */
export const HYPERFRAMES_TOOLS_NS = 'hyperframes-tools'
/** 卡片编辑的设置字段。 */
export interface HyperframesToolsSettings { enabled?: boolean }
/** 向渲染器暴露的卡片状态。 */
export interface HyperframesToolsCardState extends CardShell { enabled: boolean }
/** 卡片的浏览器 slot 接口。 */
export interface HyperframesToolsCardFace extends CardActions {
  hooks: { hyperframesToolsCard: SnapshotStore<HyperframesToolsCardState> }
  toggleEnabled: () => void
}

/** 将设置作用域连接到暂存表单。 */
export class HyperframesToolsCardController {
  private readonly form: CardForm<HyperframesToolsSettings>
  private readonly store: SnapshotStore<HyperframesToolsCardState>
  /** @param scope - 已绑定的 Hyperframes 设置作用域。 */
  constructor(scope: SettingsScope<HyperframesToolsSettings>) {
    this.form = new CardForm(scope, [{
      field: 'enabled', format: value => value === true ? 'true' : 'false',
      parse: text => text === 'true' || text === 'false' ? { kind: 'set', value: text === 'true' } : undefined,
    }])
    this.store = this.form.bind(() => ({ ...this.form.shell(), enabled: this.form.field('enabled').text === 'true' }))
  }
  /**
   * 返回卡片状态和暂存编辑操作。
   * @returns 卡片状态与操作接口。
   */
  inject(): HyperframesToolsCardFace {
    return { hooks: { hyperframesToolsCard: this.store }, ...this.form.actions(), toggleEnabled: () => {
      this.form.actions().edit('enabled', this.store.getSnapshot().enabled ? 'false' : 'true')
    } }
  }
}
