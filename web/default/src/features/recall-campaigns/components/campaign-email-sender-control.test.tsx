import * as React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import type { RecallEmailSenderStatus } from '../types'
import {
  applyRecallEmailSenderSaveFailure,
  applyRecallEmailSenderSaveSuccess,
  CampaignEmailSenderControlView,
  getRecallEmailSenderControlState,
  getRecallEmailSenderOptions,
  syncRecallEmailSenderFromServer,
} from './campaign-email-sender-control'

const testI18n = createInstance()
await testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} } },
  interpolation: { escapeValue: false },
})

function makeStatus(
  overrides: Partial<RecallEmailSenderStatus> = {}
): RecallEmailSenderStatus {
  return {
    configured_email_from: '',
    effective_email_from: 'smtp@example.com',
    uses_default: true,
    options: [
      { email: 'smtp@example.com', is_default: true },
      { email: 'alias@example.com', is_default: false },
    ],
    ...overrides,
  }
}

describe('CampaignEmailSenderControl', () => {
  test('renders the live default sender first and aliases with canonical values', () => {
    const status = makeStatus()
    const options = getRecallEmailSenderOptions(status)

    expect(options).toEqual([
      {
        label: 'Default SMTP sender (smtp@example.com)',
        value: '',
      },
      {
        label: 'alias@example.com',
        value: 'alias@example.com',
      },
    ])

    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CampaignEmailSenderControlView
          disabled={false}
          error=''
          pending={false}
          selectedEmailFrom=''
          status={status}
          onSave={() => undefined}
          onSelectionChange={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('Activity sender address')
    expect(html).toContain('Default SMTP sender (smtp@example.com)')
    expect(html).toContain('value="alias@example.com"')
    expect(html).toContain(
      'All Activity Configuration campaigns share this sender. Other system emails are unaffected.'
    )
    expect(html).toContain('Save sender address')
  })

  test('shows a load error without crashing when no sender status is available', () => {
    expect(getRecallEmailSenderControlState(undefined, false, true)).toEqual({
      disabled: true,
      loadError: true,
    })
    expect(getRecallEmailSenderControlState(makeStatus(), false, true)).toEqual(
      {
        disabled: false,
        loadError: false,
      }
    )

    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CampaignEmailSenderControlView
          disabled={true}
          error='Failed to load sender addresses.'
          pending={false}
          selectedEmailFrom=''
          status={makeStatus()}
          onSave={() => undefined}
          onSelectionChange={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('Failed to load sender addresses.')
  })

  test('lets pristine selection follow configured server state on refetch', () => {
    expect(syncRecallEmailSenderFromServer('', '', makeStatus())).toEqual({
      confirmedEmailFrom: '',
      error: '',
      selectedEmailFrom: '',
    })

    expect(
      syncRecallEmailSenderFromServer(
        '',
        '',
        makeStatus({
          configured_email_from: 'alias@example.com',
          effective_email_from: 'alias@example.com',
          uses_default: false,
        })
      )
    ).toEqual({
      confirmedEmailFrom: 'alias@example.com',
      error: '',
      selectedEmailFrom: 'alias@example.com',
    })
  })

  test('preserves a dirty alias that still exists during refetch', () => {
    expect(
      syncRecallEmailSenderFromServer(
        'alias@example.com',
        '',
        makeStatus({ configured_email_from: '' })
      )
    ).toEqual({
      confirmedEmailFrom: '',
      error: '',
      selectedEmailFrom: 'alias@example.com',
    })
  })

  test('rolls back a dirty disappeared alias and surfaces a choices-changed error', () => {
    expect(
      syncRecallEmailSenderFromServer(
        'missing@example.com',
        '',
        makeStatus({ configured_email_from: '' })
      )
    ).toEqual({
      confirmedEmailFrom: '',
      error: 'Sender address choices changed. Review and save again.',
      selectedEmailFrom: '',
    })
  })

  test('save success confirms the returned normalized sender status', () => {
    const nextStatus = makeStatus({
      configured_email_from: 'alias@example.com',
      effective_email_from: 'alias@example.com',
      uses_default: false,
    })

    expect(applyRecallEmailSenderSaveSuccess(nextStatus)).toEqual({
      confirmedEmailFrom: 'alias@example.com',
      selectedEmailFrom: 'alias@example.com',
    })
  })

  test('save failure rolls back to the confirmed sender and keeps server error copy', () => {
    expect(
      applyRecallEmailSenderSaveFailure('', 'Server rejected sender')
    ).toEqual({
      error: 'Server rejected sender',
      selectedEmailFrom: '',
    })
    expect(applyRecallEmailSenderSaveFailure('', '')).toEqual({
      error: 'Failed to update sender address.',
      selectedEmailFrom: '',
    })
  })

  test('recall campaign actions compose sender and hourly controls as independent settings before create', () => {
    const source = readFileSync(
      resolve(import.meta.dir, '..', 'index.tsx'),
      'utf8'
    )
    const senderIndex = source.indexOf('<CampaignEmailSenderControl />')
    const hourlyIndex = source.indexOf('<CampaignEmailHourlyLimitControl />')
    const createIndex = source.indexOf("t('Create activity configuration')")

    expect(source).toContain("className='flex flex-wrap items-end gap-2'")
    expect(senderIndex).toBeGreaterThan(-1)
    expect(hourlyIndex).toBeGreaterThan(senderIndex)
    expect(createIndex).toBeGreaterThan(hourlyIndex)
  })
})
