/** Qwen speech tool enablement and model controls. */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { ValueField } from './fields.tsx'
import { PluginCard } from './PluginCard.tsx'
import type { QwenTtsCardFace } from './qwen-tts-card-controller.ts'
import type {} from './slot-contract.ts'
import css from './QwenTtsCard.module.css'

/** Props supplied by the Settings slot renderer. */
export type QwenTtsCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'settings.plugins'>
  & InjectFace<QwenTtsCardFace>

/** Render the staged Qwen text-to-speech plugin card. */
export function QwenTtsCard(props: QwenTtsCardProps) {
  const state = props.useQwenTtsCard(snapshot => snapshot)
  const { t } = props
  return (
    <PluginCard
      t={t}
      titleKey="qwenTtsTitle"
      descriptionKey="qwenTtsDescription"
      state={state}
      onSave={props.save}
      onDiscard={props.discard}
    >
      <label className={css.toggle}>
        <span>{t('qwenTtsEnabled')}</span>
        <input
          type="checkbox"
          role="switch"
          checked={state.enabled}
          disabled={!state.writable || state.saving}
          onChange={props.toggleEnabled}
        />
      </label>
      <ValueField
        id="plugin-config-qwen-tts-model"
        label={t('qwenTtsModel')}
        hint={t('qwenTtsModelHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('qwenTtsModelInvalid')}
        disabled={!state.writable || state.saving}
        {...state.model}
        onEdit={(text) => { props.edit('model', text) }}
        onReset={() => { props.resetField('model') }}
      />
    </PluginCard>
  )
}
