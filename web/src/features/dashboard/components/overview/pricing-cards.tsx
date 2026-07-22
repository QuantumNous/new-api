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
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Check, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPublicPlans } from '@/features/subscriptions/api'
import { formatDuration } from '@/features/subscriptions/lib/format'
import type { SubscriptionPlan } from '@/features/subscriptions/types'

/**
 * Pricing plan teasers shown on the dashboard overview.
 *
 * Reads enabled SubscriptionPlan records from `/api/subscription/plans` —
 * admins manage them in the Subscriptions admin page (no need for separate
 * dashboard pricing config). When no plan is enabled, the entire card is
 * hidden.
 *
 * Highlighting: the plan with the highest `sort_order` is marked as
 * "Recommended" (matches the existing convention where higher sort_order
 * means higher priority in the subscriptions admin table).
 */
export function PricingCards() {
  const { t } = useTranslation()

  const plansQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'public-plans'],
    queryFn: async () => {
      const result = await getPublicPlans()
      return result.success ? (result.data ?? []) : []
    },
    staleTime: 5 * 60 * 1000,
  })

  const sortedPlans = useMemo(() => {
    const records = plansQuery.data ?? []
    return records
      .map((r) => r.plan)
      .filter((p) => p.enabled)
      .sort((a, b) => (b.sort_order ?? 0) - (a.sort_order ?? 0))
  }, [plansQuery.data])

  // Pick the plan with the highest sort_order as the highlighted/recommended one.
  const highlightId = sortedPlans[0]?.id

  if (plansQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='text-base sm:text-lg'>
            {t('Pricing Plans')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-32 w-full rounded-xl' />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (sortedPlans.length === 0) {
    return null
  }

  const gridCols =
    sortedPlans.length >= 4
      ? 'lg:grid-cols-4'
      : sortedPlans.length === 3
        ? 'lg:grid-cols-3'
        : sortedPlans.length === 2
          ? 'lg:grid-cols-2'
          : 'lg:grid-cols-1'

  return (
    <Card>
      <CardHeader className='flex flex-row items-end justify-between gap-3'>
        <div>
          <CardTitle className='text-base sm:text-lg'>
            {t('Pricing Plans')}
          </CardTitle>
          <p className='text-xs text-muted-foreground mt-0.5'>
            {t('Transparent, pay by usage')}
          </p>
        </div>
        <Link
          to='/subscriptions'
          className='inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-blue)] hover:underline'
        >
          {t('View all plans')}
          <ArrowRight className='size-3' aria-hidden />
        </Link>
      </CardHeader>
      <CardContent>
        <div className={cn('grid grid-cols-2 gap-3', gridCols)}>
          {sortedPlans.map((plan) => (
            <PlanTile
              key={plan.id}
              plan={plan}
              highlight={plan.id === highlightId && sortedPlans.length > 1}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PlanTile({
  plan,
  highlight,
}: {
  plan: SubscriptionPlan
  highlight: boolean
}) {
  const { t } = useTranslation()

  const priceLabel = useMemo(() => {
    const amount = Number(plan.price_amount) || 0
    const currency = plan.currency || 'USD'
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(amount)
    } catch {
      return `${currency} ${amount.toFixed(2)}`
    }
  }, [plan.price_amount, plan.currency])

  const durationLabel = formatDuration(plan, t)
  const totalQuota = Number(plan.total_amount) || 0

  return (
    <div
      className={cn(
        'relative flex flex-col gap-2 rounded-xl border bg-background/60 p-3 transition',
        highlight &&
          'border-[var(--accent-blue)]/40 bg-[color-mix(in_oklch,var(--accent-blue)_5%,transparent)] shadow-[0_4px_18px_var(--ring-glow)]'
      )}
    >
      {highlight && (
        <span className='absolute -top-2 right-2 inline-flex items-center gap-1 rounded-full bg-[var(--accent-blue)] px-2 py-0.5 text-[10px] font-medium text-white shadow-sm'>
          <Star className='size-3' aria-hidden />
          {t('Recommended')}
        </span>
      )}
      <div className='text-xs font-medium text-muted-foreground'>
        {plan.title}
      </div>
      <div className='flex items-baseline gap-1 font-semibold'>
        <span className='text-2xl tabular-nums'>{priceLabel}</span>
        <span className='text-xs text-muted-foreground'>/ {durationLabel}</span>
      </div>
      <ul className='flex flex-col gap-1 text-xs text-muted-foreground'>
        {plan.subtitle && (
          <li className='inline-flex items-center gap-1.5'>
            <Check className='size-3 text-success' aria-hidden />
            {plan.subtitle}
          </li>
        )}
        {totalQuota > 0 && (
          <li className='inline-flex items-center gap-1.5'>
            <Check className='size-3 text-success' aria-hidden />
            {t('Includes {{count}} quota', { count: totalQuota })}
          </li>
        )}
      </ul>
      <Button
        size='sm'
        variant={highlight ? 'default' : 'outline'}
        className='mt-2 h-8 w-full'
        render={<Link to='/subscriptions' />}
      >
        {t('Subscribe')}
      </Button>
    </div>
  )
}
