import { describe, expect, test } from 'bun:test'
import {
  isRecallSpecifiedEmail,
  mergeRecallAudienceUserOptions,
  parseRecallSpecifiedEmails,
  recallLocalDateTimeToUnix,
  recallUnixToLocalDateTime,
} from './audience-inputs'
import type { RecallAudienceUserOption } from './types'

function makeUser(
  id: number,
  overrides: Partial<RecallAudienceUserOption> = {}
): RecallAudienceUserOption {
  return {
    id,
    username: `user-${id}`,
    display_name: `User ${id}`,
    email: `user-${id}@example.com`,
    status: 1,
    ...overrides,
  }
}

describe('recall audience input helpers', () => {
  test('parses comma and newline separated emails with stable lowercase dedupe', () => {
    expect(
      parseRecallSpecifiedEmails('A@Example.com, b@example.com\nA@example.com')
    ).toEqual({
      emails: ['a@example.com', 'b@example.com'],
      invalid: [],
    })
  })

  test('reports invalid tokens while handling CRLF and stable dedupe', () => {
    expect(
      parseRecallSpecifiedEmails(
        ' good@example.com\r\nbad-email, GOOD@example.com,\nmissing@domain'
      )
    ).toEqual({
      emails: ['good@example.com'],
      invalid: ['bad-email', 'missing@domain'],
    })
  })

  test('rejects mailbox forms that backend address equality rejects', () => {
    const invalidEmails = [
      'a..b@example.com',
      'a@example..com',
      'a@example.com.',
      'Alice <a@example.com>',
      'a@example.com (Alice)',
      'a@example.com; b@example.com',
      'a@-example.com',
      'a@example-.com',
    ]

    expect(parseRecallSpecifiedEmails(invalidEmails.join('\n'))).toEqual({
      emails: [],
      invalid: invalidEmails.map((email) => email.toLowerCase()),
    })
    for (const email of invalidEmails) {
      expect(isRecallSpecifiedEmail(email.toLowerCase())).toBe(false)
    }
  })

  test('accepts common specified email local punctuation and plus tags', () => {
    const input = "User+tag@example.com, first.last_o'hara@example.co.uk"

    expect(parseRecallSpecifiedEmails(input)).toEqual({
      emails: ['user+tag@example.com', "first.last_o'hara@example.co.uk"],
      invalid: [],
    })
  })

  test('converts local datetime values to Unix seconds at minute precision', () => {
    expect(recallUnixToLocalDateTime(0)).toBe('')
    expect(recallUnixToLocalDateTime(-1)).toBe('')
    expect(recallLocalDateTimeToUnix('')).toBe(0)
    expect(recallLocalDateTimeToUnix('not-a-date')).toBe(0)

    const timestamp = recallLocalDateTimeToUnix('2030-01-02T03:04')

    expect(timestamp).toBeGreaterThan(0)
    expect(recallUnixToLocalDateTime(timestamp)).toBe('2030-01-02T03:04')
  })

  test('rejects non-exact and calendar-normalized local datetime values', () => {
    expect(recallLocalDateTimeToUnix('2030-01-02T03:04:05')).toBe(0)
    expect(recallLocalDateTimeToUnix('2030-01-02 03:04')).toBe(0)
    expect(recallLocalDateTimeToUnix('2026-02-30T10:00')).toBe(0)
  })

  test('merges selected users before search options and dedupes by id', () => {
    const selected = [
      makeUser(2, { display_name: 'Selected Two' }),
      makeUser(1, { display_name: 'Selected One' }),
    ]
    const search = [
      makeUser(1, { display_name: 'Search One' }),
      makeUser(3, { display_name: 'Search Three' }),
    ]

    expect(mergeRecallAudienceUserOptions(selected, search)).toEqual([
      selected[0],
      selected[1],
      search[1],
    ])
  })
})
