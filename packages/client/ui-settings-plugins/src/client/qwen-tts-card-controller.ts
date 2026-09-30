/** Staged form for the Qwen text-to-speech plugin settings. */

import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import { CardForm, textField, type CardActions, type CardShell } from './card-form.ts'

/** Host settings namespace owned by the Qwen TTS tool. */
export const QWEN_TTS_NS = 'speech-generation-qwen'

/** Fields edited by the Web plugin card. */
export interface QwenTtsSettings {
  enabled?: boolean
  model?: string
}

/** Settings and draft state shown by the Qwen TTS card. */
export interface QwenTtsCardState extends CardShell {
  enabled: boolean
  model: ReturnType<CardForm<QwenTtsSettings>['field']>
}

/** Browser registration face for the Qwen TTS card. */
export interface QwenTtsCardFace extends CardActions {
  hooks: { qwenTtsCard: SnapshotStore<QwenTtsCardState> }
  toggleEnabled: () => void
}

/** Connect one Qwen TTS settings scope to its staged Web form. */
export class QwenTtsCardController {
  private readonly form: CardForm<QwenTtsSettings>
  private readonly store: SnapshotStore<QwenTtsCardState>

  /** @param scope - bound `speech-generation-qwen` settings scope. */
  constructor(scope: SettingsScope<QwenTtsSettings>) {
    this.form = new CardForm(scope, [{
      field: 'enabled',
      format: value => value === true ? 'true' : 'false',
      parse: text => text === 'true' || text === 'false'
        ? { kind: 'set', value: text === 'true' }
        : undefined,
    }, textField('model')])
    this.store = this.form.bind(() => ({
      ...this.form.shell(),
      enabled: this.form.field('enabled').text === 'true',
      model: this.form.field('model'),
    }))
  }

  /**
   * 返回实时卡片状态及暂存编辑操作。
   * @returns Qwen TTS 卡片注入接口。
   */
  inject(): QwenTtsCardFace {
    return {
      hooks: { qwenTtsCard: this.store },
      ...this.form.actions(),
      toggleEnabled: () => {
        this.form.actions().edit('enabled', this.store.getSnapshot().enabled ? 'false' : 'true')
      },
    }
  }
}
