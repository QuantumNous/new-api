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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpen,
  Check,
  Circle,
  KeyRound,
  Laptop,
  Leaf,
  ReceiptText,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getApiKeys } from '@/features/keys/api'
import { getUserLogs } from '@/features/usage-logs/api'
import { usageLogSchema } from '@/features/usage-logs/data/schema'
import { useStatus } from '@/hooks/use-status'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { getEasySetupStage, type EasySetupStage } from './easy-overview-state'
import {
  estimateEasySavings,
  formatEasySavingsCny,
  type EasySavingsSummary,
} from './easy-savings'

type EasySetupStep = {
  id: Exclude<EasySetupStage, 'complete'>
  title: string
  description: string
  action: string
  to: '/wallet' | '/keys' | '/guide'
  icon: LucideIcon
  complete: boolean
}

type EasyOverviewDashboardViewProps = {
  remainQuota: number
  usedQuota: number
  requestCount: number
  hasApiKey: boolean
  savings: EasySavingsSummary
}

function SetupPath(props: { steps: EasySetupStep[]; stage: EasySetupStage }) {
  const { t } = useTranslation()

  return (
    <ol
      className='grid gap-3 border-t px-5 py-4 sm:grid-cols-3 sm:px-7'
      aria-label={t('Your setup path')}
    >
      {props.steps.map((step, index) => {
        const active = step.id === props.stage
        const StatusIcon = step.complete ? Check : Circle
        let statusLabel = t('Later')
        if (step.complete) {
          statusLabel = t('Done')
        } else if (active) {
          statusLabel = t('Now')
        }

        return (
          <li key={step.id} aria-current={active ? 'step' : undefined}>
            <div className='flex min-w-0 items-center gap-3'>
              <span
                className={cn(
                  'bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  active && 'bg-primary text-primary-foreground',
                  step.complete && 'bg-success/12 text-success'
                )}
              >
                {step.complete ? (
                  <StatusIcon className='size-4' aria-hidden='true' />
                ) : (
                  index + 1
                )}
              </span>
              <span className='min-w-0'>
                <span
                  className={cn(
                    'text-muted-foreground block truncate text-xs',
                    active && 'text-primary font-medium',
                    step.complete && 'text-success'
                  )}
                >
                  {statusLabel}
                </span>
                <span className='block truncate text-sm font-medium'>
                  {step.title}
                </span>
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function SavingsReceipt(props: { savings: EasySavingsSummary }) {
  const { t } = useTranslation()
  const hasComparableRequests = props.savings.comparableRequests > 0

  return (
    <aside
      className='bg-warning/6 border-warning/25 relative overflow-hidden rounded-[1.75rem] border p-5 shadow-xs sm:p-6'
      data-testid='easy-savings-receipt'
    >
      <div
        className='bg-warning/12 pointer-events-none absolute -top-12 -right-12 size-36 rounded-full'
        aria-hidden='true'
      />
      <div className='relative'>
        <div className='flex items-center justify-between gap-3'>
          <span className='text-warning inline-flex items-center gap-2 text-xs font-semibold tracking-wide'>
            <ReceiptText className='size-4' aria-hidden='true' />
            {t('Savings receipt')}
          </span>
          <span className='bg-card/80 text-muted-foreground rounded-full px-2.5 py-1 text-[11px] font-medium'>
            {t('Automatically estimated')}
          </span>
        </div>

        <p className='text-muted-foreground mt-7 text-xs font-medium'>
          {t('Estimated savings')}
        </p>
        <p className='mt-1 text-4xl font-semibold tracking-[-0.06em] tabular-nums sm:text-5xl'>
          {formatEasySavingsCny(props.savings.savings)}
        </p>

        <dl className='mt-7 space-y-3 border-y border-dashed py-4 text-sm'>
          <div className='flex items-center justify-between gap-4'>
            <dt className='text-muted-foreground'>
              {t('Official equivalent')}
            </dt>
            <dd className='font-medium tabular-nums line-through decoration-1'>
              {formatEasySavingsCny(props.savings.officialCost)}
            </dd>
          </div>
          <div className='flex items-center justify-between gap-4'>
            <dt className='text-muted-foreground'>{t('Yecai billing')}</dt>
            <dd className='text-success font-semibold tabular-nums'>
              {formatEasySavingsCny(props.savings.siteCost)}
            </dd>
          </div>
        </dl>

        <p className='text-muted-foreground mt-4 text-xs leading-relaxed'>
          {hasComparableRequests
            ? t(
                'Based on {{count}} recent comparable requests and their recorded group rates.',
                { count: props.savings.comparableRequests }
              )
            : t(
                'After your first comparable request, savings will appear here automatically.'
              )}
        </p>
      </div>
    </aside>
  )
}

function AccountLink(props: {
  title: string
  to: '/keys' | '/guide' | '/usage-logs'
  icon: LucideIcon
}) {
  const Icon = props.icon

  return (
    <Link
      to={props.to}
      className='hover:bg-muted/60 focus-visible:ring-ring flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2'
    >
      <Icon className='text-muted-foreground size-4' aria-hidden='true' />
      {props.title}
    </Link>
  )
}

export function EasyOverviewDashboardView(
  props: EasyOverviewDashboardViewProps
) {
  const { t } = useTranslation()
  const stage = getEasySetupStage(props)
  const steps: EasySetupStep[] = [
    {
      id: 'wallet',
      title: t('Add credits'),
      description: t('Credits are your AI budget; top up when running low'),
      action: t('Top up'),
      to: '/wallet',
      icon: Wallet,
      complete: props.remainQuota > 0,
    },
    {
      id: 'key',
      title: t('Create API Key'),
      description: t('One tap — this is the password your AI tool needs'),
      action: t('Create my key'),
      to: '/keys',
      icon: KeyRound,
      complete: props.hasApiKey,
    },
    {
      id: 'guide',
      title: t('Connect an AI tool'),
      description: t(
        'Choose your app, then enter the address, key, and model shown in the guide.'
      ),
      action: t('Open guide'),
      to: '/guide',
      icon: BookOpen,
      complete: props.requestCount > 0,
    },
  ]
  const activeStep = steps.find((step) => step.id === stage)
  const mainAction = activeStep ?? {
    title: t('Everything is ready'),
    description: t(
      'Your account is connected. Keep using AI and we will track the bill for you.'
    ),
    action: t('View spending'),
    to: '/usage-logs' as const,
    icon: Sparkles,
  }
  const MainIcon = mainAction.icon

  return (
    <div className='flex flex-col gap-5' data-testid='easy-overview'>
      <div className='grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.75fr)]'>
        <section
          className='bg-card overflow-hidden rounded-[2rem] border shadow-xs'
          data-testid='easy-setup-runway'
        >
          <div className='p-5 sm:p-7'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <span className='text-primary inline-flex items-center gap-2 text-xs font-semibold tracking-wide'>
                <Leaf className='size-4' aria-hidden='true' />
                {t('Easy mode')}
              </span>
              <span className='bg-primary/8 text-primary rounded-full px-3 py-1 text-xs font-medium'>
                {stage === 'complete'
                  ? t('Ready to use')
                  : t('One clear next step')}
              </span>
            </div>

            <div className='mt-10 flex max-w-2xl items-start gap-4 sm:mt-14'>
              <span className='bg-primary/10 text-primary hidden size-12 shrink-0 items-center justify-center rounded-2xl sm:flex'>
                <MainIcon className='size-5' aria-hidden='true' />
              </span>
              <div>
                <p className='text-muted-foreground mb-2 text-xs font-medium'>
                  {stage === 'complete' ? t('Ready') : t('Do this now')}
                </p>
                <h2 className='text-3xl font-semibold tracking-[-0.045em] text-balance sm:text-4xl'>
                  {mainAction.title}
                </h2>
                <p className='text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed sm:text-base'>
                  {mainAction.description}
                </p>
                <Button
                  size='lg'
                  className='mt-6 rounded-xl'
                  render={<Link to={mainAction.to} />}
                >
                  {mainAction.action}
                  <ArrowRight data-icon='inline-end' />
                </Button>
              </div>
            </div>
          </div>

          <SetupPath steps={steps} stage={stage} />

          <div className='bg-muted/25 grid border-t sm:grid-cols-2'>
            <Link
              to='/guide'
              className='hover:bg-card/70 focus-visible:ring-ring flex items-center gap-3 px-5 py-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset sm:px-7'
            >
              <span className='bg-card flex size-10 shrink-0 items-center justify-center rounded-xl border shadow-xs'>
                <BookOpen className='text-primary size-4' aria-hidden='true' />
              </span>
              <span className='min-w-0 flex-1'>
                <span className='block text-sm font-semibold'>
                  {t('Manual setup, always available')}
                </span>
                <span className='text-muted-foreground mt-0.5 block text-xs leading-relaxed'>
                  {t('Enter the API address, key, and model by hand.')}
                </span>
              </span>
              <span className='text-primary shrink-0 text-xs font-semibold'>
                {t('Start manual setup')}
              </span>
            </Link>

            <div className='flex items-center gap-3 border-t px-5 py-4 sm:border-t-0 sm:border-l sm:px-7'>
              <span className='bg-card flex size-10 shrink-0 items-center justify-center rounded-xl border shadow-xs'>
                <Laptop
                  className='text-muted-foreground size-4'
                  aria-hidden='true'
                />
              </span>
              <span className='min-w-0 flex-1'>
                <span className='block text-sm font-semibold'>
                  {t('Desktop client')}
                </span>
                <span className='text-muted-foreground mt-0.5 block text-xs leading-relaxed'>
                  {t('One-click setup is being prepared')}
                </span>
              </span>
              <span className='bg-muted text-muted-foreground shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium'>
                {t('In development')}
              </span>
            </div>
          </div>
        </section>

        <SavingsReceipt savings={props.savings} />
      </div>

      <section className='bg-card rounded-[1.5rem] border shadow-xs'>
        <div className='grid sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]'>
          <div className='px-5 py-4 sm:px-6'>
            <p className='text-muted-foreground text-xs'>
              {t('Credit remaining')}
            </p>
            <p className='mt-1 text-xl font-semibold tracking-tight tabular-nums'>
              {formatQuota(props.remainQuota)}
            </p>
          </div>
          <div className='border-t px-5 py-4 sm:border-t-0 sm:border-l sm:px-6'>
            <p className='text-muted-foreground text-xs'>{t('Used')}</p>
            <p className='mt-1 text-xl font-semibold tracking-tight tabular-nums'>
              {formatQuota(props.usedQuota)}
            </p>
          </div>
          <nav
            className='flex flex-wrap items-center gap-1 border-t p-2 lg:border-t-0 lg:border-l'
            aria-label={t('Common actions')}
          >
            <AccountLink title={t('My key')} to='/keys' icon={KeyRound} />
            <AccountLink
              title={t('Manual setup')}
              to='/guide'
              icon={BookOpen}
            />
            <AccountLink
              title={t('Spending details')}
              to='/usage-logs'
              icon={ReceiptText}
            />
          </nav>
        </div>
      </section>
    </div>
  )
}

export function EasyOverviewDashboard() {
  const user = useAuthStore((state) => state.auth.user)
  const quotaPerUnit = useSystemConfigStore(
    (state) => state.config.currency.quotaPerUnit
  )
  const { status } = useStatus()
  const requestCount = Number(user?.request_count ?? 0)
  const apiKeysQuery = useQuery({
    queryKey: ['dashboard', 'easy-overview', 'api-keys'],
    queryFn: async () => {
      const result = await getApiKeys({ p: 1, size: 1 })
      return result.success ? (result.data?.items ?? []) : []
    },
    staleTime: 60 * 1000,
  })
  const usageLogsQuery = useQuery({
    queryKey: ['dashboard', 'easy-overview', 'recent-consume-logs'],
    queryFn: async () => {
      const result = await getUserLogs({ p: 1, page_size: 100, type: 2 })
      if (!result.success) return []

      return (result.data?.items ?? []).flatMap((item) => {
        const parsed = usageLogSchema.safeParse(item)
        return parsed.success ? [parsed.data] : []
      })
    },
    enabled: requestCount > 0,
    staleTime: 60 * 1000,
  })
  const savings = useMemo(
    () =>
      estimateEasySavings(usageLogsQuery.data ?? [], {
        priceRate: Math.max(Number(status?.price ?? 1), 0.001),
        usdExchangeRate: Math.max(
          Number(status?.usd_exchange_rate ?? status?.price ?? 1),
          0.001
        ),
        quotaPerUnit,
      }),
    [
      quotaPerUnit,
      status?.price,
      status?.usd_exchange_rate,
      usageLogsQuery.data,
    ]
  )

  return (
    <EasyOverviewDashboardView
      remainQuota={Number(user?.quota ?? 0)}
      usedQuota={Number(user?.used_quota ?? 0)}
      requestCount={requestCount}
      hasApiKey={Boolean(apiKeysQuery.data?.length)}
      savings={savings}
    />
  )
}
