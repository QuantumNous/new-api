import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { TFunction } from 'i18next'
import {
  getDashboardSectionNavItems,
  isDashboardSectionAllowed,
} from './section-registry'

const t = ((key: string) => key) as TFunction

describe('dashboard section permissions', () => {
  test('hides Codex limits from non-admin navigation', () => {
    const items = getDashboardSectionNavItems(t, { isAdmin: false })
    assert.equal(
      items.some((item) => item.url === '/dashboard/codex-limits'),
      false
    )
  })

  test('allows direct Codex limits access only for admins', () => {
    assert.equal(isDashboardSectionAllowed('codex-limits', false), false)
    assert.equal(isDashboardSectionAllowed('codex-limits', true), true)
    assert.equal(isDashboardSectionAllowed('models', false), true)
  })
})
