import type { AffiliateSummary } from './types'

export interface AffiliateTrendRow {
  label: string
  effectiveNewUsers: number
  netConsumptionRmb: number
  estimatedCommissionRmb: number
  headFeeRmb: number
  pendingSettlementRmb: number
  paidWidth: number
  pendingWidth: number
}

const AFFILIATE_TREND_DAYS = 14
const SECONDS_PER_DAY = 24 * 60 * 60

export function buildAffiliateSummaryTrendParams(nowMs = Date.now()) {
  const trendEnd = Math.floor(nowMs / 1000)
  return {
    trend_start_timestamp:
      trendEnd - (AFFILIATE_TREND_DAYS - 1) * SECONDS_PER_DAY,
    trend_end_timestamp: trendEnd,
  }
}

function formatTrendLabel(timestamp: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return '--'
  }
  return new Date(timestamp * 1000).toISOString().slice(5, 10)
}

function widthFor(value: number, max: number) {
  if (!Number.isFinite(value) || value <= 0 || max <= 0) {
    return 0
  }
  return Math.max(4, Math.round((value / max) * 100))
}

export function buildAffiliateTrendRows(
  summary: Pick<AffiliateSummary, 'daily_trends'> | undefined
): AffiliateTrendRow[] {
  const trends = summary?.daily_trends ?? []
  if (!Array.isArray(trends) || trends.length === 0) {
    return []
  }

  const maxPaid = Math.max(
    ...trends.map((item) => Number(item.net_consumption_rmb || 0)),
    0
  )
  const maxPending = Math.max(
    ...trends.map((item) => Number(item.pending_settlement_rmb || 0)),
    0
  )

  return trends.map((item) => ({
    label: formatTrendLabel(item.period_start),
    effectiveNewUsers: Number(item.effective_new_user_count || 0),
    netConsumptionRmb: Number(item.net_consumption_rmb || 0),
    estimatedCommissionRmb: Number(item.estimated_commission_rmb || 0),
    headFeeRmb: Number(item.head_fee_rmb || 0),
    pendingSettlementRmb: Number(item.pending_settlement_rmb || 0),
    paidWidth: widthFor(Number(item.net_consumption_rmb || 0), maxPaid),
    pendingWidth: widthFor(Number(item.pending_settlement_rmb || 0), maxPending),
  }))
}
