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
import { useTranslation } from 'react-i18next'

interface StatCardConfig {
  key: string
  title: string
  description: string
  icon: LucideIcon
  getValue: (stat: any, days?: number) => number
}

export function useModelStatCardsConfig(): StatCardConfig[] {
  const { t } = useTranslation()

  return [
    {
      key: 'count',
      title: t('Total Count'),
      description: t('Statistical count'),
      icon: Hash,
      getValue: (stat) => stat?.rpm ?? 0,
    },
    {
      key: 'quota',
      title: t('Total Quota'),
      description: t('Statistical quota'),
      icon: Coins,
      getValue: (stat) => stat?.quota ?? 0,
    },
    {
      key: 'tokens',
      title: t('Total Tokens'),
      description: t('Statistical tokens'),
      icon: Layers,
      getValue: (stat) => stat?.tpm ?? 0,
    },
    {
      key: 'avgRpm',
      title: t('Average RPM'),
      description: t('Requests per minute'),
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
      title: t('Average TPM'),
      description: t('Tokens per minute'),
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
}

export function useSummaryCardsConfig(totals: {
  remainDisplay: string
  usedDisplay: string
  requestCountDisplay: string
  currencyLabel: string
  currencyEnabled: boolean
}) {
  const { t } = useTranslation()

  return [
    {
      key: 'balance',
      title: totals.currencyEnabled
        ? `${t('Current Balance')} (${totals.currencyLabel})`
        : t('Current Balance'),
      value: totals.remainDisplay,
      description: totals.currencyEnabled
        ? `${t('Remaining quota')} (${totals.currencyLabel})`
        : t('Remaining quota units'),
      icon: Wallet,
    },
    {
      key: 'usage',
      title: totals.currencyEnabled
        ? `${t('Historical Usage')} (${totals.currencyLabel})`
        : t('Historical Usage'),
      value: totals.usedDisplay,
      description: totals.currencyEnabled
        ? `${t('Total consumed')} (${totals.currencyLabel})`
        : t('Total consumed quota'),
      icon: TrendingUp,
    },
    {
      key: 'requests',
      title: t('Request Count'),
      value: totals.requestCountDisplay,
      description: t('Total requests made'),
      icon: Activity,
    },
  ]
}
