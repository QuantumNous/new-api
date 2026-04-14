import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDashboardSubscriptionPopoverRows,
  buildDashboardSubscriptionPopoverRowsFromPayload,
  buildDashboardSubscriptionDisplayFromPayload,
  buildDashboardSubscriptionSummaryFromPayload,
  buildDashboardSubscriptionSummaryViewModel,
  buildDashboardSubscriptionTriggerText,
  formatDashboardSubscriptionAmount,
  formatDashboardSubscriptionResetTime,
  getDashboardSubscriptionTranslator,
  shouldShowDashboardSubscriptionTriggerTitle,
} from './dashboardSubscriptionSummary.js';

test('formats usd quota amounts compactly', () => {
  assert.equal(formatDashboardSubscriptionAmount(80), '$80.00');
  assert.equal(formatDashboardSubscriptionAmount(2.3), '$2.30');
  assert.equal(formatDashboardSubscriptionAmount(2.35), '$2.35');
  assert.equal(formatDashboardSubscriptionAmount(0), '$0.00');
});

test('falls back to identity translator when translation function is missing', () => {
  const fallbackTranslate = getDashboardSubscriptionTranslator();
  assert.equal(fallbackTranslate('主订阅'), '主订阅');

  const customTranslate = getDashboardSubscriptionTranslator((value) => `x:${value}`);
  assert.equal(customTranslate('活跃订阅'), 'x:活跃订阅');
});

test('builds trigger text without directly exposing reset time', () => {
  assert.equal(
    buildDashboardSubscriptionTriggerText({
      titleText: 'Max 月订阅',
      badgeText: 'MAX',
      quotaText: '$2.30 / $80.00',
      resetText: '04-15 00:00 刷新',
      extraText: '+2',
    }),
    '$2.30 / $80.00 · +2',
  );

  assert.equal(
    buildDashboardSubscriptionTriggerText({
      titleText: 'Daily',
      badgeText: 'DAILY',
      quotaText: '$1.00 / $5.00',
      extraText: '',
    }),
    '$1.00 / $5.00',
  );
});

test('builds a styled summary view model with badge, exact amounts and progress', () => {
  const vm = buildDashboardSubscriptionSummaryViewModel(
    {
      plan: {
        title: 'Max 月订阅',
      },
      subscription: {
        amount_used: 23,
        amount_total: 800,
        next_reset_time: Date.UTC(2026, 3, 15, 0, 0, 0) / 1000,
      },
    },
    {
      quotaPerUnit: 10,
      extraCount: 2,
      timeZone: 'UTC',
    },
  );

  assert.equal(
    vm.summaryText,
    'Max 月订阅 $2.30 / $80.00 · 04-15 00:00 刷新 · +2',
  );
  assert.equal(vm.titleText, 'Max 月订阅');
  assert.equal(vm.badgeText, 'MAX');
  assert.equal(vm.usedAmountText, '$2.30');
  assert.equal(vm.totalAmountText, '$80.00');
  assert.equal(vm.quotaText, '$2.30 / $80.00');
  assert.equal(vm.resetText, '04-15 00:00 刷新');
  assert.equal(vm.extraText, '+2');
  assert.equal(vm.showProgress, true);
  assert.equal(vm.progressPercent, 2.875);
  assert.equal(vm.displayProgressPercent, 2.875);
});

test('ensures tiny positive usage still has a visible progress width', () => {
  const vm = buildDashboardSubscriptionSummaryViewModel(
    {
      plan: {
        title: 'Max',
      },
      subscription: {
        amount_used: 1,
        amount_total: 8000,
        next_reset_time: Date.UTC(2026, 3, 15, 0, 0, 0) / 1000,
      },
    },
    {
      quotaPerUnit: 100,
      timeZone: 'UTC',
    },
  );

  assert.equal(vm.showProgress, true);
  assert.equal(vm.progressPercent, 0.0125);
  assert.equal(vm.displayProgressPercent, 2);
});

test('hides duplicated trigger title when badge already represents the plan', () => {
  assert.equal(
    shouldShowDashboardSubscriptionTriggerTitle({
      titleText: 'Max',
      badgeText: 'MAX',
    }),
    false,
  );

  assert.equal(
    shouldShowDashboardSubscriptionTriggerTitle({
      titleText: 'Max 月订阅',
      badgeText: 'MAX',
    }),
    false,
  );
});

