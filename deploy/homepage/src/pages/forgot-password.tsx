import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useI18n } from '../i18n'
import { api } from '../lib/api'

export function ForgotPassword() {
  const { t } = useI18n()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.get('/api/reset_password', { email })
      setSent(true)
    } catch (err: any) {
      setError(err?.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="auth-form">
        <h2>{t('auth.forgotPassword.title')}</h2>
        <p className="form-success">{t('auth.forgotPassword.success')}</p>
        <Link className="btn-primary" to="/sign-in" style={{ textAlign: 'center', marginTop: '16px' }}>
          {t('auth.forgotPassword.backToSignIn')}
        </Link>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>{t('auth.forgotPassword.title')}</h2>

      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <label className="form-label">{t('auth.email')}</label>
        <input
          className="form-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          autoFocus
        />
      </div>

      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? '...' : t('auth.forgotPassword.submit')}
      </button>

      <div className="auth-footer">
        <Link className="auth-link" to="/sign-in">
          {t('auth.forgotPassword.backToSignIn')}
        </Link>
      </div>
    </form>
  )
}
