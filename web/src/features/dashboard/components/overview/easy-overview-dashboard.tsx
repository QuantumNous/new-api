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
  Leaf,
  ReceiptText,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getApiKeys } from '@/features/keys/api'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { getEasySetupStage, type EasySetupStage } from './easy-overview-state'

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
}

function EasyStepItem(props: {
  step: EasySetupStep
  active: boolean
  index: number
}) {
  const Icon = props.step.icon
  const StatusIcon = props.step.complete ? Check : Circle

  return (
    <li
      className={cn(
        'flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 transition-colors sm:px-4',
        props.active && 'border-primary/35 bg-primary/5',
        props.step.complete && 'border-success/25 bg-success/5'
      )}
      aria-current={props.active ? 'step' : undefined}
    >
      <span
        className={cn(
          'bg-muted flex size-9 shrink-0 items-center justify-center rounded-xl',
          props.active && 'bg-primary/10 text-primary',
          props.step.complete && 'bg-success/10 text-success'
        )}
      >
        <Icon className='size-4' aria-hidden='true' />
      </span>
      <span className='min-w-0 flex-1'>
        <span className='text-muted-foreground text-[11px] font-medium'>
          {props.index + 1}
        </span>
        <span className='block truncate text-sm font-medium'>
          {props.step.title}
        </span>
      </span>
      <StatusIcon
        className={cn(
          'text-muted-foreground size-4 shrink-0',
          props.step.complete && 'text-success'
        )}
        aria-hidden='true'
      />
    </li>
  )
}

function CommonAction(props: {
  title: string
  to: '/keys' | '/guide' | '/usage-logs'
  icon: LucideIcon
}) {
  const Icon = props.icon

  return (
    <Link
      to={props.to}
      className='hover:bg-muted/60 focus-visible:ring-ring flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors outline-none focus-visible:ring-2'
    >
      <span className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-xl'>
        <Icon className='size-4' aria-hidden='true' />
      </span>
      <span className='min-w-0 flex-1 truncate text-sm font-medium'>
        {props.title}
      </span>
      <ArrowRight
        className='text-muted-foreground size-4 shrink-0'
        aria-hidden='true'
      />
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
      title: t('Plug it into your tool'),
      description: t('Follow the beginner guide for your favorite app'),
      action: t('Open guide'),
      to: '/guide',
      icon: BookOpen,
      complete: props.requestCount > 0,
    },
  ]
  const activeStep = steps.find((step) => step.id === stage)
  const mainAction = activeStep ?? {
    title: t('All set'),
    description: t('Your AI tool is connected. You only pay when you use it.'),
    action: t('View spending'),
    to: '/usage-logs' as const,
    icon: ReceiptText,
  }

  return (
    <div className='flex flex-col gap-4' data-testid='easy-overview'>
      <section className='relative overflow-hidden rounded-3xl border bg-[linear-gradient(120deg,color-mix(in_oklch,var(--primary)_7%,var(--card))_0%,var(--card)_48%,color-mix(in_oklch,var(--overview-accent-2)_7%,var(--card))_100%)] p-4 shadow-xs sm:p-6'>
        <div
          className='bg-primary/8 pointer-events-none absolute -top-24 -right-20 size-64 rounded-full blur-3xl'
          aria-hidden='true'
        />
        <div className='relative flex flex-col gap-6'>
          <div className='flex items-center'>
            <span className='bg-primary/10 text-primary inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium'>
              <Leaf className='size-3.5' aria-hidden='true' />
              {t('Easy mode')}
            </span>
          </div>

          <div className='max-w-2xl'>
            <p className='text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase'>
              {stage === 'complete' ? t('Done') : t('Your next step')}
            </p>
            <h2 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
              {mainAction.title}
            </h2>
            <p className='text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed sm:text-base'>
              {mainAction.description}
            </p>
            <Button
              className='mt-5 rounded-xl'
              render={<Link to={mainAction.to} />}
            >
              {mainAction.action}
              <ArrowRight data-icon='inline-end' />
            </Button>
          </div>

          <div>
            <p className='text-muted-foreground mb-2 text-xs font-medium'>
              {t('Connect AI to your favorite app in three simple steps.')}
            </p>
            <ol className='grid gap-2 md:grid-cols-3'>
              {steps.map((step, index) => (
                <EasyStepItem
                  key={step.id}
                  step={step}
                  active={step.id === stage}
                  index={index}
                />
              ))}
            </ol>
          </div>
        </div>
      </section>

      <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]'>
        <section className='bg-card rounded-2xl border p-4 shadow-xs sm:p-5'>
          <div className='flex items-center justify-between gap-3'>
            <h3 className='text-sm font-semibold'>{t('Balance')}</h3>
            <Button variant='outline' size='sm' render={<Link to='/wallet' />}>
              {t('Top up')}
            </Button>
          </div>
          <div className='mt-5 grid grid-cols-2 gap-3'>
            <div className='bg-primary/5 rounded-2xl p-4'>
              <p className='text-muted-foreground text-xs'>
                {t('Credit remaining')}
              </p>
              <p className='mt-2 text-2xl font-semibold tracking-tight sm:text-3xl'>
                {formatQuota(props.remainQuota)}
              </p>
            </div>
            <div className='bg-muted/45 rounded-2xl p-4'>
              <p className='text-muted-foreground text-xs'>{t('Used')}</p>
              <p className='mt-2 text-2xl font-semibold tracking-tight sm:text-3xl'>
                {formatQuota(props.usedQuota)}
              </p>
            </div>
          </div>
        </section>

        <section className='bg-card rounded-2xl border p-2 shadow-xs'>
          <h3 className='text-muted-foreground px-3 pt-2 pb-1 text-xs font-medium'>
            {t('Common actions')}
          </h3>
          <CommonAction title={t('My key')} to='/keys' icon={KeyRound} />
          <CommonAction
            title={t('Beginner guide')}
            to='/guide'
            icon={BookOpen}
          />
          <CommonAction
            title={t('Spending details')}
            to='/usage-logs'
            icon={ReceiptText}
          />
        </section>
      </div>
    </div>
  )
}

export function EasyOverviewDashboard() {
  const user = useAuthStore((state) => state.auth.user)
  const apiKeysQuery = useQuery({
    queryKey: ['dashboard', 'easy-overview', 'api-keys'],
    queryFn: async () => {
      const result = await getApiKeys({ p: 1, size: 1 })
      return result.success ? (result.data?.items ?? []) : []
    },
    staleTime: 60 * 1000,
  })

  return (
    <EasyOverviewDashboardView
      remainQuota={Number(user?.quota ?? 0)}
      usedQuota={Number(user?.used_quota ?? 0)}
      requestCount={Number(user?.request_count ?? 0)}
      hasApiKey={Boolean(apiKeysQuery.data?.length)}
    />
  )
}
