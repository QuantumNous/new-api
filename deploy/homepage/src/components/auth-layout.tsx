import { Outlet } from 'react-router'
import { LanguageSelect } from './language-select'

export function AuthLayout() {
  return (
    <div className="auth-page">
      <div className="auth-lang-toggle">
        <LanguageSelect />
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
