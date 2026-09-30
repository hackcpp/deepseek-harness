/** Staged enablement form for Evolink image generation. */

import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import { CardForm, type CardActions, type CardShell } from './card-form.ts'

/** Host settings namespace of the Evolink image tool. */
export const EVOLINK_IMAGE_NS = 'image-generation-evolink'

/** Fields edited by the Web card. */
export interface EvolinkImageSettings { enabled?: boolean }

/** Card state shown by the Web client. */
export interface EvolinkImageCardState extends CardShell { enabled: boolean }

/** Browser slot injection for the image card. */
export interface EvolinkImageCardFace extends CardActions {
  hooks: { evolinkImageCard: SnapshotStore<EvolinkImageCardState> }
  toggleEnabled: () => void
}

/** Connect the Evolink settings section to its staged Web form. */
export class EvolinkImageCardController {
  private readonly form: CardForm<EvolinkImageSettings>
  private readonly store: SnapshotStore<EvolinkImageCardState>

  /** @param scope - bound Evolink image settings scope. */
  constructor(scope: SettingsScope<EvolinkImageSettings>) {
    this.form = new CardForm(scope, [{
      field: 'enabled',
      format: value => value === true ? 'true' : 'false',
      parse: text => text === 'true' || text === 'false'
        ? { kind: 'set', value: text === 'true' } : undefined,
    }])
    this.store = this.form.bind(() => ({
      ...this.form.shell(),
      enabled: this.form.field('enabled').text === 'true',
    }))
  }

  /**
   * Return the card state and staged edit actions.
   * @returns Card state and staged edit actions.
   */
  inject(): EvolinkImageCardFace {
    return {
      hooks: { evolinkImageCard: this.store },
      ...this.form.actions(),
      toggleEnabled: () => {
        this.form.actions().edit('enabled', this.store.getSnapshot().enabled ? 'false' : 'true')
      },
    }
  }
}
