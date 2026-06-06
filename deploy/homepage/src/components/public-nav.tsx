import { useState, useEffect } from 'react'
import { useI18n } from '../i18n'
import { api, type StatusData } from '../lib/api'
import { LanguageSelect } from './language-select'

export function PublicNav() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [systemName, setSystemName] = useState('Vynex API')

  useEffect(() => {
    api.get<StatusData>('/api/status')
      .then((data) => {
        if (data.system_name) setSystemName(data.system_name)
      })
      .catch(() => {})
  }, [])

  return (
    <nav className="nav">
      <a href="/" className="brand">
        <span className="brand-mark">V</span>
        {systemName}
      </a>
      <div className="nav-links">
        <a href="/#models">{t('nav.models')}</a>
        <a href="/docs/">{t('nav.docs')}</a>
        <a href="/pricing">{t('nav.pricing')}</a>
        <LanguageSelect className="nav-lang" />
        <a href="/sign-in" className="nav-action">{t('nav.console')}</a>
      </div>
      <div className="mobile-actions">
        <LanguageSelect className="nav-lang" />
        <button className="mobile-toggle" onClick={() => setOpen(!open)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </div>
      {open && (
        <div className="mobile-menu">
          <a href="/#models" onClick={() => setOpen(false)}>{t('nav.models')}</a>
          <a href="/docs/">{t('nav.docs')}</a>
          <a href="/pricing">{t('nav.pricing')}</a>
          <a href="/sign-in" className="nav-action" style={{ textAlign: 'center', marginTop: 8 }}>{t('nav.console')}</a>
        </div>
      )}
    </nav>
  )
}
