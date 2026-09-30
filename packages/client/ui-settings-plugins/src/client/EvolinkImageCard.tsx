/** Evolink image generation enablement card. */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { PluginCard } from './PluginCard.tsx'
import type { EvolinkImageCardFace } from './evolink-image-card-controller.ts'
import type {} from './slot-contract.ts'
import css from './QwenTtsCard.module.css'

/** Props supplied by the Settings slot renderer. */
export type EvolinkImageCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'settings.plugins'>
  & InjectFace<EvolinkImageCardFace>

/** Render the staged Evolink image tool switch. */
export function EvolinkImageCard(props: EvolinkImageCardProps) {
  const state = props.useEvolinkImageCard(snapshot => snapshot)
  const { t } = props
  return (
    <PluginCard t={t} titleKey="evolinkImageTitle" descriptionKey="evolinkImageDescription"
      state={state} onSave={props.save} onDiscard={props.discard}>
      <label className={css.toggle}>
        <span>{t('evolinkImageEnabled')}</span>
        <input type="checkbox" role="switch" checked={state.enabled}
          disabled={!state.writable || state.saving} onChange={props.toggleEnabled} />
      </label>
    </PluginCard>
  )
}
