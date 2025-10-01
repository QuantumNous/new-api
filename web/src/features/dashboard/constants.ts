import {
  Hash,
  Coins,
  Layers,
  Gauge,
  Zap,
  Wallet,
  TrendingUp,
  Activity,
  type LucideIcon,
} from 'lucide-react'

interface StatCardConfig {
  key: string
  title: string
  description: string
  icon: LucideIcon
  getValue: (stat: any, days?: number) => number
}

/**
 * Models Tab 统计卡片配置
 */
export const MODEL_STAT_CARDS_CONFIG: StatCardConfig[] = [
  {
    key: 'count',
    title: 'Total Count',
    description: 'Statistical count',
    icon: Hash,
    getValue: (stat) => stat?.rpm ?? 0,
  },
  {
    key: 'quota',
    title: 'Total Quota',
    description: 'Statistical quota',
    icon: Coins,
    getValue: (stat) => stat?.quota ?? 0,
  },
  {
    key: 'tokens',
    title: 'Total Tokens',
    description: 'Statistical tokens',
    icon: Layers,
    getValue: (stat) => stat?.tpm ?? 0,
  },
  {
    key: 'avgRpm',
    title: 'Average RPM',
    description: 'Requests per minute',
    icon: Gauge,
    getValue: (stat, timeRangeMinutes = 1) => {
      const count = stat?.rpm ?? 0
      const result = count / timeRangeMinutes
      return isNaN(result) || !isFinite(result)
        ? 0
        : Math.round(result * 1000) / 1000
    },
  },
  {
    key: 'avgTpm',
    title: 'Average TPM',
    description: 'Tokens per minute',
    icon: Zap,
    getValue: (stat, timeRangeMinutes = 1) => {
      const tokens = stat?.tpm ?? 0
      const result = tokens / timeRangeMinutes
      return isNaN(result) || !isFinite(result)
        ? 0
        : Math.round(result * 1000) / 1000
    },
  },
]

/**
 * Overview Tab 摘要卡片配置工厂
 */
export const createSummaryCardsConfig = (totals: {
  remain: number
  used: number
  requestCount: number
  currency: boolean
}) =>
  [
    {
      key: 'balance',
      title: totals.currency ? 'Current Balance (USD)' : 'Current Balance',
      value: totals.remain,
      description: totals.currency
        ? 'Remaining quota (USD)'
        : 'Remaining quota units',
      icon: Wallet,
      formatAsCurrency: totals.currency,
    },
    {
      key: 'usage',
      title: totals.currency ? 'Historical Usage (USD)' : 'Historical Usage',
      value: totals.used,
      description: totals.currency
        ? 'Total consumed (USD)'
        : 'Total consumed quota',
      icon: TrendingUp,
      formatAsCurrency: totals.currency,
    },
    {
      key: 'requests',
      title: 'Request Count',
      value: totals.requestCount,
      description: 'Total requests made',
      icon: Activity,
      formatAsCurrency: false,
    },
  ] as const
