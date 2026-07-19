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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DateTimePicker } from '@/components/datetime-picker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { addTimeToDate } from '@/lib/time'

import { createUserSubscriptionsBatch, getAdminPlans } from '../../api'
import {
  getEndTimeHint,
  getGrantModeDescription,
  getGrantModeOptions,
} from '../../constants'
import type {
  BatchBindSubscriptionResult,
  PlanRecord,
  SubscriptionGrantMode,
} from '../../types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userIds: number[]
  onSuccess?: () => void
}

export function BatchAssignSubscriptionDialog(props: Props) {
  const { t } = useTranslation()
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [mode, setMode] = useState<SubscriptionGrantMode>('create')
  const [endTime, setEndTime] = useState<Date | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<BatchBindSubscriptionResult | null>(null)

  const grantModeOptions = useMemo(() => getGrantModeOptions(t), [t])

  useEffect(() => {
    if (!props.open) return
    setSelectedPlanId('')
    setMode('create')
    setEndTime(undefined)
    setResult(null)
    getAdminPlans()
      .then((res) => {
        if (res.success) setPlans(res.data || [])
      })
      .catch(() => toast.error(t('Loading failed')))
  }, [props.open, t])

  const handleSubmit = async () => {
    if (!selectedPlanId) {
      toast.error(t('Please select a subscription plan'))
      return
    }
    setSubmitting(true)
    try {
      const res = await createUserSubscriptionsBatch({
        user_ids: props.userIds,
        plan_id: Number(selectedPlanId),
        mode,
        end_time: endTime ? Math.floor(endTime.getTime() / 1000) : 0,
      })
      if (res.success && res.data) {
        setResult(res.data)
        if (res.data.success_count > 0) props.onSuccess?.()
      }
    } catch {
      toast.error(t('Request failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Batch assign subscription')}</DialogTitle>
          <DialogDescription>
            {t('{{count}} users selected', { count: props.userIds.length })}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className='flex flex-col gap-3'>
            <div className='text-sm'>
              {t('Plan')}: {result.plan_title || `#${result.plan_id}`}
            </div>
            <div className='text-sm'>
              {t('Succeeded: {{success}}, failed: {{failed}}', {
                success: result.success_count,
                failed: result.failed_count,
              })}
            </div>
            {(result.failed ?? []).length > 0 && (
              <div className='max-h-64 overflow-y-auto rounded-md border'>
                {(result.failed ?? []).map((f) => (
                  <div
                    key={f.user_id}
                    className='flex items-start justify-between gap-3 border-b px-3 py-2 text-sm last:border-b-0'
                  >
                    <span className='shrink-0'>ID: {f.user_id}</span>
                    <span className='text-muted-foreground text-right'>
                      {f.reason}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className='flex flex-col gap-4'>
            <div className='flex flex-col gap-2'>
              <span className='text-sm font-medium'>
                {t('Subscription plan')}
              </span>
              <Select
                items={plans.map((p) => ({
                  value: String(p.plan.id),
                  label: (
                    <>
                      {p.plan.title}($
                      {Number(p.plan.price_amount || 0).toFixed(2)})
                    </>
                  ),
                }))}
                value={selectedPlanId}
                onValueChange={(v) => v !== null && setSelectedPlanId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('Select subscription plan')} />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {plans.map((p) => (
                      <SelectItem key={p.plan.id} value={String(p.plan.id)}>
                        {p.plan.title} ($
                        {Number(p.plan.price_amount || 0).toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className='flex flex-col gap-2'>
              <span className='text-sm font-medium'>{t('Assign mode')}</span>
              <Select
                items={grantModeOptions}
                value={mode}
                onValueChange={(v) =>
                  v !== null && setMode(v as SubscriptionGrantMode)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {grantModeOptions.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className='text-muted-foreground text-sm'>
                {getGrantModeDescription(t, mode)}
              </p>
            </div>

            <div className='flex flex-col gap-2'>
              <span className='text-sm font-medium'>
                {t('Custom expiration time')}
              </span>
              <DateTimePicker
                value={endTime}
                onChange={setEndTime}
                placeholder={t('Use the plan default duration')}
              />
              <div className='grid grid-cols-4 gap-1.5 sm:flex sm:gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => setEndTime(addTimeToDate(0, 0, 0))}
                >
                  {t('Plan default')}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => setEndTime(addTimeToDate(1, 0, 0))}
                >
                  {t('1M')}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => setEndTime(addTimeToDate(0, 7, 0))}
                >
                  {t('1W')}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => setEndTime(addTimeToDate(0, 1, 0))}
                >
                  {t('1 Day')}
                </Button>
              </div>
              <p className='text-muted-foreground text-sm'>
                {getEndTimeHint(t, mode, !!endTime)}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => props.onOpenChange(false)}>
              {t('Close')}
            </Button>
          ) : (
            <>
              <Button
                variant='outline'
                onClick={() => props.onOpenChange(false)}
                disabled={submitting}
              >
                {t('Cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !selectedPlanId}
              >
                {t('Confirm')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
