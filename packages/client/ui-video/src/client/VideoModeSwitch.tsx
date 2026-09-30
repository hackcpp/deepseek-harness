import { useEffect, useRef } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './VideoWorkspace.module.css'

type Props = PropsRuntime<'shell.mode.switcher'> & PropsLocale<'video'>

/** Top-level application-mode switch. */
export function VideoModeSwitch({ mode, setMode, t }: Props) {
  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    setMode('video')
  }, [setMode])
  return (
    <div className={css.modeBar} role="group" aria-label={t('mode.video')}>
      <button type="button" data-active={mode === 'default' || undefined} onClick={() => { setMode('default') }}>
        {t('mode.default')}
      </button>
      <button type="button" data-active={mode === 'video' || undefined} onClick={() => { setMode('video') }}>
        {t('mode.video')}
      </button>
    </div>
  )
}
