import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import {
  CodexIdentitySettingsSection,
  buildCodexIdentityOptionUpdates,
  formatSyncTime,
  type CodexIdentityFormValues,
} from './codex-identity-settings-section'

const i18n = createInstance()

const defaultValues: CodexIdentityFormValues = {
  CodexClientUserAgent: 'codex-cli/0.144.0 linux-x64',
  CodexClientVersion: '',
  CodexSyncedClientVersion: '0.144.6',
  CodexSyncedClientVersionAt: '1787200000',
  CodexAutoSyncClientVersion: true,
  CodexEnforceClientIdentity: true,
}

describe('Codex identity settings', () => {
  beforeAll(async () => {
    await i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      resources: { en: { translation: {} } },
      interpolation: { escapeValue: false },
    })
  })

  test('saves editable Codex identity options without mutating synced fields', () => {
    const updates = buildCodexIdentityOptionUpdates(defaultValues, {
      ...defaultValues,
      CodexClientUserAgent: ' codex-cli/0.144.0 darwin-arm64 ',
      CodexClientVersion: ' 0.145.1 ',
      CodexSyncedClientVersion: '9.999.9',
      CodexSyncedClientVersionAt: '1999999999',
      CodexAutoSyncClientVersion: false,
      CodexEnforceClientIdentity: false,
    })

    expect(updates).toEqual([
      {
        key: 'CodexClientUserAgent',
        value: 'codex-cli/0.144.0 darwin-arm64',
      },
      { key: 'CodexClientVersion', value: '0.145.1' },
      { key: 'CodexAutoSyncClientVersion', value: 'false' },
      { key: 'CodexEnforceClientIdentity', value: 'false' },
    ])
  })

  test('renders synced fields read-only and includes deployment guidance', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={new QueryClient()}>
          <CodexIdentitySettingsSection defaultValues={defaultValues} />
        </QueryClientProvider>
      </I18nextProvider>
    )

    expect(html).toContain('Codex Identity')
    expect(html).toContain('0.144.0')
    expect(html).toContain('six hours')
    expect(html).toContain('kill switch')
    expect(html).toContain('CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE')
    expect(html).toContain('readOnly')
    expect(html).not.toContain('seed')
  })

  test('formats backend RFC3339 and legacy Unix sync timestamps', () => {
    expect(formatSyncTime('2026-08-20T12:34:56Z')).toContain('2026')
    expect(formatSyncTime('1787200000')).toContain('2026')
    expect(formatSyncTime('')).toBe('')
  })
})
