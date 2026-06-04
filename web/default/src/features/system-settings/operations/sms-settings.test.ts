import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { buildSmsSettingsUpdates } from './sms-settings'

describe('buildSmsSettingsUpdates', () => {
  test('builds updates for changed SMS settings', () => {
    const updates = buildSmsSettingsUpdates(
      {
        SMSEnabled: true,
        SMSProvider: 'smsbao',
        SMSBaoCredential: '',
      },
      {
        SMSEnabled: false,
        SMSProvider: 'smsbao',
        SMSBaoCredential: '',
      }
    )

    assert.deepEqual(updates, [{ key: 'SMSEnabled', value: true }])
  })

  test('does not overwrite SMSBaoCredential when the new credential is blank', () => {
    const updates = buildSmsSettingsUpdates(
      {
        SMSEnabled: true,
        SMSProvider: 'smsbao',
        SMSBaoCredential: '',
      },
      {
        SMSEnabled: true,
        SMSProvider: 'smsbao',
        SMSBaoCredential: 'existing-redacted-value',
      }
    )

    assert.deepEqual(updates, [])
  })

  test('updates SMSBaoCredential when a new credential is provided', () => {
    const updates = buildSmsSettingsUpdates(
      {
        SMSEnabled: true,
        SMSProvider: 'smsbao',
        SMSBaoCredential: 'new-redacted-value',
      },
      {
        SMSEnabled: true,
        SMSProvider: 'smsbao',
        SMSBaoCredential: '',
      }
    )

    assert.deepEqual(updates, [
      { key: 'SMSBaoCredential', value: 'new-redacted-value' },
    ])
  })

  test('updates the unified SMS template field', () => {
    const updates = buildSmsSettingsUpdates(
      {
        SMSTemplate: ' {product} 验证码 {code} ',
      },
      {
        SMSTemplate: '{product} 登录验证码 {code}',
      }
    )

    assert.deepEqual(updates, [
      { key: 'SMSTemplate', value: '{product} 验证码 {code}' },
    ])
  })
})
