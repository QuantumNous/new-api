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

/**
 * Dashboard filter settings
 */
export const DEFAULT_TIME_RANGE_DAYS = 14

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
  remainDisplay: string
  usedDisplay: string
  requestCountDisplay: string
  currencyLabel: string
  currencyEnabled: boolean
}) =>
  [
    {
      key: 'balance',
      title: totals.currencyEnabled
        ? `Current Balance (${totals.currencyLabel})`
        : 'Current Balance',
      value: totals.remainDisplay,
      description: totals.currencyEnabled
        ? `Remaining quota (${totals.currencyLabel})`
        : 'Remaining quota units',
      icon: Wallet,
    },
    {
      key: 'usage',
      title: totals.currencyEnabled
        ? `Historical Usage (${totals.currencyLabel})`
        : 'Historical Usage',
      value: totals.usedDisplay,
      description: totals.currencyEnabled
        ? `Total consumed (${totals.currencyLabel})`
        : 'Total consumed quota',
      icon: TrendingUp,
    },
    {
      key: 'requests',
      title: 'Request Count',
      value: totals.requestCountDisplay,
      description: 'Total requests made',
      icon: Activity,
    },
  ] as const
