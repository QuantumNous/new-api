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
import { ArrowLeftRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActionMenu } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  isValidPricingCurrency,
  type PricingCurrency,
} from '@/features/model-pricing/currency'

import type { PriceAdjustment } from './upstream-price-adjustment'

export function PriceAdjustmentSelect(props: {
  value: PriceAdjustment | null
  currency: PricingCurrency | null
  label: string
  disabled?: boolean
  compact?: boolean
  onChange: (value: PriceAdjustment) => void
}) {
  const { t } = useTranslation()
  const available = isValidPricingCurrency(props.currency)
  const rate = isValidPricingCurrency(props.currency)
    ? String(props.currency.exchangeRate)
    : '—'
  const items = [
    { value: 'keep', label: t('Keep source price') },
    {
      value: 'divide',
      label: t('Divide by exchange rate (÷ {{rate}})', { rate }),
    },
    {
      value: 'multiply',
      label: t('Multiply by exchange rate (× {{rate}})', { rate }),
    },
  ]
  if (props.compact) {
    const adjusted = props.value === 'multiply' || props.value === 'divide'
    const current = items.find((item) => item.value === props.value)
    return (
      <DataTableRowActionMenu
        ariaLabel={props.label}
        contentClassName='w-auto min-w-56'
        trigger={
          <Button
            variant={adjusted ? 'secondary' : 'ghost'}
            size={adjusted ? 'sm' : 'icon-sm'}
            className='shrink-0 tabular-nums'
            disabled={props.disabled}
            title={current?.label}
          >
            <ArrowLeftRight aria-hidden='true' className='size-4' />
            {adjusted && (
              <span>
                {props.value === 'divide' ? '÷' : '×'} {rate}
              </span>
            )}
          </Button>
        }
      >
        <DropdownMenuRadioGroup
          value={props.value ?? 'keep'}
          onValueChange={(value) => {
            if (
              value === 'keep' ||
              (available && (value === 'divide' || value === 'multiply'))
            ) {
              props.onChange(value)
            }
          }}
        >
          {items.map((item) => (
            <DropdownMenuRadioItem
              closeOnClick
              key={item.value}
              value={item.value}
              disabled={item.value !== 'keep' && !available}
            >
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DataTableRowActionMenu>
    )
  }
  return (
    <Select
      items={items}
      value={props.value}
      disabled={props.disabled}
      onValueChange={(value) => {
        if (
          value === 'keep' ||
          (available && (value === 'divide' || value === 'multiply'))
        ) {
          props.onChange(value)
        }
      }}
    >
      <SelectTrigger
        className='w-full max-w-64 min-w-0'
        aria-label={props.label}
      >
        <SelectValue placeholder={props.label} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {items.map((item) => (
          <SelectItem
            key={item.value}
            value={item.value}
            disabled={item.value !== 'keep' && !available}
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
