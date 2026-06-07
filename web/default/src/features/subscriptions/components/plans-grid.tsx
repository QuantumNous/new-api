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
import { useTranslation } from 'react-i18next'
import { Check, X, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getAdminPlans } from '../api'
import { useSubscriptions } from './subscriptions-provider'

const PLAN_COLORS = [
  'bg-neutral-400',
  'bg-primary',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
]

export function PlansGrid() {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = useSubscriptions()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-subscription-plans'],
    queryFn: async () => {
      const result = await getAdminPlans()
      return result.data || []
    },
  })

  const plans = useMemo(() => data || [], [data])

  if (isLoading) {
    return (
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className='h-80 rounded-[8px]' />
        ))}
      </div>
    )
  }

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
      {plans.map((record, index) => {
        const plan = record.plan
        const colorClass = PLAN_COLORS[index % PLAN_COLORS.length]
        const isCustomPrice = plan.price_amount === 0 && plan.title.toLowerCase().includes('enterprise')

        return (
          <div
            key={plan.id}
            className='relative overflow-hidden rounded-[8px] border border-border bg-card px-5 py-5 shadow-sm'
          >
            <div
              className={`absolute top-0 left-0 right-0 h-[3px] ${colorClass}`}
            />
            <div className='mb-3 flex items-center justify-between'>
              <span className='text-base font-semibold'>{plan.title}</span>
              <Badge
                variant={plan.enabled ? 'default' : 'secondary'}
                className='rounded-full text-[11px]'
              >
                {plan.enabled ? t('Public') : t('Custom')}
              </Badge>
            </div>
            <div className='mb-2 text-[32px] font-semibold tracking-tight'>
              {isCustomPrice ? (
                t('Custom')
              ) : (
                <>
                  ${plan.price_amount}
                  <span className='text-sm font-normal text-muted-foreground'>
                    /
                    {plan.duration_unit === 'month'
                      ? t('month')
                      : plan.duration_unit === 'year'
                        ? t('year')
                        : plan.duration_unit}
                  </span>
                </>
              )}
            </div>
            <p className='mb-4 text-sm text-muted-foreground'>
              {plan.subtitle || '-'}
            </p>
            <ul className='mb-4 flex flex-col gap-2 text-sm'>
              <li className='flex items-center gap-1.5'>
                <Check className='size-3.5 text-success' />
                {plan.total_amount > 0
                  ? t('Quota: {{amount}}', { amount: plan.total_amount })
                  : t('Unlimited quota')}
              </li>
              <li className='flex items-center gap-1.5'>
                <Check className='size-3.5 text-success' />
                {t('Max purchase: {{count}}', { count: plan.max_purchase_per_user })}
              </li>
              <li className='flex items-center gap-1.5'>
                {plan.allow_balance_pay ? (
                  <Check className='size-3.5 text-success' />
                ) : (
                  <X className='size-3.5 text-muted-foreground' />
                )}
                {t('Balance payment')}
              </li>
              <li className='flex items-center gap-1.5'>
                {plan.upgrade_group ? (
                  <Check className='size-3.5 text-success' />
                ) : (
                  <X className='size-3.5 text-muted-foreground' />
                )}
                {t('Group upgrade')}
              </li>
            </ul>
            <Button
              variant='outline'
              className='w-full'
              onClick={() => {
                setCurrentRow(record)
                setOpen('update')
              }}
            >
              <Pencil className='mr-1.5 size-3.5' />
              {t('Edit')}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
