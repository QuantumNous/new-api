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
import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, Clock3, KeyRound, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { getSelfSubscriptionFull } from '@/features/subscriptions/api'
import type {
  PlanRecord,
  UserSubscriptionRecord,
} from '@/features/subscriptions/types'
import { GLASS_CARD_CLS, QUOTA_PER_DOLLAR } from '../constants'

type TrialStatus = 'not_claimed' | 'active' | 'expired' | 'depleted'

function formatUsdAmount(quota: number): string {
  const amount = quota / QUOTA_PER_DOLLAR
  return `$${amount.toFixed(2)}`
}

function formatDateTime(timestamp: number): string {
  if (!timestamp) return '-'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp * 1000))
}

function resolveTrialSubscription(
  plans: PlanRecord[],
  subscriptions: UserSubscriptionRecord[]
): {
  plan: PlanRecord | null
  subscription: UserSubscriptionRecord | null
} {
  const trialPlans = plans.filter((item) => item.plan.plan_type === 'gpt_trial')
  const plansById = new Map(trialPlans.map((item) => [item.plan.id, item]))
  const allCandidates = subscriptions
    .map((item) => ({
      subscription: item,
      plan: plansById.get(item.subscription.plan_id) || null,
    }))
    .filter((item) => item.plan !== null)
    .sort(
      (a, b) =>
        Number(b.subscription.subscription.end_time || 0) -
        Number(a.subscription.subscription.end_time || 0)
    )

  const latest = allCandidates[0] || null

  return {
    plan: latest?.plan || trialPlans.find((item) => item.plan.enabled) || null,
    subscription: latest?.subscription || null,
  }
}

