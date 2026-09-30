/** Hyperframes Agent 工具启用卡片。 */
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { PluginCard } from './PluginCard.tsx'
import type { HyperframesToolsCardFace } from './hyperframes-tools-card-controller.ts'
import type {} from './slot-contract.ts'
import css from './QwenTtsCard.module.css'

/** 设置 slot 渲染器提供的属性。 */
export type HyperframesToolsCardProps = PropsRuntime<'settings.plugin.item'> & PropsLocale<'settings.plugins'> & InjectFace<HyperframesToolsCardFace>

/** 渲染 Hyperframes 工具开关。 */
export function HyperframesToolsCard(props: HyperframesToolsCardProps) {
  const state = props.useHyperframesToolsCard(snapshot => snapshot)
  const { t } = props
  return <PluginCard t={t} titleKey="hyperframesToolsTitle" descriptionKey="hyperframesToolsDescription" state={state} onSave={props.save} onDiscard={props.discard}>
    <label className={css.toggle}>
      <span>{t('hyperframesToolsEnabled')}</span>
      <input type="checkbox" role="switch" checked={state.enabled} disabled={!state.writable || state.saving} onChange={props.toggleEnabled} />
    </label>
  </PluginCard>
}
