import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router'
import { useI18n } from '../i18n'
import { api, type ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'

export function SignIn() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { login } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [require2fa, setRequire2fa] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (require2fa) {
        await api.post('/api/user/login/2fa', { code })
        const user = await api.get('/api/user/self') as any
        useAuth.setState({ user, loading: false, initialized: true })
        navigate('/dashboard')
        return
      }

      await login(username, password)
      navigate('/dashboard')
    } catch (err: any) {
      const apiErr = err as ApiError
      if (apiErr?.data && typeof apiErr.data === 'object' && (apiErr.data as any).require_2fa) {
        setRequire2fa(true)
      } else {
        setError(apiErr?.message || 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>{t('auth.signIn.title')}</h2>

      {error && <div className="form-error">{error}</div>}

      {!require2fa ? (
        <>
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
            <label className="form-label">{t('auth.password')}</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
        </>
      ) : (
        <div className="form-group">
          <label className="form-label">{t('auth.2faCode')}</label>
          <input
            className="form-input"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            required
            autoFocus
          />
        </div>
      )}

      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? '...' : t('auth.signIn.submit')}
      </button>

      <div className="auth-footer">
        <Link className="auth-link" to="/forgot-password">
          {t('auth.signIn.forgotPassword')}
        </Link>
        <Link className="auth-link" to="/register">
          {t('auth.signIn.noAccount')}
        </Link>
      </div>
    </form>
  )
}
