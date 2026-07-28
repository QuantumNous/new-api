/*
Copyright (C) 2023-2026 QuantumNous

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
import type { TFunction } from 'i18next'

import { formatBillingCurrencyFromUSD } from '@/lib/currency'
import { formatLogQuota } from '@/lib/format'

import type { UsageLog } from '../data/schema'
import { USAGE_BILLING_PATH, type LogOtherData } from '../types'
import { getTieredBillingSummary, hasAnyCacheTokens } from './format'
import { isPerCallBilling } from './utils'

export type BillingBreakdownRow = {
  label: string
  value: string
}

function formatRatio(ratio: number | undefined): string {
  if (ratio == null) return '-'
  return ratio.toFixed(4)
}

function getUsageBillingPathLabel(
  t: TFunction,
  adminInfo: LogOtherData['admin_info']
): string {
  switch (adminInfo?.usage_billing_path) {
    case USAGE_BILLING_PATH.LOCAL:
      return t('Local Billing')
    case USAGE_BILLING_PATH.OPENAI:
      return t('Upstream Response (billing-usage-openai)')
    case USAGE_BILLING_PATH.OPENAI_ESTIMATED:
      return t('Upstream Response (billing-usage-openai-estimated)')
    case USAGE_BILLING_PATH.ANTHROPIC:
      return t('Upstream Response (billing-usage-anthropic)')
    case USAGE_BILLING_PATH.ANTHROPIC_ESTIMATED:
      return t('Upstream Response (billing-usage-anthropic-estimated)')
    case USAGE_BILLING_PATH.GEMINI:
      return t('Upstream Response (billing-usage-gemini)')
    case USAGE_BILLING_PATH.GEMINI_ESTIMATED:
      return t('Upstream Response (billing-usage-gemini-estimated)')
    case USAGE_BILLING_PATH.UPSTREAM:
      return t('Upstream Response')
    default:
      return adminInfo?.local_count_tokens
        ? t('Local Billing')
        : t('Upstream Response')
  }
}

export function buildBillingBreakdownRows(props: {
  log: UsageLog
  other: LogOtherData
  isAdmin: boolean
  showRatio: boolean
  t: TFunction
}): BillingBreakdownRow[] {
  const isPerCall = isPerCallBilling(props.other.model_price)
  const isClaude = props.other.claude === true
  const isTieredExpr = props.other.billing_mode === 'tiered_expr'
  const tieredSummary = getTieredBillingSummary(props.other)

  const rows: BillingBreakdownRow[] = []
  const priceOpts = { digitsLarge: 4, digitsSmall: 6, abbreviate: false }
  const fmtPrice = (usd: number) => formatBillingCurrencyFromUSD(usd, priceOpts)
  const baseInputUSD =
    props.other.model_ratio != null ? props.other.model_ratio * 2.0 : 0

  if (isTieredExpr) {
    rows.push({
      label: props.t('Billing Mode'),
      value: props.t('Dynamic Pricing'),
    })
    if (tieredSummary) {
      if (tieredSummary.tier.label) {
        rows.push({
          label: props.t('Matched Tier'),
          value: tieredSummary.tier.label,
        })
      }
      for (const entry of tieredSummary.priceEntries) {
        rows.push({
          label: props.t(entry.shortLabel),
          value: `${fmtPrice(entry.price)}/M`,
        })
      }
    } else {
      rows.push({
        label: props.t('Matched Tier'),
        value: props.t('No matching results'),
      })
    }
  } else if (isPerCall) {
    rows.push({ label: props.t('Billing Mode'), value: props.t('Per-call') })
    if (props.other.model_price != null) {
      rows.push({
        label: props.t('Model Price'),
        value: fmtPrice(props.other.model_price),
      })
    }
  } else {
    rows.push({ label: props.t('Billing Mode'), value: props.t('Per-token') })
    if (props.other.model_ratio != null) {
      rows.push({
        label: props.t('Input'),
        value: `${fmtPrice(baseInputUSD)}/M`,
      })
    }
    if (
      props.other.completion_ratio != null &&
      props.other.model_ratio != null
    ) {
      rows.push({
        label: props.t('Output'),
        value: `${fmtPrice(baseInputUSD * props.other.completion_ratio)}/M`,
      })
    }
  }

  const userGR = props.other.user_group_ratio
  const isUserGR = userGR != null && Number.isFinite(userGR) && userGR !== -1
  const effectiveGR = isUserGR ? userGR : props.other.group_ratio
  if (props.showRatio && effectiveGR != null && Number.isFinite(effectiveGR)) {
    rows.push({
      label: isUserGR
        ? props.t('User Exclusive Ratio')
        : props.t('Group Ratio'),
      value: `${formatRatio(effectiveGR)}x`,
    })
  }

  if (!isTieredExpr && isClaude && hasAnyCacheTokens(props.other)) {
    if (props.other.cache_ratio != null && props.other.cache_ratio !== 1) {
      rows.push({
        label: props.t('Cache Read'),
        value: `${fmtPrice(baseInputUSD * props.other.cache_ratio)}/M`,
      })
    }
    if (
      props.other.cache_creation_ratio != null &&
      props.other.cache_creation_ratio !== 1
    ) {
      rows.push({
        label: props.t('Cache Creation'),
        value: `${fmtPrice(baseInputUSD * props.other.cache_creation_ratio)}/M`,
      })
    }
    if (
      props.other.cache_creation_ratio_5m != null &&
      props.other.cache_creation_ratio_5m !== 0
    ) {
      rows.push({
        label: props.t('Cache Creation (5m)'),
        value: `${fmtPrice(baseInputUSD * props.other.cache_creation_ratio_5m)}/M`,
      })
    }
    if (
      props.other.cache_creation_ratio_1h != null &&
      props.other.cache_creation_ratio_1h !== 0
    ) {
      rows.push({
        label: props.t('Cache Creation (1h)'),
        value: `${fmtPrice(baseInputUSD * props.other.cache_creation_ratio_1h)}/M`,
      })
    }
  }

  if (!isTieredExpr) {
    if (props.other.audio_ratio != null && props.other.audio_ratio !== 1) {
      rows.push({
        label: props.t('Audio input'),
        value: `${fmtPrice(baseInputUSD * props.other.audio_ratio)}/M`,
      })
    }

    if (
      props.other.audio_completion_ratio != null &&
      props.other.audio_completion_ratio !== 1
    ) {
      rows.push({
        label: props.t('Audio output'),
        value: `${fmtPrice(baseInputUSD * props.other.audio_completion_ratio)}/M`,
      })
    }

    if (props.other.image_ratio != null && props.other.image_ratio !== 1) {
      rows.push({
        label: props.t('Image input'),
        value: `${fmtPrice(baseInputUSD * props.other.image_ratio)}/M`,
      })
    }
  }

  if (props.other.web_search && props.other.web_search_call_count) {
    rows.push({
      label: props.t('Web Search'),
      value: `${props.other.web_search_call_count}x${props.other.web_search_price ? ` (${fmtPrice(props.other.web_search_price)})` : ''}`,
    })
  }

  if (props.other.file_search && props.other.file_search_call_count) {
    rows.push({
      label: props.t('File Search'),
      value: `${props.other.file_search_call_count}x${props.other.file_search_price ? ` (${fmtPrice(props.other.file_search_price)})` : ''}`,
    })
  }

  if (
    props.other.image_generation_call &&
    props.other.image_generation_call_price
  ) {
    rows.push({
      label: props.t('Image Generation'),
      value: fmtPrice(props.other.image_generation_call_price),
    })
  }

  if (props.other.audio_input_seperate_price && props.other.audio_input_price) {
    rows.push({
      label: props.t('Audio Input Price'),
      value: fmtPrice(props.other.audio_input_price),
    })
  }

  if (props.isAdmin && props.other.admin_info) {
    rows.push({
      label: props.t('Billing Path'),
      value: getUsageBillingPathLabel(props.t, props.other.admin_info),
    })
  }

  rows.push({
    label: props.t('Total Cost'),
    value: formatLogQuota(props.log.quota),
  })

  return rows
}
