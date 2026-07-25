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
import { ArrowUpCircle, Crown, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Dialog } from '@/components/dialog'
import { StatusBadge } from '@/components/status-badge'
import { formatDuration, formatModelCount, formatResetPeriod } from '../../lib'
import type { PlanRecord, UserSubscriptionRecord } from '../../types'

interface BillingPreferenceOption {
  value: string
  label: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  // 正在管理的当前活跃订阅
  currentSub: UserSubscriptionRecord | null
  currentPlanTitle: string
  // 当前订阅对应的套餐档（用于取价格做「更高档」判断），可能为空（Free 不在购买列表）
  currentPlan: PlanRecord | null
  // 全部可购买套餐
  plans: PlanRecord[]
  // 订阅数据抓取时的服务端近似时间，避免 render 中读取不稳定时钟
  snapshotTime: number
  // 计费偏好
  billingPreference: string
  preferenceOptions: BillingPreferenceOption[]
  preferenceLabel: (pref: string) => string
  onPreferenceChange: (pref: string) => void
  // 点击某档「升级/切换」→ 打开购买弹窗
  onSelectPlan: (plan: PlanRecord) => void
  // 每档已购次数（用于购买上限判断）
  purchaseCountMap: Map<number, number>
}

export function SubscriptionManageDialog({
  open,
  onOpenChange,
  currentSub,
  currentPlanTitle,
  currentPlan,
  plans,
  snapshotTime,
  billingPreference,
  preferenceOptions,
  preferenceLabel,
  onPreferenceChange,
  onSelectPlan,
  purchaseCountMap,
}: Props) {
  const { t } = useTranslation()

  const subscription = currentSub?.subscription
  const totalAmount = Number(subscription?.amount_total || 0)
  const usedAmount = Number(subscription?.amount_used || 0)
  const remainAmount =
    totalAmount > 0 ? Math.max(0, totalAmount - usedAmount) : 0
  const usagePercent =
    totalAmount > 0 ? Math.round((usedAmount / totalAmount) * 100) : 0
  const endTime = subscription?.end_time || 0
  const remainDays =
    endTime && snapshotTime
      ? Math.max(0, Math.ceil((endTime - snapshotTime) / 86400))
      : 0

  const currentPrice = Number(currentPlan?.plan?.price_amount ?? -1)
  const currentPlanId = currentPlan?.plan?.id ?? -1

  // 「更高档」= 价格高于当前档的其它套餐（当前档未知价格时展示所有其它档）
  const upgradePlans = plans.filter((p) => {
    const plan = p?.plan
    if (!plan || plan.id === currentPlanId) return false
    if (currentPrice < 0) return true
    return Number(plan.price_amount || 0) > currentPrice
  })

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <>
          <Crown className='h-5 w-5' />
          {t('Manage Subscription')}
        </>
      }
      contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-lg'
      titleClassName='flex items-center gap-2'
      contentHeight='auto'
      bodyClassName='space-y-4'
    >
      <div className='space-y-4'>
        {/* 当前套餐概览 */}
        <div className='bg-muted/40 space-y-3 rounded-xl border p-4'>
          <div className='flex items-center justify-between gap-2'>
            <div className='flex items-center gap-2'>
              <span className='text-base font-semibold'>
                {currentPlanTitle || t('Current Plan')}
              </span>
              <StatusBadge
                label={t('Active')}
                variant='success'
                copyable={false}
              />
            </div>
            {remainDays > 0 && (
              <span className='text-muted-foreground text-xs'>
                {t('{{count}} days remaining', { count: remainDays })}
              </span>
            )}
          </div>

          {totalAmount > 0 ? (
            <div className='space-y-1.5'>
              <div className='text-muted-foreground flex items-center justify-between text-xs'>
                <span>
                  {formatQuota(usedAmount)} / {formatQuota(totalAmount)}
                </span>
                <span>
                  {t('Remaining')} {formatQuota(remainAmount)} · {t('Used')}{' '}
                  {usagePercent}%
                </span>
              </div>
              <Progress value={usagePercent} className='h-1.5' />
            </div>
          ) : (
            <div className='text-muted-foreground text-xs'>
              {t('Unlimited')}
            </div>
          )}

          {endTime > 0 && (
            <div className='text-muted-foreground text-xs'>
              {t('Until')} {new Date(endTime * 1000).toLocaleString()}
            </div>
          )}
        </div>

        {/* 计费偏好（修改） */}
        <div className='space-y-2'>
          <div className='text-sm font-medium'>{t('Billing Preference')}</div>
          <Select
            items={preferenceOptions}
            value={billingPreference}
            onValueChange={(v) => v !== null && onPreferenceChange(v)}
          >
            <SelectTrigger className='h-9 w-full'>
              <SelectValue>{preferenceLabel(billingPreference)}</SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {preferenceOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Controls whether subscription quota or wallet balance is used first.'
            )}
          </p>
        </div>

        <Separator />

        {/* 升级 / 切换套餐 */}
        <div className='space-y-2.5'>
          <div className='flex items-center gap-2 text-sm font-medium'>
            <ArrowUpCircle className='text-primary h-4 w-4' />
            {t('Upgrade or switch plan')}
          </div>
          {upgradePlans.length > 0 ? (
            <div className='space-y-2'>
              {upgradePlans.map((p) => {
                const plan = p.plan
                const limit = Number(plan.max_purchase_per_user || 0)
                const count = purchaseCountMap.get(plan.id) || 0
                const reached = limit > 0 && count >= limit
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-lg border p-3',
                      'hover:border-primary/50 transition-colors'
                    )}
                  >
                    <div className='min-w-0'>
                      <div className='flex items-center gap-1.5'>
                        <span className='truncate text-sm font-medium'>
                          {plan.title}
                        </span>
                        <Sparkles className='text-primary h-3 w-3 shrink-0' />
                      </div>
                      <div className='text-muted-foreground text-xs'>
                        ${Number(plan.price_amount || 0).toFixed(2)} ·{' '}
                        {formatModelCount(plan, t)} · {formatDuration(plan, t)}
                        {formatResetPeriod(plan, t) !== t('No Reset')
                          ? ` · ${formatResetPeriod(plan, t)}`
                          : ''}
                      </div>
                    </div>
                    <Button
                      size='sm'
                      disabled={reached}
                      onClick={() => onSelectPlan(p)}
                    >
                      {reached ? t('Limit Reached') : t('Upgrade')}
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className='text-muted-foreground text-xs'>
              {t('You are already on the highest plan.')}
            </p>
          )}
        </div>
      </div>
    </Dialog>
  )
}
