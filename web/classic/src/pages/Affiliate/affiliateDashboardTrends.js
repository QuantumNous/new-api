const AFFILIATE_TREND_DAYS = 14;
const SECONDS_PER_DAY = 24 * 60 * 60;

export function buildAffiliateSummaryTrendParams(nowMs = Date.now()) {
  const trendEnd = Math.floor(nowMs / 1000);
  return {
    trend_start_timestamp:
      trendEnd - (AFFILIATE_TREND_DAYS - 1) * SECONDS_PER_DAY,
    trend_end_timestamp: trendEnd,
  };
}

function formatTrendLabel(timestamp) {
  if (!Number.isFinite(Number(timestamp)) || Number(timestamp) <= 0) {
    return '--';
  }
  return new Date(Number(timestamp) * 1000).toISOString().slice(5, 10);
}

function widthFor(value, max) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0 || max <= 0) {
    return 0;
  }
  return Math.max(4, Math.round((amount / max) * 100));
}

export function buildAffiliateTrendRows(summary) {
  const trends = Array.isArray(summary?.daily_trends)
    ? summary.daily_trends
    : [];
  if (trends.length === 0) {
    return [];
  }

  const maxPaid = Math.max(
    ...trends.map((item) => Number(item.net_consumption_rmb || 0)),
    0,
  );
  const maxPending = Math.max(
    ...trends.map((item) => Number(item.pending_settlement_rmb || 0)),
    0,
  );

  return trends.map((item) => ({
    label: formatTrendLabel(item.period_start),
    effectiveNewUsers: Number(item.effective_new_user_count || 0),
    netConsumptionRmb: Number(item.net_consumption_rmb || 0),
    estimatedCommissionRmb: Number(item.estimated_commission_rmb || 0),
    headFeeRmb: Number(item.head_fee_rmb || 0),
    pendingSettlementRmb: Number(item.pending_settlement_rmb || 0),
    paidWidth: widthFor(item.net_consumption_rmb, maxPaid),
    pendingWidth: widthFor(item.pending_settlement_rmb, maxPending),
  }));
}
