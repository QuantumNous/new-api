import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router'
import { useI18n } from '../i18n'
import { api } from '../lib/api'

export function ResetPassword() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const email = searchParams.get('email') || ''
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!email || !token) {
      setError('Invalid or missing reset link parameters')
      return
    }

    setLoading(true)

    try {
      await api.post('/api/user/reset', { email, token, password: newPassword })
      setSuccess(true)
      setTimeout(() => navigate('/sign-in'), 2000)
    } catch (err: any) {
      setError(err?.message || 'Password reset failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="auth-form">
        <h2>{t('auth.resetPassword.title')}</h2>
        <p className="form-success">{t('auth.resetPassword.success')}</p>
        <Link className="btn-primary" to="/sign-in" style={{ textAlign: 'center', marginTop: '16px' }}>
          {t('auth.signIn.title')}
        </Link>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>{t('auth.resetPassword.title')}</h2>

      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <label className="form-label">{t('auth.password')}</label>
        <input
          className="form-input"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
          autoFocus
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
        {loading ? '...' : t('auth.resetPassword.submit')}
      </button>
    </form>
  )
}
