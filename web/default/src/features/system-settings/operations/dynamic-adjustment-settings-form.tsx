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
import * as z from 'zod'
import { useForm, type Path, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useResetForm } from '../hooks/use-reset-form'
import type { ChannelDynamicSettings } from '../types'
import {
  getChangedChannelDynamicSettings,
  isDynamicSettingsSubmitDisabled,
  normalizeChannelDynamicSettings,
} from './dynamic-adjustment-settings'

const dynamicSettingsSchema = z.object({
  enabled: z.boolean(),
  dry_run: z.boolean(),
  interval_seconds: z.number().int().min(60),
  platform_probe_enabled: z.boolean(),
  platform_probe_interval_seconds: z.number().int().min(60),
  degraded_weight_multiplier: z.number().gt(0).lt(1),
  protected_unhealthy_multiplier: z.number().gt(0).lt(1),
  priority_downgrade_latency_ms: z.number().int().min(100),
  last_available_protection_enabled: z.boolean(),
})

type DynamicSettingsFormValues = z.infer<typeof dynamicSettingsSchema>

type DynamicAdjustmentSettingsFormProps = {
  settings?: ChannelDynamicSettings | null
  disabled?: boolean
  saving?: boolean
  onSave: (updates: Partial<ChannelDynamicSettings>) => Promise<void> | void
}

function SwitchField({
  form,
  name,
  title,
  description,
  disabled,
}: {
  form: UseFormReturn<DynamicSettingsFormValues>
  name: Path<DynamicSettingsFormValues>
  title: string
  description: string
  disabled?: boolean
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className='flex min-h-28 flex-row items-center justify-between rounded-lg border p-4'>
          <div className='space-y-1 pr-4'>
            <FormLabel className='text-base'>{title}</FormLabel>
            <FormDescription>{description}</FormDescription>
          </div>
          <FormControl>
            <Switch
              checked={Boolean(field.value)}
              disabled={disabled}
              onCheckedChange={field.onChange}
            />
          </FormControl>
        </FormItem>
      )}
    />
  )
}

function NumberField({
  form,
  name,
  title,
  description,
  min,
  max,
  step = 1,
  disabled,
}: {
  form: UseFormReturn<DynamicSettingsFormValues>
  name: Path<DynamicSettingsFormValues>
  title: string
  description: string
  min: number
  max?: number
  step?: number
  disabled?: boolean
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{title}</FormLabel>
          <FormControl>
            <Input
              type='number'
              min={min}
              max={max}
              step={step}
              disabled={disabled}
              value={field.value as number}
              onChange={(event) => field.onChange(event.target.valueAsNumber)}
              name={field.name}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          </FormControl>
          <FormDescription>{description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function DynamicAdjustmentSettingsForm({
  settings,
  disabled,
  saving,
  onSave,
}: DynamicAdjustmentSettingsFormProps) {
  const { t } = useTranslation()
  const defaultValues: DynamicSettingsFormValues =
    normalizeChannelDynamicSettings(settings)
  const form = useForm<DynamicSettingsFormValues>({
    resolver: zodResolver(dynamicSettingsSchema),
    defaultValues,
  })

  useResetForm(form, defaultValues)

  const handleSubmit = async (values: DynamicSettingsFormValues) => {
    const next = normalizeChannelDynamicSettings(values)
    const updates = getChangedChannelDynamicSettings(defaultValues, next)
    await onSave(updates)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-6'>
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
          <SwitchField
            form={form}
            name='enabled'
            title={t('Dynamic adjustment')}
            description={t('Evaluate probe results and status data periodically.')}
            disabled={disabled || saving}
          />
          <SwitchField
            form={form}
            name='dry_run'
            title={t('Dry-run mode')}
            description={t('Record suggested actions without changing routing.')}
            disabled={disabled || saving}
          />
          <SwitchField
            form={form}
            name='platform_probe_enabled'
            title={t('Platform probes')}
            description={t('Allow aiapi114 probe unmapped channel models.')}
            disabled={disabled || saving}
          />
          <SwitchField
            form={form}
            name='last_available_protection_enabled'
            title={t('Last available protection')}
            description={t('Keep the last usable channel available for a model.')}
            disabled={disabled || saving}
          />
        </div>

        <div className='grid gap-6 rounded-lg border p-4 md:grid-cols-2 xl:grid-cols-3'>
          <NumberField
            form={form}
            name='interval_seconds'
            title={t('Adjustment interval')}
            description={t('Seconds between automatic adjustment scans.')}
            min={60}
            disabled={disabled || saving}
          />
          <NumberField
            form={form}
            name='platform_probe_interval_seconds'
            title={t('Platform probe interval')}
            description={t('Seconds between automatic platform probe scans.')}
            min={60}
            disabled={disabled || saving}
          />
          <NumberField
            form={form}
            name='priority_downgrade_latency_ms'
            title={t('Priority downgrade latency')}
            description={t('Latency threshold in milliseconds for priority downgrade.')}
            min={100}
            disabled={disabled || saving}
          />
          <NumberField
            form={form}
            name='degraded_weight_multiplier'
            title={t('Degraded weight multiplier')}
            description={t('Weight multiplier for degraded channels, from 0 to 1.')}
            min={0.01}
            max={0.99}
            step={0.01}
            disabled={disabled || saving}
          />
          <NumberField
            form={form}
            name='protected_unhealthy_multiplier'
            title={t('Protected unhealthy multiplier')}
            description={t('Weight multiplier when the last usable channel is protected.')}
            min={0.01}
            max={0.99}
            step={0.01}
            disabled={disabled || saving}
          />
        </div>

        <Button
          type='submit'
          disabled={isDynamicSettingsSubmitDisabled({ disabled, saving })}
        >
          {saving ? t('Saving...') : t('Save Changes')}
        </Button>
      </form>
    </Form>
  )
}