export function TrialSubscriptionSection() {
  const { i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [subscriptions, setSubscriptions] = useState<UserSubscriptionRecord[]>(
    []
  )

  const isZh = i18n.language.startsWith('zh')
  const copy = isZh
    ? {
        sectionTitle: '我的订阅',
        sectionSubtitle: '查看试用订阅状态和剩余用量',
        statusActive: '有效',
        statusNotClaimed: '未领取',
        statusExpired: '已过期',
        statusDepleted: '已用完',
        description: '7 天 GPT 试用，按官方原价计费',
        validity: '到期时间',
        remaining: '剩余额度',
        scope: '适用范围',
        group: '使用分组',
        notClaimedValue: '领取后会显示在这里',
        gptOnly: '仅限 GPT 模型',
        freeTrialGroup: 'Subscription',
        createKey: '创建Key（选择Subscription分组）',
        startRequest: '创建后即可开始试用请求',
        daysLeft: (days: number, date: string) => `剩余 ${days} 天 (${date})`,
      }
    : {
        sectionTitle: 'My Subscription',
        sectionSubtitle:
          'View your trial subscription status and remaining credits',
        statusActive: 'Active',
        statusNotClaimed: 'Not claimed',
        statusExpired: 'Expired',
        statusDepleted: 'Depleted',
        description: '7-day GPT trial at official pricing',
        validity: 'Expires',
        remaining: 'Remaining',
        scope: 'Scope',
        group: 'Group',
        notClaimedValue: 'Your trial will appear here after claim',
        gptOnly: 'GPT models only',
        freeTrialGroup: 'Subscription',
        createKey: 'Create Key (Subscription group)',
        startRequest: 'Create a key to start using the trial',
        daysLeft: (days: number, date: string) => `${days} days left (${date})`,
      }

  useEffect(() => {
    let active = true
    const fetchData = async () => {
      try {
        const selfRes = await getSelfSubscriptionFull()
        if (!active) return
        setPlans(selfRes.data?.plans || [])
        setSubscriptions(selfRes.data?.all_subscriptions || [])
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void fetchData()
    return () => {
      active = false
    }
  }, [])

  const trial = useMemo(
    () => resolveTrialSubscription(plans, subscriptions),
    [plans, subscriptions]
  )

  const subscription = trial.subscription?.subscription || null
  const totalQuota = Number(
    subscription?.amount_total || trial.plan?.plan.total_amount || 0
  )
  const usedQuota = Math.max(0, Number(subscription?.amount_used || 0))
  const remainingQuota = Math.max(totalQuota - usedQuota, 0)
  const usedPercent =
    totalQuota > 0 ? Math.min(100, (usedQuota / totalQuota) * 100) : 0
  const expiryDate = subscription?.end_time || 0
  const now = Date.now() / 1000
  const remainingDays =
    expiryDate > now ? Math.max(0, Math.ceil((expiryDate - now) / 86400)) : 0

  let status: TrialStatus = 'not_claimed'
  if (subscription) {
    if (expiryDate > 0 && expiryDate <= now) {
      status = 'expired'
    } else if (totalQuota > 0 && remainingQuota <= 0) {
      status = 'depleted'
    } else {
      status = 'active'
    }
  }

  const statusLabel =
    status === 'active'
      ? copy.statusActive
      : status === 'expired'
        ? copy.statusExpired
        : status === 'depleted'
          ? copy.statusDepleted
          : copy.statusNotClaimed

  const statusClassName =
    status === 'active'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
      : status === 'not_claimed'
        ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700/60 dark:text-zinc-200'
        : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'

  const expiryValue =
    status === 'active'
      ? copy.daysLeft(remainingDays, formatDateTime(expiryDate))
      : expiryDate > 0
        ? formatDateTime(expiryDate)
        : copy.notClaimedValue

  const description = trial.plan?.plan.subtitle || copy.description

  if (loading) {
    return (
      <section className='space-y-3'>
        <div>
          <Skeleton className='h-7 w-28' />
          <Skeleton className='mt-2 h-4 w-56' />
        </div>
        <div className={`${GLASS_CARD_CLS} space-y-4 p-6`}>
          <Skeleton className='h-16 w-full' />
          <Skeleton className='h-20 w-full' />
          <Skeleton className='h-3 w-full' />
        </div>
      </section>
    )
  }

  return (
    <section className='space-y-4'>
      <div className='space-y-1'>
        <h2 className='text-2xl font-semibold tracking-tight'>
          {copy.sectionTitle}
        </h2>
        <p className='text-muted-foreground text-sm'>{copy.sectionSubtitle}</p>
      </div>

      <div className={`${GLASS_CARD_CLS} overflow-hidden`}>
        <div className='flex flex-col gap-4 border-b border-zinc-200/70 px-6 py-5 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-700/70'>
          <div className='min-w-0 space-y-2'>
            <div className='flex flex-wrap items-center gap-2'>
              <div className='flex size-8 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300'>
                <Sparkles className='size-4' />
              </div>
              <div className='text-xl font-semibold tracking-tight'>
                {trial.plan?.plan.title || '-'}
              </div>
              <span className='rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300'>
                OpenAI
              </span>
            </div>
            <p className='text-muted-foreground pl-10 text-sm'>{description}</p>
          </div>

          <div
            className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-sm font-medium ${statusClassName}`}
          >
            <CheckCircle2 className='size-4' />
            {statusLabel}
          </div>
        </div>

        <div className='space-y-5 px-6 py-5'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1'>
              <div className='text-muted-foreground text-sm'>
                {copy.validity}
              </div>
              <div className='flex items-center gap-2 text-base font-medium'>
                <Clock3 className='text-muted-foreground size-4' />
                <span>{expiryValue}</span>
              </div>
            </div>

            <div className='space-y-1'>
              <div className='text-muted-foreground text-sm'>
                {copy.remaining}
              </div>
              <div className='text-right text-2xl font-semibold tracking-tight sm:text-left'>
                {formatUsdAmount(remainingQuota)} /{' '}
                {formatUsdAmount(totalQuota)}
              </div>
            </div>
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1'>
              <div className='text-muted-foreground text-sm'>{copy.scope}</div>
              <div className='text-base font-medium'>{copy.gptOnly}</div>
            </div>

            <div className='space-y-1'>
              <div className='text-muted-foreground text-sm'>{copy.group}</div>
              <div className='text-base font-medium'>{copy.freeTrialGroup}</div>
            </div>
          </div>

          <div className='space-y-2'>
            <div className='text-muted-foreground flex items-center justify-between text-sm'>
              <span>{copy.remaining}</span>
              <span>{Math.max(0, 100 - usedPercent).toFixed(0)}%</span>
            </div>
            <Progress
              value={Math.max(0, 100 - usedPercent)}
              className='h-2.5'
            />
          </div>

          {status === 'active' && (
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <div className='text-muted-foreground text-sm'>
                {copy.startRequest}
              </div>
              <Button render={<Link to='/keys' />} className='gap-2 self-start'>
                <KeyRound className='size-4' />
                {copy.createKey}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
