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
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BASIS_OPTIONS,
  DIMENSION_KEYS,
  DIMENSION_VALUES,
  createEmptyRule,
  validateRuleDraft,
  type BasisValue,
  type DimensionKey,
  type VideoPriceRule,
} from './video-pricing-types'

type Props = {
  model: string
  rules: VideoPriceRule[]
  onChange: (rules: VideoPriceRule[]) => void
}

/**
 * Edits one model's per-second price rules.
 *
 * Dimensions are checkboxes rather than blank-means-any: a blank field cannot
 * distinguish "matches any value" from "not filled in yet", and those have
 * opposite consequences. An unchecked dimension is an explicit wildcard.
 */
export function VideoPricingEditor({ model, rules, onChange }: Props) {
  const { t } = useTranslation()

  const updateRule = (index: number, next: VideoPriceRule) => {
    onChange(rules.map((rule, i) => (i === index ? next : rule)))
  }

  const toggleDimension = (index: number, key: DimensionKey) => {
    const rule = rules[index]
    const match = { ...rule.match }
    if (key in match) {
      delete match[key]
    } else {
      match[key] = DIMENSION_VALUES[key][0]
    }
    updateRule(index, { ...rule, match })
  }

  const setDimensionValue = (
    index: number,
    key: DimensionKey,
    value: string
  ) => {
    const rule = rules[index]
    updateRule(index, { ...rule, match: { ...rule.match, [key]: value } })
  }

  return (
    <div className='flex flex-col gap-4'>
      {rules.map((rule, index) => {
        const error = validateRuleDraft(rule)
        return (
          <div
            key={index}
            className='flex flex-col gap-3 rounded-lg border p-4'
          >
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>
                {t('Match dimensions')}
              </span>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                onClick={() => onChange(rules.filter((_, i) => i !== index))}
                aria-label={t('Delete rule')}
              >
                <Trash2 className='text-destructive h-4 w-4' />
              </Button>
            </div>

            <div className='flex flex-col gap-2'>
              {DIMENSION_KEYS.map((key) => {
                const checkboxId = `video-dimension-${index}-${key}`
                const checked = key in rule.match
                return (
                  <div key={key} className='flex items-center gap-2 text-sm'>
                    <Checkbox
                      id={checkboxId}
                      checked={checked}
                      onCheckedChange={() => toggleDimension(index, key)}
                    />
                    <Label htmlFor={checkboxId} className='w-24 cursor-pointer'>
                      {t(key)}
                    </Label>
                    {checked ? (
                      <Select
                        items={DIMENSION_VALUES[key].map((value) => ({
                          value,
                          label: value,
                        }))}
                        value={rule.match[key]}
                        onValueChange={(value) =>
                          value !== null &&
                          setDimensionValue(index, key, String(value))
                        }
                      >
                        <SelectTrigger className='w-32' size='sm'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {DIMENSION_VALUES[key].map((value) => (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                )
              })}
            </div>

            <div className='flex items-center gap-2 text-sm'>
              <Label
                htmlFor={`video-price-${index}`}
                className='w-32 shrink-0 font-normal'
              >
                {t('Price per second ($)')}
              </Label>
              <Input
                id={`video-price-${index}`}
                type='number'
                step='0.000001'
                min='0'
                value={rule.price_per_second}
                onChange={(event) =>
                  updateRule(index, {
                    ...rule,
                    price_per_second: Number(event.target.value),
                  })
                }
                className='w-40'
              />
            </div>

            <div className='flex flex-col gap-2 text-sm'>
              <span className='font-medium'>{t('Billing basis')}</span>
              <RadioGroup
                value={rule.basis}
                onValueChange={(value) =>
                  value !== null &&
                  updateRule(index, { ...rule, basis: value as BasisValue })
                }
              >
                {BASIS_OPTIONS.map((option) => {
                  const radioId = `video-basis-${index}-${option.value}`
                  return (
                    <div key={option.value} className='flex items-center gap-2'>
                      <RadioGroupItem id={radioId} value={option.value} />
                      <Label htmlFor={radioId} className='cursor-pointer'>
                        {t(option.value)}
                      </Label>
                    </div>
                  )
                })}
              </RadioGroup>
              {rule.basis === 'total_duration' ? (
                <div className='flex items-center gap-2 pl-6'>
                  <Label
                    htmlFor={`video-fallback-${index}`}
                    className='font-normal'
                  >
                    {t('Fallback seconds')}
                  </Label>
                  <Input
                    id={`video-fallback-${index}`}
                    type='number'
                    min='1'
                    value={rule.fallback_seconds ?? ''}
                    onChange={(event) =>
                      updateRule(index, {
                        ...rule,
                        fallback_seconds: Number(event.target.value),
                      })
                    }
                    className='w-24'
                  />
                </div>
              ) : null}
            </div>

            {error ? (
              <span className='text-destructive text-sm'>
                {error === 'price'
                  ? t('Price per second must be greater than zero')
                  : t('Total duration billing requires a fallback in seconds')}
              </span>
            ) : null}
          </div>
        )
      })}

      <Button
        type='button'
        variant='outline'
        size='sm'
        className='self-start'
        onClick={() => onChange([...rules, createEmptyRule(model)])}
      >
        <Plus data-icon='inline-start' />
        {t('Add rule')}
      </Button>
    </div>
  )
}
