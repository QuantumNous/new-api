import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CalendarClock, CreditCard, RefreshCw, Settings2 } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
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
    resolver: zodResolver(schema),
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
          toast.success(t('更新成功'))
          onOpenChange(false)
          triggerRefresh()
        }
      } else {
        const res = await createPlan(payload)
        if (res.success) {
          toast.success(t('创建成功'))
          onOpenChange(false)
          triggerRefresh()
        }
      }
    } catch {
      toast.error(t('请求失败'))
    } finally {
      setLoading(false)
    }
  }

  const durationUnitOpts = getDurationUnitOptions(t)
  const resetPeriodOpts = getResetPeriodOptions(t)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-lg overflow-y-auto'>
        <SheetHeader>
          <SheetTitle>
            {isEdit ? t('更新套餐信息') : t('创建新的订阅套餐')}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? t('修改现有订阅套餐的配置')
              : t('填写以下信息创建新的订阅套餐')}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='flex flex-1 flex-col gap-4 overflow-y-auto px-1'
        >
          {/* Basic Info Section */}
          <div className='flex items-center gap-2 text-sm font-medium'>
            <Settings2 className='h-4 w-4' />
            {t('基本信息')}
          </div>

          <div className='grid gap-3'>
            <div className='grid gap-1.5'>
              <Label>{t('套餐标题')} *</Label>
              <Input
                placeholder={t('例如：基础套餐')}
                {...form.register('title')}
              />
              {form.formState.errors.title && (
                <p className='text-xs text-destructive'>
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div className='grid gap-1.5'>
              <Label>{t('套餐副标题')}</Label>
              <Input
                placeholder={t('例如：适合轻度使用')}
                {...form.register('subtitle')}
              />
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='grid gap-1.5'>
                <Label>{t('实付金额')} *</Label>
                <Input
                  type='number'
                  step='0.01'
                  min={0}
                  {...form.register('price_amount')}
                />
              </div>
              <div className='grid gap-1.5'>
                <Label>{t('总额度')}</Label>
                <Input
                  type='number'
                  min={0}
                  {...form.register('total_amount')}
                />
                <p className='text-xs text-muted-foreground'>
                  {t('0 表示不限')}
                </p>
              </div>
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='grid gap-1.5'>
                <Label>{t('升级分组')}</Label>
                <Select
                  value={form.watch('upgrade_group') || ''}
                  onValueChange={(v) =>
                    form.setValue('upgrade_group', v === '__none__' ? '' : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('不升级')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>{t('不升级')}</SelectItem>
                    {groupOptions.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='grid gap-1.5'>
                <Label>{t('购买上限')}</Label>
                <Input
                  type='number'
                  min={0}
                  {...form.register('max_purchase_per_user')}
                />
                <p className='text-xs text-muted-foreground'>
                  {t('0 表示不限')}
                </p>
              </div>
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='grid gap-1.5'>
                <Label>{t('排序')}</Label>
                <Input
                  type='number'
                  {...form.register('sort_order')}
                />
              </div>
              <div className='flex items-center gap-2 pt-6'>
                <Switch
                  checked={form.watch('enabled')}
                  onCheckedChange={(v) => form.setValue('enabled', v)}
                />
                <Label>{t('启用状态')}</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Duration Section */}
          <div className='flex items-center gap-2 text-sm font-medium'>
            <CalendarClock className='h-4 w-4' />
            {t('有效期设置')}
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='grid gap-1.5'>
              <Label>{t('有效期单位')}</Label>
              <Select
                value={form.watch('duration_unit')}
                onValueChange={(v: any) => form.setValue('duration_unit', v)}
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
                  ? t('自定义秒数')
                  : t('有效期数值')}
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
            {t('额度重置')}
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='grid gap-1.5'>
              <Label>{t('重置周期')}</Label>
              <Select
                value={form.watch('quota_reset_period')}
                onValueChange={(v: any) =>
                  form.setValue('quota_reset_period', v)
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
              <Label>{t('自定义秒数')}</Label>
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
            {t('第三方支付配置')}
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
              {t('取消')}
            </Button>
            <Button type='submit' disabled={loading}>
              {loading ? t('提交中...') : t('提交')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
