import { Outlet } from 'react-router'
import { Languages } from 'lucide-react'
import { useI18n } from '../i18n'

export function AuthLayout() {
  const { t, toggle, label } = useI18n()

  return (
    <div className="auth-page">
      <div className="auth-lang-toggle">
        <button onClick={toggle} className="btn-ghost-sm">
          <Languages size={14} /> {label}
        </button>
      </div>
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">V</span>
          <span>Vynex API</span>
        </div>
        <Outlet />
      </div>
      <div className="auth-bg-grid" />
    </div>
  )
}
