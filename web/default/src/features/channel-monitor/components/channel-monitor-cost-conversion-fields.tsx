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

import { useWatch, type UseFormReturn } from 'react-hook-form'

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import {
  getChannelMonitorConversionFactor,
  getChannelMonitorCostRatio,
} from '../lib/cost-conversion'
import { formatMonitorRatio } from '../lib/format'
import {
  MAX_COST_CONVERSION_AMOUNT,
  type UpstreamConfigFormValues,
} from '../lib/schema'
import type { ChannelMonitorCostConversion } from '../types'

type ChannelMonitorCostConversionFieldsProps = {
  form: UseFormReturn<UpstreamConfigFormValues>
  upstreamRatio: number | null
}

export function ChannelMonitorCostConversionFields(
  props: ChannelMonitorCostConversionFieldsProps
) {
  const mode = useWatch({
    control: props.form.control,
    name: 'costConversionMode',
  })
  const rechargePaidCny = Number(
    useWatch({ control: props.form.control, name: 'rechargePaidCny' })
  )
  const rechargeCreditedUsd = Number(
    useWatch({ control: props.form.control, name: 'rechargeCreditedUsd' })
  )
  const subscriptionPeriod = useWatch({
    control: props.form.control,
    name: 'subscriptionPeriod',
  })
  const subscriptionPriceCny = Number(
    useWatch({ control: props.form.control, name: 'subscriptionPriceCny' })
  )
  const subscriptionDailyUsd = Number(
    useWatch({ control: props.form.control, name: 'subscriptionDailyUsd' })
  )

  let config: ChannelMonitorCostConversion = { mode: 'none' }
  if (mode === 'recharge') {
    config = {
      mode,
      paid_cny: rechargePaidCny,
      credited_usd: rechargeCreditedUsd,
    }
  } else if (mode === 'subscription') {
    config = {
      mode,
      subscription_period: subscriptionPeriod,
      subscription_price_cny: subscriptionPriceCny,
      subscription_daily_usd: subscriptionDailyUsd,
    }
  }
  const conversionFactor = getChannelMonitorConversionFactor(config)
  const costRatio = getChannelMonitorCostRatio(props.upstreamRatio, config)

  return (
    <div className='flex min-w-0 flex-col gap-4'>
      <FormField
        control={props.form.control}
        name='costConversionMode'
        render={({ field }) => (
          <FormItem>
            <FormLabel>倍率换算</FormLabel>
            <FormControl>
              <ToggleGroup
                value={[field.value]}
                onValueChange={(values) => {
                  const nextValue = values.find(
                    (value) => value !== field.value
                  )
                  if (
                    nextValue !== 'none' &&
                    nextValue !== 'recharge' &&
                    nextValue !== 'subscription'
                  ) {
                    return
                  }
                  field.onChange(nextValue)
                }}
                variant='outline'
                spacing={2}
                className='grid w-full grid-cols-3'
              >
                <ToggleGroupItem value='none' className='w-full'>
                  不换算
                </ToggleGroupItem>
                <ToggleGroupItem value='recharge' className='w-full'>
                  充值
                </ToggleGroupItem>
                <ToggleGroupItem value='subscription' className='w-full'>
                  订阅
                </ToggleGroupItem>
              </ToggleGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {mode === 'recharge' ? (
        <div className='grid min-w-0 gap-4 sm:grid-cols-2'>
          <FormField
            control={props.form.control}
            name='rechargePaidCny'
            render={({ field }) => (
              <FormItem>
                <FormLabel>实付金额</FormLabel>
                <FormControl>
                  <InputGroup>
                    <InputGroupAddon>￥</InputGroupAddon>
                    <InputGroupInput
                      type='number'
                      min={0}
                      max={MAX_COST_CONVERSION_AMOUNT}
                      step='any'
                      inputMode='decimal'
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      name={field.name}
                      ref={field.ref}
                      aria-invalid={Boolean(
                        props.form.formState.errors.rechargePaidCny
                      )}
                    />
                  </InputGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={props.form.control}
            name='rechargeCreditedUsd'
            render={({ field }) => (
              <FormItem>
                <FormLabel>到账额度</FormLabel>
                <FormControl>
                  <InputGroup>
                    <InputGroupAddon>$</InputGroupAddon>
                    <InputGroupInput
                      type='number'
                      min={0}
                      max={MAX_COST_CONVERSION_AMOUNT}
                      step='any'
                      inputMode='decimal'
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      name={field.name}
                      ref={field.ref}
                      aria-invalid={Boolean(
                        props.form.formState.errors.rechargeCreditedUsd
                      )}
                    />
                  </InputGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      ) : null}

      {mode === 'subscription' ? (
        <>
          <FormField
            control={props.form.control}
            name='subscriptionPeriod'
            render={({ field }) => (
              <FormItem>
                <FormLabel>订阅周期</FormLabel>
                <FormControl>
                  <ToggleGroup
                    value={[field.value]}
                    onValueChange={(values) => {
                      const nextValue = values.find(
                        (value) => value !== field.value
                      )
                      if (
                        nextValue !== 'day' &&
                        nextValue !== 'week' &&
                        nextValue !== 'month'
                      ) {
                        return
                      }
                      field.onChange(nextValue)
                    }}
                    variant='outline'
                    spacing={2}
                    className='grid w-full grid-cols-3'
                  >
                    <ToggleGroupItem value='day' className='w-full'>
                      天
                    </ToggleGroupItem>
                    <ToggleGroupItem value='week' className='w-full'>
                      周
                    </ToggleGroupItem>
                    <ToggleGroupItem value='month' className='w-full'>
                      月（30 天）
                    </ToggleGroupItem>
                  </ToggleGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className='grid min-w-0 gap-4 sm:grid-cols-2'>
            <FormField
              control={props.form.control}
              name='subscriptionPriceCny'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>订阅价格</FormLabel>
                  <FormControl>
                    <InputGroup>
                      <InputGroupAddon>￥</InputGroupAddon>
                      <InputGroupInput
                        type='number'
                        min={0}
                        max={MAX_COST_CONVERSION_AMOUNT}
                        step='any'
                        inputMode='decimal'
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={field.onChange}
                        name={field.name}
                        ref={field.ref}
                        aria-invalid={Boolean(
                          props.form.formState.errors.subscriptionPriceCny
                        )}
                      />
                    </InputGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={props.form.control}
              name='subscriptionDailyUsd'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>每日额度</FormLabel>
                  <FormControl>
                    <InputGroup>
                      <InputGroupAddon>$</InputGroupAddon>
                      <InputGroupInput
                        type='number'
                        min={0}
                        max={MAX_COST_CONVERSION_AMOUNT}
                        step='any'
                        inputMode='decimal'
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={field.onChange}
                        name={field.name}
                        ref={field.ref}
                        aria-invalid={Boolean(
                          props.form.formState.errors.subscriptionDailyUsd
                        )}
                      />
                    </InputGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </>
      ) : null}

      <div className='bg-muted/40 grid grid-cols-3 gap-3 rounded-md px-3 py-2.5 text-sm'>
        <div className='flex min-w-0 flex-col gap-1'>
          <span className='text-muted-foreground'>换算系数</span>
          <span className='truncate font-mono font-semibold'>
            {formatMonitorRatio(conversionFactor)}
          </span>
        </div>
        <div className='flex min-w-0 flex-col gap-1'>
          <span className='text-muted-foreground'>上游倍率</span>
          <span className='truncate font-mono font-semibold'>
            {formatMonitorRatio(props.upstreamRatio)}
          </span>
        </div>
        <div className='flex min-w-0 flex-col gap-1'>
          <span className='text-muted-foreground'>成本倍率</span>
          <span className='truncate font-mono font-semibold'>
            {formatMonitorRatio(costRatio)}
          </span>
        </div>
      </div>
    </div>
  )
}
