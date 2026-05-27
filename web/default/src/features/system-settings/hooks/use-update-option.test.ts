import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { shouldInvalidateStatusForOption } from './status-invalidation.ts'

describe('shouldInvalidateStatusForOption', () => {
  test('invalidates public status when dashboard content settings change', () => {
    assert.equal(
      shouldInvalidateStatusForOption('console_setting.announcements'),
      true
    )
    assert.equal(
      shouldInvalidateStatusForOption('console_setting.api_info'),
      true
    )
    assert.equal(shouldInvalidateStatusForOption('console_setting.faq'), true)
    assert.equal(
      shouldInvalidateStatusForOption('console_setting.announcements_enabled'),
      true
    )
  })

  test('keeps existing frontend status invalidation rules', () => {
    assert.equal(shouldInvalidateStatusForOption('theme.frontend'), true)
    assert.equal(shouldInvalidateStatusForOption('Notice'), true)
  })

  test('does not invalidate status for unrelated settings', () => {
    assert.equal(shouldInvalidateStatusForOption('ModelRatio'), false)
  })
})
