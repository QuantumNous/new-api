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
import {
  Activity,
  ArrowDownIcon,
  ArrowUpIcon,
  Coins,
  Cpu,
  Users,
  Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { StatCard } from '@/features/dashboard/components/ui/stat-card'
import {
  formatCompactNumber,
  formatInteger,
  formatPercent,
  formatQuota,
} from '@/lib/format'

export interface OverviewStatCardsProps {
  revenueToday: number
  revenueMonth: number
  tokensToday: number
  requestsToday: number
  activeUsers: number
  registeredUsers: number
  revenueSparkline: number[]
  requestsSparkline: number[]
  monthSparkline: number[]
  tokensSparkline: number[]
  revenueYesterday: number | undefined
  loading: boolean
}

export function OverviewStatCards(props: OverviewStatCardsProps) {
  const { t } = useTranslation()
  const activeRate =
    props.registeredUsers > 0
      ? (props.activeUsers / props.registeredUsers) * 100
      : 0

  const todayVsYesterdayPct =
    props.revenueYesterday != null && props.revenueYesterday > 0
      ? ((props.revenueToday - props.revenueYesterday) /
          props.revenueYesterday) *
        100
      : undefined

  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5'>
      <StatCardTile>
        <StatCard
          title={t('Revenue today')}
          value={formatQuota(props.revenueToday)}
          description={
            <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
              <span className='text-muted-foreground/60'>
                {t('This month')}: {formatQuota(props.revenueMonth)}
              </span>
              {todayVsYesterdayPct !== undefined && (
                <YesterdayTrend percent={todayVsYesterdayPct} />
              )}
            </div>
          }
          icon={Wallet}
          tone='accent-1'
          sparkline={props.revenueSparkline}
          sparklineVariant='line'
          loading={props.loading}
        />
      </StatCardTile>

      <StatCardTile>
        <StatCard
          title={t('Revenue this month')}
          value={formatQuota(props.revenueMonth)}
          description={
            <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
              <span className='text-muted-foreground/60'>
                {t('Today')}: {formatQuota(props.revenueToday)}
              </span>
              {todayVsYesterdayPct !== undefined && (
                <YesterdayTrend percent={todayVsYesterdayPct} />
              )}
            </div>
          }
          icon={Coins}
          tone='accent-2'
          sparkline={props.monthSparkline}
          sparklineVariant='line'
          loading={props.loading}
        />
      </StatCardTile>

      <StatCardTile>
        <StatCard
          title={t('Requests')}
          value={formatInteger(props.requestsToday)}
          description={t('Today')}
          icon={Activity}
          tone='accent-1'
          sparkline={props.requestsSparkline}
          sparklineVariant='line'
          loading={props.loading}
        />
      </StatCardTile>

      <StatCardTile>
        <StatCard
          title={t('Tokens today')}
          value={formatCompactNumber(props.tokensToday)}
          description={`${t('Requests')}: ${formatInteger(props.requestsToday)}`}
          icon={Cpu}
          tone='accent-3'
          sparkline={props.tokensSparkline}
          loading={props.loading}
        />
      </StatCardTile>

      <StatCardTile>
        <StatCard
          title={t('Active users (24h)')}
          value={formatInteger(props.activeUsers)}
          description={t('Active users in the last 24 hours')}
          icon={Users}
          tone='accent-1'
          details={[
            {
              label: t('Registered users'),
              value: formatInteger(props.registeredUsers),
            },
            {
              label: t('Active rate'),
              value: formatPercent(activeRate),
              tone: 'success',
            },
          ]}
          loading={props.loading}
        />
      </StatCardTile>
    </div>
  )
}

/** Green/red "vs yesterday" percentage badge with an up/down arrow. */
function YesterdayTrend(props: { percent: number }) {
  const isPositive = props.percent >= 0
  const Arrow = isPositive ? ArrowUpIcon : ArrowDownIcon

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
        isPositive ? 'text-success' : 'text-destructive'
      }`}
    >
      <Arrow className='size-3 shrink-0' aria-hidden='true' />
      {formatPercent(Math.abs(props.percent))}
      <span className='sr-only'>{` ${'vs yesterday'}`}</span>
    </span>
  )
}

function StatCardTile(props: { children: ReactNode }) {
  return (
    <div className='bg-card rounded-2xl border p-3 shadow-xs transition-shadow duration-200 hover:shadow-md sm:p-4'>
      {props.children}
    </div>
  )
}
