import * as React from 'react'
import { describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import type { RecallActivitySMTPStatus } from '../types'
import {
  CampaignSMTPSettingsView,
  createRecallActivitySMTPFormValues,
  getRecallActivitySMTPSaveSuccessState,
  normalizeRecallActivitySMTPInput,
  recallActivitySMTPSchema,
} from './campaign-smtp-settings'

const testI18n = createInstance()
await testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} } },
  interpolation: { escapeValue: false },
})

function makeStatus(
  overrides: Partial<RecallActivitySMTPStatus> = {}
): RecallActivitySMTPStatus {
  return {
    server: 'smtp.example.com',
    port: 587,
    account: 'activity-user',
    email_from: 'activity@example.com',
    ssl_enabled: false,
    force_auth_login: true,
    token_configured: true,
    configured: true,
    ...overrides,
  }
}

describe('CampaignSMTPSettings', () => {
  test('initializes all SMTP form fields from redacted status and keeps token blank', () => {
    expect(createRecallActivitySMTPFormValues(makeStatus())).toEqual({
      server: 'smtp.example.com',
      port: 587,
      account: 'activity-user',
      email_from: 'activity@example.com',
      token: '',
      ssl_enabled: false,
      force_auth_login: true,
    })

    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CampaignSMTPSettingsView
          disabled={false}
          error=''
          fieldErrors={{}}
          pending={false}
          status={makeStatus()}
          success=''
          values={createRecallActivitySMTPFormValues(makeStatus())}
          onFieldChange={() => undefined}
          onSave={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('Activity SMTP settings')
    expect(html).toContain('Configured')
    expect(html).toContain('value="smtp.example.com"')
    expect(html).toContain('type="password"')
    expect(html).not.toContain('real password')
  })

  test('renders not configured state and requires first-save token', () => {
    const status = makeStatus({
      server: '',
      account: '',
      email_from: '',
      token_configured: false,
      configured: false,
    })
    const validation = recallActivitySMTPSchema(status).safeParse({
      server: 'smtp.example.com',
      port: 587,
      account: 'activity-user',
      email_from: 'activity@example.com',
      token: '   ',
      ssl_enabled: false,
      force_auth_login: true,
    })

    expect(validation.success).toBe(false)
    expect(
      validation.error?.issues.some((issue) => issue.path[0] === 'token')
    ).toBe(true)

    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CampaignSMTPSettingsView
          disabled={false}
          error=''
          fieldErrors={{}}
          pending={false}
          status={status}
          success=''
          values={createRecallActivitySMTPFormValues(status)}
          onFieldChange={() => undefined}
          onSave={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('Not configured')
  })

  test('validates port range, integer shape, required host/account, and plain mailbox sender', () => {
    const valid = {
      server: 'smtp.example.com',
      port: 587,
      account: 'activity-user',
      email_from: 'activity@example.com',
      token: '',
      ssl_enabled: false,
      force_auth_login: true,
    }

    for (const invalid of [
      { ...valid, port: 0 },
      { ...valid, port: 65536 },
      { ...valid, port: 25.5 },
      { ...valid, server: '   ' },
      { ...valid, account: '   ' },
      { ...valid, email_from: 'Activity <activity@example.com>' },
      { ...valid, email_from: 'activity@example.com\r\nbcc:x@example.com' },
      { ...valid, email_from: 'not-an-email' },
    ]) {
      expect(recallActivitySMTPSchema(makeStatus()).safeParse(invalid).success)
        .toBe(false)
    }
  })

  test('normalizes submit input while preserving meaningful token bytes', () => {
    expect(
      normalizeRecallActivitySMTPInput({
        server: ' smtp.example.com ',
        port: 465,
        account: ' activity-user ',
        email_from: ' activity@example.com ',
        token: '  exact password bytes  ',
        ssl_enabled: true,
        force_auth_login: false,
      })
    ).toEqual({
      server: 'smtp.example.com',
      port: 465,
      account: 'activity-user',
      email_from: 'activity@example.com',
      token: '  exact password bytes  ',
      ssl_enabled: true,
      force_auth_login: false,
    })

    expect(
      normalizeRecallActivitySMTPInput({
        server: 'smtp.example.com',
        port: 587,
        account: 'activity-user',
        email_from: 'activity@example.com',
        token: '   ',
        ssl_enabled: false,
        force_auth_login: true,
      }).token
    ).toBe('')
  })

  test('failed save renders backend error inline and retains entered values', () => {
    const values = {
      server: ' smtp.example.com ',
      port: 2525,
      account: ' admin ',
      email_from: ' activity@example.com ',
      token: '  typed secret  ',
      ssl_enabled: true,
      force_auth_login: false,
    }
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CampaignSMTPSettingsView
          disabled={false}
          error='Backend rejected SMTP settings'
          fieldErrors={{}}
          pending={false}
          status={makeStatus()}
          success=''
          values={values}
          onFieldChange={() => undefined}
          onSave={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('Backend rejected SMTP settings')
    expect(html).toContain('value=" smtp.example.com "')
    expect(html).toContain('value=" admin "')
    expect(html).toContain('value=" activity@example.com "')
    expect(html).toContain('value="  typed secret  "')
    expect(html).toContain('checked=""')
  })

  test('successful save updates status and resets only the password input', () => {
    const nextStatus = makeStatus({
      server: 'smtp.saved.example.com',
      token_configured: true,
      configured: true,
    })

    expect(getRecallActivitySMTPSaveSuccessState(nextStatus)).toEqual({
      values: {
        server: 'smtp.saved.example.com',
        port: 587,
        account: 'activity-user',
        email_from: 'activity@example.com',
        token: '',
        ssl_enabled: false,
        force_auth_login: true,
      },
      status: nextStatus,
      success: 'Activity SMTP settings saved.',
    })
  })
})
