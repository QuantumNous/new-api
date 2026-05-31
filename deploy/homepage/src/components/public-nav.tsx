import { useState, useEffect } from 'react'
import { Languages } from 'lucide-react'
import { useI18n } from '../i18n'
import { api, type StatusData } from '../lib/api'

export function PublicNav() {
  const { t, toggle, label } = useI18n()
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
        <button onClick={toggle} className="nav-lang" title="Switch language">
          <Languages size={14} />
          {label}
        </button>
        <a href="/sign-in" className="nav-action">{t('nav.console')}</a>
      </div>
      <div className="mobile-actions">
        <button onClick={toggle} className="nav-lang" title="Switch language">
          <Languages size={14} />
          {label}
        </button>
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
