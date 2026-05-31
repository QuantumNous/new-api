import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useI18n } from '../i18n'
import { api } from '../lib/api'

const SECTIONS = ['site', 'auth', 'billing', 'content', 'models', 'operations', 'security'] as const
type Section = (typeof SECTIONS)[number]

const SECTION_KEY_MAP: Record<Section, string[]> = {
  site: [
    'SystemName', 'ServerAddress', 'Logo', 'FooterHTML', 'Announcements',
    'HeaderNavModules', 'SidebarModules', 'Theme',
  ],
  auth: [
    'PasswordLoginEnabled', 'PasswordRegisterEnabled', 'EmailVerificationEnabled',
    'GitHubOAuthEnabled', 'DiscordOAuthEnabled', 'OIDCOAuthEnabled',
    'LinuxDOOAuthEnabled', 'TelegramOAuthEnabled', 'WeChatOAuthEnabled',
    'PasskeyLoginEnabled', 'TurnstileCheckEnabled', 'TurnstileSiteKey',
    'TurnstileSecretKey', 'RegisterEnabled',
  ],
  billing: [
    'QuotaForNewUser', 'QuotaForInviter', 'QuotaForInvitee',
    'PreConsumedQuota', 'QuotaRemindThreshold', 'GroupRatio',
    'SubscriptionEnabled', 'CheckinEnabled', 'CustomCurrencySymbol',
    'CustomCurrencyExchangeRate',
  ],
  content: [
    'AboutHTML', 'PricingEnabled', 'RankingsEnabled',
  ],
  models: [
    'ModelRatio', 'CompletionRatio', 'CacheRatio',
    'GroupRatio', 'ModelPrice', 'ModelPriceExt',
  ],
  operations: [
    'EmailDomainWhitelist', 'EmailDomainBlacklist',
    'NotifyType', 'SMTPServer', 'SMTPPort', 'SMTPAccount',
    'SMTPToken', 'SMTPFrom', 'TelegramBotToken', 'TelegramChatID',
  ],
  security: [
    'MemoryCacheEnabled', 'SyncFrequency', 'BatchUpdateInterval',
    'BatchUpdateEnabled', 'SensitiveWords', 'SelfUseModeEnabled',
    'DemoSiteEnabled', 'DisableChannelBalanceUpdates',
  ],
}

export function Settings() {
  const { section: rawSection } = useParams()
  const nav = useNavigate()
  const { t } = useI18n()

  const section = (SECTIONS.includes(rawSection as Section) ? rawSection : 'site') as Section
  const [options, setOptions] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get<Record<string, string>>('/api/option/')
      .then((data) => {
        setOptions(data || {})
      })
      .catch(() => setOptions({}))
      .finally(() => setLoading(false))
  }, [])

  function handleChange(key: string, value: string) {
    setOptions((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const keys = SECTION_KEY_MAP[section]
      const payload: Record<string, string> = {}
      for (const k of keys) {
        payload[k] = options[k] ?? ''
      }
      await api.put('/api/option/', payload)
      setSaved(true)
    } catch {
      // error handled silently
    }
    setSaving(false)
  }

  return (
    <div className="settings-layout">
      <aside className="settings-sidebar">
        <div className="settings-sidebar-title">{t('settings.title')}</div>
        {SECTIONS.map((s) => (
          <button
            key={s}
            className={`settings-sidebar-item ${s === section ? 'active' : ''}`}
            onClick={() => nav(`/settings/${s}`)}
          >
            {t(`settings.${s}`)}
          </button>
        ))}
      </aside>

      <main className="settings-main">
        <div className="settings-header">
          <h1 className="page-title">{t(`settings.${section}`)}</h1>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '...' : t('settings.save')}
          </button>
        </div>

        {saved && (
          <div className="settings-saved-msg">Saved.</div>
        )}

        {loading ? (
          <div className="page-loading"><div className="spinner" /></div>
        ) : (
          <div className="settings-form">
            {SECTION_KEY_MAP[section].map((key) => (
              <div key={key} className="settings-field">
                <label className="settings-field-label">{key}</label>
                {options[key]?.length > 100 ? (
                  <textarea
                    className="settings-field-textarea"
                    value={options[key] ?? ''}
                    onChange={(e) => handleChange(key, e.target.value)}
                    rows={6}
                  />
                ) : (
                  <input
                    type="text"
                    className="settings-field-input"
                    value={options[key] ?? ''}
                    onChange={(e) => handleChange(key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
