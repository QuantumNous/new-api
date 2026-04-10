import { useEffect, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarClock, CreditCard, RefreshCw, Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { createPlan, updatePlan, getGroups } from '../api'
import { getDurationUnitOptions, getResetPeriodOptions } from '../constants'
import {
  getPlanFormSchema,
  PLAN_FORM_DEFAULTS,
  planToFormValues,
  formValuesToPlanPayload,
  type PlanFormValues,
} from '../lib'
import type { PlanRecord } from '../types'
import { useSubscriptions } from './subscriptions-provider'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: PlanRecord
}

export function SubscriptionsMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: Props) {
  const { t } = useTranslation()
  const isEdit = !!currentRow?.plan?.id
  const { triggerRefresh } = useSubscriptions()
  const [loading, setLoading] = useState(false)
  const [groupOptions, setGroupOptions] = useState<string[]>([])

  const schema = getPlanFormSchema(t)
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<PlanFormValues>,
    defaultValues: PLAN_FORM_DEFAULTS,
  })

  useEffect(() => {
    if (open) {
      if (currentRow?.plan) {
        form.reset(planToFormValues(currentRow.plan))
      } else {
        form.reset(PLAN_FORM_DEFAULTS)
      }
      getGroups()
        .then((res) => {
          if (res.success) setGroupOptions(res.data || [])
        })
        .catch(() => {})
    }
  }, [open, currentRow, form])

  const durationUnit = form.watch('duration_unit')
  const resetPeriod = form.watch('quota_reset_period')

  const onSubmit = async (values: PlanFormValues) => {
    setLoading(true)
    try {
      const payload = formValuesToPlanPayload(values)
      if (isEdit && currentRow?.plan?.id) {
        const res = await updatePlan(currentRow.plan.id, payload)
        if (res.success) {
          toast.success(t('Update succeeded'))
          onOpenChange(false)
          triggerRefresh()
        }
      } else {
        const res = await createPlan(payload)
        if (res.success) {
          toast.success(t('Create succeeded'))
          onOpenChange(false)
          triggerRefresh()
        }
      }
    } catch {
      toast.error(t('Request failed'))
    } finally {
      setLoading(false)
    }
  }

  const durationUnitOpts = getDurationUnitOptions(t)
  const resetPeriodOpts = getResetPeriodOptions(t)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col overflow-y-auto sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>
            {isEdit ? t('Update plan info') : t('Create new subscription plan')}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? t('Modify existing subscription plan configuration')
              : t(
                  'Fill in the following info to create a new subscription plan'
                )}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='flex flex-1 flex-col gap-4 overflow-y-auto px-1'
        >
          {/* Basic Info Section */}
          <div className='flex items-center gap-2 text-sm font-medium'>
            <Settings2 className='h-4 w-4' />
            {t('Basic Info')}
          </div>

          <div className='grid gap-3'>
            <div className='grid gap-1.5'>
              <Label>{t('Plan Title')} *</Label>
              <Input
                placeholder={t('e.g. Basic Plan')}
                {...form.register('title')}
              />
              {form.formState.errors.title && (
                <p className='text-destructive text-xs'>
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div className='grid gap-1.5'>
              <Label>{t('Plan Subtitle')}</Label>
              <Input
                placeholder={t('e.g. Suitable for light usage')}
                {...form.register('subtitle')}
              />
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='grid gap-1.5'>
                <Label>{t('Actual Amount')} *</Label>
                <Input
                  type='number'
                  step='0.01'
                  min={0}
                  {...form.register('price_amount')}
                />
              </div>
              <div className='grid gap-1.5'>
                <Label>{t('Total Quota')}</Label>
                <Input
                  type='number'
                  min={0}
                  {...form.register('total_amount')}
                />
                <p className='text-muted-foreground text-xs'>
                  {t('0 means unlimited')}
                </p>
              </div>
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='grid gap-1.5'>
                <Label>{t('Upgrade Group')}</Label>
                <Select
                  value={form.watch('upgrade_group') || ''}
                  onValueChange={(v) =>
                    form.setValue('upgrade_group', v === '__none__' ? '' : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('No Upgrade')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>{t('No Upgrade')}</SelectItem>
                    {groupOptions.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='grid gap-1.5'>
                <Label>{t('Purchase Limit')}</Label>
                <Input
                  type='number'
                  min={0}
                  {...form.register('max_purchase_per_user')}
                />
                <p className='text-muted-foreground text-xs'>
                  {t('0 means unlimited')}
                </p>
              </div>
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='grid gap-1.5'>
                <Label>{t('Sort Order')}</Label>
                <Input type='number' {...form.register('sort_order')} />
              </div>
              <div className='flex items-center gap-2 pt-6'>
                <Switch
                  checked={form.watch('enabled')}
                  onCheckedChange={(v) => form.setValue('enabled', v)}
                />
                <Label>{t('Enabled Status')}</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Duration Section */}
          <div className='flex items-center gap-2 text-sm font-medium'>
            <CalendarClock className='h-4 w-4' />
            {t('Duration Settings')}
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='grid gap-1.5'>
              <Label>{t('Duration Unit')}</Label>
              <Select
                value={form.watch('duration_unit')}
                onValueChange={(v) =>
                  form.setValue(
                    'duration_unit',
                    v as PlanFormValues['duration_unit']
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durationUnitOpts.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-1.5'>
              <Label>
                {durationUnit === 'custom'
                  ? t('Custom Seconds')
                  : t('Duration Value')}
              </Label>
              <Input
                type='number'
                min={1}
                {...form.register(
                  durationUnit === 'custom'
                    ? 'custom_seconds'
                    : 'duration_value'
                )}
              />
            </div>
          </div>

          <Separator />

          {/* Reset Section */}
          <div className='flex items-center gap-2 text-sm font-medium'>
            <RefreshCw className='h-4 w-4' />
            {t('Quota Reset')}
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='grid gap-1.5'>
              <Label>{t('Reset Cycle')}</Label>
              <Select
                value={form.watch('quota_reset_period')}
                onValueChange={(v) =>
                  form.setValue(
                    'quota_reset_period',
                    v as PlanFormValues['quota_reset_period']
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resetPeriodOpts.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Custom Seconds')}</Label>
              <Input
                type='number'
                min={0}
                disabled={resetPeriod !== 'custom'}
                {...form.register('quota_reset_custom_seconds')}
              />
            </div>
          </div>

          <Separator />

          {/* Payment Section */}
          <div className='flex items-center gap-2 text-sm font-medium'>
            <CreditCard className='h-4 w-4' />
            {t('Third-party Payment Config')}
          </div>

          <div className='grid gap-3'>
            <div className='grid gap-1.5'>
              <Label>Stripe Price ID</Label>
              <Input
                placeholder='price_...'
                {...form.register('stripe_price_id')}
              />
            </div>
            <div className='grid gap-1.5'>
              <Label>Creem Product ID</Label>
              <Input
                placeholder='prod_...'
                {...form.register('creem_product_id')}
              />
            </div>
          </div>

          <SheetFooter className='mt-auto gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              {t('Cancel')}
            </Button>
            <Button type='submit' disabled={loading}>
              {loading ? t('Submitting...') : t('Submit')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
