import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  buildAffiliateInviterCandidatesQuery,
  buildAffiliateInviterPreviewQuery,
  buildAffiliateInviterUpdatePayload,
  buildAffiliateInviterUpdateUrl,
  formatAffiliateInviterCandidateLabel,
  formatAffiliateInviterPath,
  validateAffiliateInviterChange,
} from './affiliate-inviter'

const t = (key: string) => key

describe('default user affiliate inviter helpers', () => {
  test('builds candidate and preview queries with normalized inputs', () => {
    assert.equal(
      buildAffiliateInviterCandidatesQuery({
        keyword: ' alice ',
        page: 2,
        pageSize: 20,
      }),
      '/api/affiliate/admin/inviter-candidates?keyword=alice&p=2&page_size=20'
    )

    assert.equal(
      buildAffiliateInviterPreviewQuery(501, ' 601 '),
      '/api/affiliate/admin/users/501/inviter/preview?new_inviter_user_id=601'
    )
  })

  test('builds update url and payload while allowing clear-to-zero', () => {
    assert.equal(
      buildAffiliateInviterUpdateUrl(' 501 '),
      '/api/affiliate/admin/users/501/inviter'
    )

    assert.deepEqual(
      buildAffiliateInviterUpdatePayload({
        newInviterUserId: ' 0 ',
        reason: ' clear broken relation ',
      }),
      {
        new_inviter_user_id: 0,
        reason: 'clear broken relation',
      }
    )
  })

  test('validates missing target and self inviter changes before calling API', () => {
    assert.equal(validateAffiliateInviterChange(0, 601, t), 'User is missing')
    assert.equal(
      validateAffiliateInviterChange(501, 501, t),
      'Inviter cannot be the target user'
    )
    assert.equal(validateAffiliateInviterChange(501, 0, t), '')
  })

  test('formats paths and candidate labels for compact display', () => {
    assert.equal(
      formatAffiliateInviterPath([601, 301, 1], t),
      '601 -> 301 -> 1'
    )
    assert.equal(formatAffiliateInviterPath([], t), 'None')
    assert.equal(
      formatAffiliateInviterCandidateLabel({
        id: 601,
        username: 'alice',
        display_name: 'Alice',
        email: 'alice@example.test',
      }),
      '#601 alice (Alice) alice@example.test'
    )
  })
})
