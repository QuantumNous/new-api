import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')

beforeAll(() => {
  const script = readFileSync(
    join(repoRoot, 'public/connect.js'),
    'utf8'
  )
  // connect.js is a browser IIFE; eval mirrors how /desktop/connect loads it.
  // eslint-disable-next-line no-eval
  eval(script)
})

describe('YeschoyConnect.normalizeIssueReasonCode', () => {
  it('maps AUTH_UNAUTHORIZED to session_required', () => {
    expect(
      window.YeschoyConnect.normalizeIssueReasonCode('AUTH_UNAUTHORIZED', 401)
    ).toBe('session_required')
  })

  it('maps bare 401 to session_required', () => {
    expect(window.YeschoyConnect.normalizeIssueReasonCode('', 401)).toBe(
      'session_required'
    )
  })

  it('keeps unrelated errors', () => {
    expect(
      window.YeschoyConnect.normalizeIssueReasonCode('issue_failed', 503)
    ).toBe('issue_failed')
  })
})
