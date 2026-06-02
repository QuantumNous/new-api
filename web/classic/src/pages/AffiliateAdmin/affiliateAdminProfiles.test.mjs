import { describe, expect, test } from 'bun:test';

import {
  buildAffiliateProfilePayload,
  buildAffiliateProfilesQuery,
  getAffiliateProfileStatusMeta,
  validateAffiliateProfilePayload,
} from './affiliateAdminProfiles.js';

const t = (value) => value;

describe('affiliate admin profiles helpers', () => {
  test('builds a filtered admin profiles query', () => {
    expect(
      buildAffiliateProfilesQuery({
        page: 2,
        pageSize: 20,
        filters: { user_id: '501', level: '2', status: 'active' },
      }),
    ).toBe(
      '/api/affiliate/admin/profiles?p=2&page_size=20&user_id=501&level=2&status=active',
    );
  });

  test('normalizes level one and level two profile payloads', () => {
    expect(
      buildAffiliateProfilePayload({
        user_id: '501',
        level: '1',
        parent_user_id: '999',
        invite_code: ' aff501 ',
        reason: ' create ',
      }),
    ).toEqual({
      user_id: 501,
      level: 1,
      parent_user_id: 0,
      invite_code: 'aff501',
      reason: 'create',
    });

    expect(
      buildAffiliateProfilePayload({
        user_id: '502',
        level: '2',
        parent_user_id: '501',
      }),
    ).toMatchObject({
      user_id: 502,
      level: 2,
      parent_user_id: 501,
    });
  });

  test('validates second level parent requirements', () => {
    expect(
      validateAffiliateProfilePayload(t, {
        user_id: 502,
        level: 2,
        parent_user_id: 0,
      }),
    ).toBe('二级分销商必须填写一级上级用户 ID');

    expect(
      validateAffiliateProfilePayload(t, {
        user_id: 502,
        level: 2,
        parent_user_id: 502,
      }),
    ).toBe('二级分销商上级不能是自己');
  });

  test('maps status labels without exposing backend errors', () => {
    expect(getAffiliateProfileStatusMeta(t, 'active')).toEqual({
      label: '启用',
      type: 'success',
    });
    expect(getAffiliateProfileStatusMeta(t, 'disabled')).toEqual({
      label: '禁用',
      type: 'danger',
    });
  });
});
