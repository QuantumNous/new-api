import { describe, expect, test } from 'bun:test';

import {
  buildAffiliateInviterCandidatesQuery,
  buildAffiliateInviterPreviewQuery,
  buildAffiliateInviterUpdateUrl,
  buildAffiliateInviterUpdatePayload,
  formatAffiliateInviterPath,
  validateAffiliateInviterChange,
} from './affiliateInviterManagement.js';

const t = (value) => value;

describe('affiliate inviter management helpers', () => {
  test('builds candidate and preview queries with normalized inputs', () => {
    expect(
      buildAffiliateInviterCandidatesQuery({
        keyword: ' alice ',
        page: 2,
        pageSize: 20,
      }),
    ).toBe(
      '/api/affiliate/admin/inviter-candidates?keyword=alice&p=2&page_size=20',
    );

    expect(buildAffiliateInviterPreviewQuery(501, ' 601 ')).toBe(
      '/api/affiliate/admin/users/501/inviter/preview?new_inviter_user_id=601',
    );
  });

  test('normalizes update payload and allows clearing inviter with zero', () => {
    expect(buildAffiliateInviterUpdateUrl(' 501 ')).toBe(
      '/api/affiliate/admin/users/501/inviter',
    );

    expect(
      buildAffiliateInviterUpdatePayload({
        newInviterUserId: ' 0 ',
        reason: ' clear broken relation ',
      }),
    ).toEqual({
      new_inviter_user_id: 0,
      reason: 'clear broken relation',
    });
  });

  test('validates missing target and self inviter changes before calling API', () => {
    expect(validateAffiliateInviterChange(t, 0, 601)).toBe('用户信息缺失');
    expect(validateAffiliateInviterChange(t, 501, 501)).toBe(
      '邀请人不能是目标用户自己',
    );
    expect(validateAffiliateInviterChange(t, 501, 0)).toBe('');
  });

  test('formats preview paths for compact display', () => {
    expect(formatAffiliateInviterPath(t, [601, 301, 1])).toBe(
      '601 -> 301 -> 1',
    );
    expect(formatAffiliateInviterPath(t, [])).toBe('无');
  });
});
