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
import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  MAX_SUB_QUOTA_LIMITS,
  getSubQuotaAnchorOptions,
  getSubQuotaPeriodUnitOptions,
} from '../constants'
import type { PlanFormValues } from '../lib'

export function SubQuotaLimitsField() {
  const { t } = useTranslation()
  const { control, watch, setValue } = useFormContext<PlanFormValues>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'sub_quota_limits',
  })

  const periodUnitOpts = getSubQuotaPeriodUnitOptions(t)
  const anchorOpts = getSubQuotaAnchorOptions(t)
  const canAdd = fields.length < MAX_SUB_QUOTA_LIMITS

  const handleAdd = () => {
    append({
      name: '',
      period_unit: 'hour',
      period_value: 5,
      limit_usd: 12,
      natural: false,
      anchor: 'subscription_start',
    })
  }

  const getPeriodValueConstraints = (unit: string) =>
    unit === 'hour'
      ? { min: 0.01, step: '0.01' }
      : { min: 1, step: '1' }

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <p className='text-muted-foreground text-xs'>
          {t('Up to 2 sub-quota window limits. Any limit reached blocks subscription usage.')}
        </p>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={handleAdd}
          disabled={!canAdd}
        >
          <Plus className='mr-1 h-3.5 w-3.5' />
          {t('Add sub limit')}
        </Button>
      </div>

      {fields.length === 0 && (
        <div className='text-muted-foreground rounded-md border border-dashed py-4 text-center text-xs'>
          {t('No sub limit configured')}
        </div>
      )}

      {fields.map((field, index) => {
        const periodUnit = watch(`sub_quota_limits.${index}.period_unit`)
        const isHour = periodUnit === 'hour'
        const periodValueConstraints = getPeriodValueConstraints(periodUnit)

        return (
          <div
            key={field.id}
            className='space-y-3 rounded-md border p-3'
          >
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>
                {t('Sub Limit')} #{index + 1}
              </span>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='h-7 w-7'
                onClick={() => remove(index)}
                aria-label={t('Remove sub limit')}
              >
                <Trash2 className='h-3.5 w-3.5' />
              </Button>
            </div>

            <Input
              placeholder={t('Name e.g. 5 hour quota')}
              {...control.register(`sub_quota_limits.${index}.name`)}
            />

            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              <div className='space-y-1'>
                <label className='text-xs font-medium'>
                  {t('Duration Value')}
                </label>
                <Input
                  type='number'
                  min={periodValueConstraints.min}
                  step={periodValueConstraints.step}
                  {...control.register(`sub_quota_limits.${index}.period_value`, {
                    valueAsNumber: true,
                  })}
                />
              </div>

              <div className='space-y-1'>
                <label className='text-xs font-medium'>
                  {t('Duration Unit')}
                </label>
                <Select
                  value={periodUnit}
                  onValueChange={(v) =>
                    v !== null &&
                    setValue(
                      `sub_quota_limits.${index}.period_unit`,
                      v as PlanFormValues['sub_quota_limits'][number]['period_unit']
                    )
                  }
                  items={periodUnitOpts.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {periodUnitOpts.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-1'>
                <label className='text-xs font-medium'>
                  {t('Limit Amount (USD)')}
                </label>
                <Input
                  type='number'
                  min={0}
                  step='0.01'
                  {...control.register(`sub_quota_limits.${index}.limit_usd`, {
                    valueAsNumber: true,
                  })}
                />
              </div>

              <div className='space-y-1'>
                <label className='text-xs font-medium'>
                  {t('Anchor')}
                </label>
                <Select
                  value={watch(`sub_quota_limits.${index}.anchor`) || (isHour ? 'subscription_start' : 'calendar')}
                  onValueChange={(v) =>
                    v !== null &&
                    setValue(`sub_quota_limits.${index}.anchor`, v)
                  }
                  items={anchorOpts.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {anchorOpts.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </div>
        )
      })}
    </div>
  )
}
