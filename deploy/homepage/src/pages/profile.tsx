import { useState } from 'react'
import { User, Shield, Key, Link2, Copy, CheckCircle, Save } from 'lucide-react'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'

export function Profile() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const body: Record<string, string> = {}
      if (displayName !== (user?.display_name || '')) {
        body.display_name = displayName
      }
      if (password) {
        body.password = password
      }
      if (Object.keys(body).length > 0) {
        await api.put('/api/user/self', body)
        setSaved(true)
        setPassword('')
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard not available */ }
  }

  const affLink = user?.invite_url || (user?.aff_code ? `${window.location.origin}/register?aff=${user.aff_code}` : '')

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1 className="page-title">{t('profile.title')}</h1>
      </div>

      <div className="profile-grid">
        <div className="profile-section">
          <div className="section-header">
            <User size={16} />
            <h2 className="section-subtitle">{t('profile.title')}</h2>
          </div>

          <div className="profile-info">
            <div className="info-row">
              <span className="info-label">{t('common.username')}</span>
              <span className="info-value mono-sm">{user?.username}</span>
            </div>
            <div className="info-row">
              <span className="info-label">{t('common.email')}</span>
              <span className="info-value mono-sm">{user?.email || '-'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">{t('common.role')}</span>
              <span className="info-value">
                <span className="role-badge">
                  {user?.role === 100 ? 'ROOT' : user?.role === 10 ? 'ADMIN' : 'USER'}
                </span>
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">{t('common.group')}</span>
              <span className="info-value mono-sm">{user?.group || 'default'}</span>
            </div>
          </div>

          <div className="form-divider" />

          <div className="form-group">
            <label className="form-label">{t('profile.displayName')}</label>
            <input
              className="form-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('profile.changePassword')}</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
            />
            <span className="form-hint">Leave empty to keep current password</span>
          </div>

          {error && <div className="form-error">{error}</div>}
          {saved && <div className="form-success">Profile updated successfully.</div>}

          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ marginTop: 16 }}
          >
            <Save size={14} /> {saving ? 'Saving...' : t('profile.save')}
          </button>
        </div>

        <div className="profile-sidebar-sections">
          <div className="profile-section">
            <div className="section-header">
              <Shield size={16} />
              <h2 className="section-subtitle">{t('settings.security')}</h2>
            </div>
            <div className="security-items">
              <div className="security-item">
                <div className="security-info">
                  <span className="security-label">{t('profile.2fa')}</span>
                  <span className="security-status">Not configured</span>
                </div>
                <button className="btn-ghost-sm">Setup</button>
              </div>
              <div className="security-item">
                <div className="security-info">
                  <span className="security-label">{t('profile.passkey')}</span>
                  <span className="security-status">Not configured</span>
                </div>
                <button className="btn-ghost-sm">Setup</button>
              </div>
            </div>
          </div>

          <div className="profile-section">
            <div className="section-header">
              <Key size={16} />
              <h2 className="section-subtitle">{t('common.affiliate')}</h2>
            </div>
            <div className="aff-info">
              <div className="aff-row">
                <span className="aff-label">{t('common.code')}</span>
                <div className="aff-value-group">
                  <code className="aff-code">{user?.aff_code || '-'}</code>
                  <button className="btn-icon" onClick={() => handleCopy(user?.aff_code || '')}>
                    {copied ? <CheckCircle size={14} style={{ color: 'var(--accent)' }} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              {affLink && (
                <div className="aff-row">
                  <span className="aff-label"><Link2 size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{t('common.link')}</span>
                  <code className="aff-link">{affLink}</code>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .profile-page { display: flex; flex-direction: column; gap: 24px; }

        .page-header {
          display: flex; align-items: center; justify-content: space-between;
          padding-bottom: 20px; border-bottom: 1px solid var(--line);
        }
        .page-title {
          font-family: var(--sans); font-size: 22px; font-weight: 700;
          letter-spacing: -0.02em;
        }

        .profile-grid {
          display: grid; gap: 20px;
        }
        @media (min-width: 768px) {
          .profile-grid { grid-template-columns: 1fr 340px; }
        }

        .profile-section {
          background: var(--surface); border: 1px solid var(--line);
          border-radius: 6px; padding: 20px;
        }

        .section-header {
          display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
          color: var(--accent);
        }
        .section-subtitle {
          font-family: var(--mono); font-size: 13px; font-weight: 700;
          letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted);
        }

        .profile-info { display: flex; flex-direction: column; gap: 0; }
        .info-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 0; border-bottom: 1px solid var(--line);
        }
        .info-row:last-child { border-bottom: none; }
        .info-label {
          font-family: var(--mono); font-size: 11px; font-weight: 600;
          color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em;
        }
        .info-value { font-size: 13px; }
        .mono-sm { font-family: var(--mono); font-size: 12px; }

        .role-badge {
          font-family: var(--mono); font-size: 10px; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase;
          padding: 3px 8px; border-radius: 3px;
          background: color-mix(in srgb, var(--accent2) 10%, transparent);
          color: var(--accent2);
        }

        .form-divider {
          height: 1px; background: var(--line); margin: 20px 0;
        }

        .form-group { margin-bottom: 14px; }
        .form-label {
          display: block; font-family: var(--mono); font-size: 11px; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted);
          margin-bottom: 6px;
        }
        .form-input {
          width: 100%; padding: 9px 12px;
          font-family: var(--mono); font-size: 13px;
          background: var(--bg); border: 1px solid var(--line);
          border-radius: 4px; color: var(--text);
          transition: border-color 0.2s;
        }
        .form-input:focus { outline: none; border-color: var(--accent); }
        .form-hint {
          display: block; font-size: 11px; color: var(--muted); margin-top: 4px;
        }

        .form-error {
          font-family: var(--mono); font-size: 12px; color: var(--danger);
          padding: 8px 12px; background: color-mix(in srgb, var(--danger) 10%, transparent);
          border-radius: 4px; margin-top: 8px;
        }
        .form-success {
          font-family: var(--mono); font-size: 12px; color: var(--accent);
          padding: 8px 12px; background: color-mix(in srgb, var(--accent) 10%, transparent);
          border-radius: 4px; margin-top: 8px;
        }

        .btn-primary {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--mono); font-size: 11px; font-weight: 700;
          letter-spacing: 0.04em; text-transform: uppercase;
          border-radius: 4px; padding: 9px 16px;
          background: var(--accent); color: var(--bg);
          transition: all 0.2s;
        }
        .btn-primary:hover { box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 30%, transparent); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .security-items { display: flex; flex-direction: column; gap: 0; }
        .security-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 0; border-bottom: 1px solid var(--line);
        }
        .security-item:last-child { border-bottom: none; }
        .security-info { display: flex; flex-direction: column; gap: 2px; }
        .security-label {
          font-size: 13px; font-weight: 600;
        }
        .security-status {
          font-family: var(--mono); font-size: 11px; color: var(--muted);
        }

        .btn-ghost-sm {
          font-family: var(--mono); font-size: 10px; font-weight: 600;
          letter-spacing: 0.04em; text-transform: uppercase;
          padding: 5px 10px; border-radius: 3px;
          border: 1px solid var(--line); color: var(--muted);
          transition: all 0.15s;
        }
        .btn-ghost-sm:hover { border-color: var(--accent); color: var(--accent); }

        .aff-info { display: flex; flex-direction: column; gap: 10px; }
        .aff-row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 10px 14px; background: var(--bg); border: 1px solid var(--line);
          border-radius: 4px;
        }
        .aff-label {
          font-family: var(--mono); font-size: 11px; font-weight: 600;
          color: var(--muted); white-space: nowrap;
        }
        .aff-value-group { display: flex; align-items: center; gap: 8px; }
        .aff-code {
          font-family: var(--mono); font-size: 13px; color: var(--accent);
        }
        .aff-link {
          font-family: var(--mono); font-size: 11px; color: var(--text);
          word-break: break-all; text-align: right;
        }
        .btn-icon {
          display: inline-flex; align-items: center; gap: 4px;
          background: none; border: none; color: var(--muted);
          padding: 4px; border-radius: 3px; cursor: pointer;
          transition: color 0.15s;
        }
        .btn-icon:hover { color: var(--text); }

        .profile-sidebar-sections { display: flex; flex-direction: column; gap: 20px; }
      `}</style>
    </div>
  )
}
