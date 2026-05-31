import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router'
import { useI18n } from '../i18n'
import { api } from '../lib/api'
import type { StatusData } from '../lib/api'

export function Register() {
  const { t } = useI18n()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifySent, setVerifySent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      await api.post('/api/user/register', { username, password, email: email || undefined })

      const status = await api.get<StatusData>('/api/status')
      if (status.email_verification) {
        setVerifySent(true)
      } else {
        navigate('/sign-in')
      }
    } catch (err: any) {
      setError(err?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (verifySent) {
    return (
      <div className="auth-form">
        <h2>{t('auth.register.title')}</h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: 1.6 }}>
          A verification email has been sent. Please check your inbox and follow the link to activate your account.
        </p>
        <Link className="btn-primary" to="/sign-in" style={{ textAlign: 'center', marginTop: '16px' }}>
          {t('auth.signIn.title')}
        </Link>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>{t('auth.register.title')}</h2>

      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <label className="form-label">{t('auth.username')}</label>
        <input
          className="form-input"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          autoFocus
        />
      </div>

      <div className="form-group">
        <label className="form-label">{t('auth.email')}</label>
        <input
          className="form-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      <div className="form-group">
        <label className="form-label">{t('auth.password')}</label>
        <input
          className="form-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">{t('auth.confirmPassword')}</label>
        <input
          className="form-input"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>

      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? '...' : t('auth.register.submit')}
      </button>

      <div className="auth-footer">
        <Link className="auth-link" to="/sign-in">
          {t('auth.register.hasAccount')}
        </Link>
      </div>
    </form>
  )
}