test('builds a summary from subscription self payload with derived extra count', () => {
  const vm = buildDashboardSubscriptionSummaryFromPayload(
    {
      primary_subscription: {
        plan: {
          title: 'Max',
        },
        subscription: {
          amount_used: 23,
          amount_total: 800,
          next_reset_time: Date.UTC(2026, 3, 15, 0, 0, 0) / 1000,
        },
      },
      active_subscription_count: 3,
    },
    {
      quotaPerUnit: 10,
      timeZone: 'UTC',
    },
  );

  assert.equal(vm.summaryText, 'Max $2.30 / $80.00 · 04-15 00:00 刷新 · +2');
  assert.equal(vm.extraText, '+2');
  assert.equal(vm.quotaText, '$2.30 / $80.00');
});

test('orders popover rows with the primary subscription first', () => {
  const rows = buildDashboardSubscriptionPopoverRowsFromPayload(
    {
      primary_subscription: {
        plan: {
          title: 'Max',
        },
        subscription: {
          id: 200,
          amount_used: 23,
          amount_total: 800,
          next_reset_time: Date.UTC(2026, 3, 15, 0, 0, 0) / 1000,
        },
      },
      subscriptions: [
        {
          plan: {
            title: 'Daily',
          },
          subscription: {
            id: 201,
            amount_used: 12,
            amount_total: 100,
            next_reset_time: Date.UTC(2026, 3, 16, 0, 0, 0) / 1000,
          },
        },
        {
          plan: {
            title: 'Max',
          },
          subscription: {
            id: 200,
            amount_used: 23,
            amount_total: 800,
            next_reset_time: Date.UTC(2026, 3, 15, 0, 0, 0) / 1000,
          },
        },
      ],
      active_subscription_count: 2,
    },
    {
      quotaPerUnit: 10,
      timeZone: 'UTC',
    },
  );

  assert.equal(rows[0].titleText, 'Max');
  assert.equal(rows[0].summaryText, 'Max $2.30 / $80.00 · 04-15 00:00 刷新');
  assert.equal(rows[0].progressPercent, 2.875);
  assert.equal(rows[0].displayProgressPercent, 2.875);
  assert.equal(rows[1].titleText, 'Daily');
});

test('builds dashboard subscription display payload with summary and ordered rows', () => {
  const display = buildDashboardSubscriptionDisplayFromPayload(
    {
      primary_subscription: {
        plan: {
          title: 'Max',
        },
        subscription: {
          id: 200,
          amount_used: 23,
          amount_total: 800,
          next_reset_time: Date.UTC(2026, 3, 15, 0, 0, 0) / 1000,
        },
      },
      subscriptions: [
        {
          plan: {
            title: 'Daily',
          },
          subscription: {
            id: 201,
            amount_used: 12,
            amount_total: 100,
            next_reset_time: Date.UTC(2026, 3, 16, 0, 0, 0) / 1000,
          },
        },
      ],
      active_subscription_count: 2,
    },
    {
      quotaPerUnit: 10,
      timeZone: 'UTC',
    },
  );

  assert.equal(
    display.summary.summaryText,
    'Max $2.30 / $80.00 · 04-15 00:00 刷新 · +1',
  );
  assert.equal(display.rows[0].titleText, 'Max');
  assert.equal(display.rows[0].isPrimary, true);
  assert.equal(display.rows[1].titleText, 'Daily');
});

test('omits extra count when it is zero', () => {
  const vm = buildDashboardSubscriptionSummaryViewModel(
    {
      plan: {
        title: 'Max',
      },
      subscription: {
        amount_used: 23,
        amount_total: 800,
        next_reset_time: Date.UTC(2026, 3, 15, 0, 0, 0) / 1000,
      },
    },
    {
      quotaPerUnit: 10,
      extraCount: 0,
      timeZone: 'UTC',
    },
  );

  assert.equal(vm.summaryText, 'Max $2.30 / $80.00 · 04-15 00:00 刷新');
  assert.equal(vm.extraText, '');
});

test('builds popover rows for unlimited plans without reset time', () => {
  const rows = buildDashboardSubscriptionPopoverRows([
    {
      plan: {
        title: 'Daily',
      },
      subscription: {
        amount_used: 125,
        amount_total: 0,
        next_reset_time: 0,
      },
    },
  ], {
    quotaPerUnit: 10,
  });

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    titleText: 'Daily',
    badgeText: 'DAILY',
    usedAmountText: '$12.50',
    totalAmountText: '∞',
    quotaText: '$12.50 / ∞',
    resetText: '有效期总额度',
    extraText: '',
    showProgress: false,
    progressPercent: 0,
    displayProgressPercent: 0,
  });
});

test('formats reset time using mm-dd hh:mm', () => {
  const resetText = formatDashboardSubscriptionResetTime(
    Date.UTC(2026, 11, 5, 9, 7, 0) / 1000,
    {
      timeZone: 'UTC',
    },
  );

  assert.equal(resetText, '12-05 09:07');
});
