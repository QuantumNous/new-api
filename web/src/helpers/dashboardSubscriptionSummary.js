/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toTimestampMs(value) {
  const number = toNumber(value);
  if (number <= 0) return 0;
  return number < 1e12 ? number * 1000 : number;
}

function formatCompactDecimal(value) {
  const number = Math.abs(toNumber(value));
  return number.toFixed(2);
}

export function formatDashboardSubscriptionAmount(value) {
  const number = toNumber(value);
  const sign = number < 0 ? '-' : '';
  return `$${sign}${formatCompactDecimal(number)}`;
}

export function getDashboardSubscriptionTranslator(translate) {
  return typeof translate === 'function' ? translate : (value) => value;
}

function convertQuotaToUsd(value, options = {}) {
  const quotaPerUnit = toNumber(options.quotaPerUnit) > 0 ? toNumber(options.quotaPerUnit) : 1;
  return toNumber(value) / quotaPerUnit;
}

export function formatDashboardSubscriptionResetTime(value, options = {}) {
  const timestampMs = toTimestampMs(value);
  if (!timestampMs) return '';

  const date = new Date(timestampMs);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: options.timeZone,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}`;
}

function buildQuotaText(subscription = {}, options = {}) {
  const usedText = formatDashboardSubscriptionAmount(
    convertQuotaToUsd(subscription.amount_used, options),
  );
  const totalAmount = toNumber(subscription.amount_total);
  const totalText = totalAmount > 0
    ? formatDashboardSubscriptionAmount(convertQuotaToUsd(totalAmount, options))
    : '∞';
  return {
    usedAmountText: usedText,
    totalAmountText: totalText,
    quotaText: `${usedText} / ${totalText}`,
  };
}

function buildResetText(subscription = {}, options = {}) {
  const nextResetTime = toTimestampMs(subscription.next_reset_time);
  if (nextResetTime > 0) {
    const formatted = formatDashboardSubscriptionResetTime(nextResetTime, options);
    return formatted
      ? { resetText: `${formatted} 刷新`, summaryText: `${formatted} 刷新` }
      : { resetText: '', summaryText: '' };
  }
  return { resetText: '有效期总额度', summaryText: '有效期总额度' };
}

function buildBadgeText(titleText) {
  const normalizedTitle = String(titleText || '').trim();
  if (!normalizedTitle) return '';

  const englishWord = normalizedTitle.match(/[A-Za-z0-9+-]+/);
  if (englishWord?.[0]) {
    return englishWord[0].slice(0, 8).toUpperCase();
  }

  return normalizedTitle.slice(0, 4).toUpperCase();
}

function normalizeTriggerTitleToken(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\u4E00-\u9FFF]+/g, '');
}

export function shouldShowDashboardSubscriptionTriggerTitle(summary = {}) {
  const titleText = String(summary.titleText || '').trim();
  if (!titleText) return false;

  const badgeText = String(summary.badgeText || '').trim();
  if (!badgeText) return true;

  const normalizedTitle = normalizeTriggerTitleToken(titleText);
  const normalizedBadge = normalizeTriggerTitleToken(badgeText);
  if (!normalizedTitle || !normalizedBadge) return true;

  return !normalizedTitle.startsWith(normalizedBadge);
}

export function buildDashboardSubscriptionTriggerText(summary = {}) {
  const quotaText = String(summary.quotaText || '').trim();
  const extraText = String(summary.extraText || '').trim();

  if (!quotaText) {
    return extraText;
  }

  return extraText ? `${quotaText} · ${extraText}` : quotaText;
}

function buildProgressData(subscription = {}) {
  const totalAmount = toNumber(subscription.amount_total);
  const usedAmount = Math.max(0, toNumber(subscription.amount_used));

  if (totalAmount <= 0) {
    return {
      showProgress: false,
      progressPercent: 0,
      displayProgressPercent: 0,
    };
  }

  const progressPercent = Math.max(0, Math.min(100, (usedAmount / totalAmount) * 100));
  const displayProgressPercent =
    progressPercent > 0 && progressPercent < 2 ? 2 : progressPercent;

  return {
    showProgress: true,
    progressPercent,
    displayProgressPercent,
  };
}

function getSubscriptionId(summary = {}) {
  const subscription = summary.subscription || summary.Subscription || {};
  const rawId =
    subscription.id ?? subscription.Id ?? summary.id ?? summary.Id ?? summary.subscription_id;
  return Math.trunc(toNumber(rawId));
}

function orderSubscriptionSummariesForPopover(payload = {}) {
  const primarySubscription =
    payload.primary_subscription || payload.primarySubscription || payload.subscription || null;
  const primaryId = getSubscriptionId(primarySubscription);
  const activeSubscriptions = Array.isArray(payload.subscriptions)
    ? payload.subscriptions
    : Array.isArray(payload.active_subscriptions)
      ? payload.active_subscriptions
      : Array.isArray(payload.activeSubscriptions)
        ? payload.activeSubscriptions
        : [];

  const ordered = activeSubscriptions.filter(Boolean).slice();
  if (!primarySubscription) {
    return ordered;
  }

  if (primaryId > 0) {
    const primaryIndex = ordered.findIndex((item) => getSubscriptionId(item) === primaryId);
    if (primaryIndex >= 0) {
      const [primaryItem] = ordered.splice(primaryIndex, 1);
      ordered.unshift(primaryItem);
      return ordered;
    }
  }

  return [primarySubscription, ...ordered];
}

export function buildDashboardSubscriptionSummaryViewModel(source = {}, options = {}) {
  const plan = source.plan || {};
  const subscription = source.subscription || {};
  const titleText = String(plan.title || '').trim();
  const badgeText = buildBadgeText(titleText);
  const {
    usedAmountText,
    totalAmountText,
    quotaText,
  } = buildQuotaText(subscription, options);
  const { resetText, summaryText: resetSummaryText } = buildResetText(subscription, options);
  const { showProgress, progressPercent, displayProgressPercent } = buildProgressData(subscription);
  const extraCount = Math.max(0, Math.trunc(toNumber(options.extraCount)));
  const extraText = extraCount > 0 ? `+${extraCount}` : '';

  let summaryText = titleText ? `${titleText} ${quotaText}` : quotaText;
  if (resetSummaryText) summaryText += ` · ${resetSummaryText}`;
  if (extraText) summaryText += ` · ${extraText}`;

  return {
    titleText,
    badgeText,
    usedAmountText,
    totalAmountText,
    quotaText,
    resetText,
    extraText,
    showProgress,
    progressPercent,
    displayProgressPercent,
    summaryText,
  };
}

export function buildDashboardSubscriptionSummaryFromPayload(payload = {}, options = {}) {
  const primarySubscription =
    payload.primary_subscription || payload.primarySubscription || payload.subscription || null;

  if (!primarySubscription) {
    return {
      titleText: '',
      quotaText: '',
      resetText: '',
      extraText: '',
      summaryText: '',
    };
  }

  const activeSubscriptionCount = Math.max(
    0,
    Math.trunc(toNumber(payload.active_subscription_count ?? payload.activeSubscriptionCount)),
  );

  return buildDashboardSubscriptionSummaryViewModel(primarySubscription, {
    ...options,
    extraCount: Math.max(0, activeSubscriptionCount - 1),
  });
}

export function buildDashboardSubscriptionPopoverRows(items = [], options = {}) {
  return items.map((item) => {
    const vm = buildDashboardSubscriptionSummaryViewModel(item, options);
    return {
      badgeText: vm.badgeText,
      titleText: vm.titleText,
      usedAmountText: vm.usedAmountText,
      totalAmountText: vm.totalAmountText,
      quotaText: vm.quotaText,
      resetText: vm.resetText,
      extraText: '',
      showProgress: vm.showProgress,
      progressPercent: vm.progressPercent,
      displayProgressPercent: vm.displayProgressPercent,
    };
  });
}

export function buildDashboardSubscriptionPopoverRowsFromPayload(payload = {}, options = {}) {
  const orderedItems = orderSubscriptionSummariesForPopover(payload);
  return orderedItems.map((item, index) => {
    const vm = buildDashboardSubscriptionSummaryViewModel(item, {
      ...options,
      extraCount: 0,
    });
    return {
      ...vm,
      isPrimary: index === 0,
    };
  });
}

export function buildDashboardSubscriptionDisplayFromPayload(payload = {}, options = {}) {
  return {
    summary: buildDashboardSubscriptionSummaryFromPayload(payload, options),
    rows: buildDashboardSubscriptionPopoverRowsFromPayload(payload, options),
  };
}
