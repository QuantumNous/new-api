import { describe, expect, test } from 'bun:test';

import {
  buildAffiliateSectionErrorState,
  buildAffiliateStatusLoadingState,
} from './affiliateViewState.js';

const t = (value) => `t:${value}`;

describe('affiliate page section view states', () => {
  test('builds a clear status loading state', () => {
    const state = buildAffiliateStatusLoadingState(t);

    expect(state.title).toBe('t:正在加载分销状态');
    expect(state.description).toBe('t:请稍候，正在确认分销权限和数据范围。');
    expect(state.actionLabel).toBe('');
  });

  test('builds a scoped logs error state with retry action', () => {
    const state = buildAffiliateSectionErrorState(t, {
      section: 'logs',
      retryable: true,
    });

    expect(state.title).toBe('t:分销明细加载失败');
    expect(state.description).toBe(
      't:当前分区渲染出错，其他分销信息不受影响。',
    );
    expect(state.actionLabel).toBe('t:重新加载明细');
  });

  test('builds a generic non-retryable section error state', () => {
    const state = buildAffiliateSectionErrorState(t, {
      section: 'unknown',
      retryable: false,
    });

    expect(state.title).toBe('t:分销分区加载失败');
    expect(state.description).toBe(
      't:当前分区渲染出错，其他分销信息不受影响。',
    );
    expect(state.actionLabel).toBe('');
  });
});
