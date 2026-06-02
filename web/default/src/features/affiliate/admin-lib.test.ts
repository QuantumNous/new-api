import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  buildAffiliateProfilePayload,
  buildAffiliateProfilesQuery,
  getAffiliateProfileLevelLabel,
  getAffiliateProfileStatusMeta,
  validateAffiliateProfilePayload,
} from './admin-lib'

const t = (key: string) => key

describe('default affiliate admin profiles helpers', () => {
  test('builds a filtered admin profiles query', () => {
    assert.equal(
      buildAffiliateProfilesQuery({
        page: 2,
        pageSize: 20,
        filters: { userId: '501', level: '2', status: 'active' },
      }),
      '/api/affiliate/admin/profiles?p=2&page_size=20&user_id=501&level=2&status=active'
    )
  })

  test('normalizes level one and level two profile payloads', () => {
    assert.deepEqual(
      buildAffiliateProfilePayload({
        userId: '501',
        level: '1',
        parentUserId: '999',
        inviteCode: ' aff501 ',
        reason: ' create ',
      }),
      {
        user_id: 501,
        level: 1,
        parent_user_id: 0,
        invite_code: 'aff501',
        reason: 'create',
      }
    )

    assert.deepEqual(
      buildAffiliateProfilePayload({
        userId: '502',
        level: '2',
        parentUserId: '501',
      }),
      {
        user_id: 502,
        level: 2,
        parent_user_id: 501,
        invite_code: '',
        reason: '',
      }
    )
  })

  test('validates second level parent requirements', () => {
    assert.equal(
      validateAffiliateProfilePayload(
        {
          user_id: 502,
          level: 2,
          parent_user_id: 0,
          invite_code: '',
          reason: '',
        },
        t
      ),
      'Second-level affiliate requires a level-one parent user ID'
    )

    assert.equal(
      validateAffiliateProfilePayload(
        {
          user_id: 502,
          level: 2,
          parent_user_id: 502,
          invite_code: '',
          reason: '',
        },
        t
      ),
      'Second-level affiliate parent cannot be itself'
    )
  })

  test('maps level and status labels', () => {
    assert.equal(getAffiliateProfileLevelLabel(1, t), 'Level-one affiliate')
    assert.equal(getAffiliateProfileLevelLabel(2, t), 'Level-two affiliate')
    assert.deepEqual(getAffiliateProfileStatusMeta('active', t), {
      label: 'Active',
      variant: 'success',
    })
    assert.deepEqual(getAffiliateProfileStatusMeta('disabled', t), {
      label: 'Disabled',
      variant: 'danger',
    })
  })
})
