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
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { useFieldArray, useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

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

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const freePrizeSchema = z.object({
  name: z.string().min(1),
  usd: z.coerce.number().min(0),
  weight: z.coerce.number().int().min(1),
  is_thanks: z.boolean(),
})

const betPrizeSchema = z.object({
  name: z.string().min(1),
  multiplier: z.coerce.number().min(-1).max(2),
  weight: z.coerce.number().int().min(1),
  is_thanks: z.boolean(),
})

const schema = z.object({
  enabled: z.boolean(),
  dailyPoolUsd: z.coerce.number().min(0),
  displayDailyPoolUsd: z.coerce.number().min(0),
  minBetUsd: z.coerce.number().min(0),
  maxBetUsd: z.coerce.number().min(0),
  maxDrawsPerIpPerDay: z.coerce.number().int().min(0),
  requireRedemption: z.boolean(),
  freePrizes: z.array(freePrizeSchema).min(1),
  betPrizes: z.array(betPrizeSchema).min(1),
})

type Values = z.infer<typeof schema>

type FreePrize = z.infer<typeof freePrizeSchema>
type BetPrize = z.infer<typeof betPrizeSchema>

const DEFAULT_FREE: FreePrize[] = [
  { name: '谢谢惠顾', usd: 0, weight: 28, is_thanks: true },
  { name: '安慰奖', usd: 0.01, weight: 18, is_thanks: false },
  { name: '小奖', usd: 0.05, weight: 15, is_thanks: false },
  { name: '普通奖', usd: 0.2, weight: 12, is_thanks: false },
  { name: '中奖', usd: 0.5, weight: 10, is_thanks: false },
  { name: '大奖', usd: 1, weight: 7, is_thanks: false },
  { name: '超级大奖', usd: 2, weight: 5, is_thanks: false },
  { name: '传说奖', usd: 5, weight: 3, is_thanks: false },
  { name: '头奖', usd: 20, weight: 2, is_thanks: false },
]

const DEFAULT_BET: BetPrize[] = [
  { name: '血本无归', multiplier: -1, weight: 12, is_thanks: false },
  { name: '大亏', multiplier: -0.5, weight: 12, is_thanks: false },
  { name: '小亏', multiplier: -0.2, weight: 14, is_thanks: false },
  { name: '谢谢惠顾', multiplier: 0, weight: 18, is_thanks: true },
  { name: '回本碎银', multiplier: 0.2, weight: 14, is_thanks: false },
  { name: '小赚', multiplier: 0.5, weight: 12, is_thanks: false },
  { name: '翻倍', multiplier: 1, weight: 8, is_thanks: false },
  { name: '大赚', multiplier: 1.5, weight: 6, is_thanks: false },
  { name: '暴击', multiplier: 2, weight: 4, is_thanks: false },
]

function parseFreePrizes(raw: string | undefined): FreePrize[] {
  if (!raw || raw === '[]') return DEFAULT_FREE
  try {
    const list = JSON.parse(raw) as Array<Record<string, unknown>>
    if (!Array.isArray(list) || list.length === 0) return DEFAULT_FREE
    return list.map((item) => {
      let usd = 0
      if (typeof item.usd === 'number') {
        usd = item.usd
      } else if (typeof item.quota === 'number') {
        usd = Number(item.quota) / 500000
      }
      return {
        name: String(item.name || ''),
        usd,
        weight: Number(item.weight) || 1,
        is_thanks: Boolean(item.is_thanks),
      }
    })
  } catch {
    return DEFAULT_FREE
  }
}

function parseBetPrizes(raw: string | undefined): BetPrize[] {
  if (!raw || raw === '[]') return DEFAULT_BET
  try {
    const list = JSON.parse(raw) as Array<Record<string, unknown>>
    if (!Array.isArray(list) || list.length === 0) return DEFAULT_BET
    return list.map((item) => ({
      name: String(item.name || ''),
      multiplier: Number(item.multiplier) || 0,
      weight: Number(item.weight) || 1,
      is_thanks: Boolean(item.is_thanks),
    }))
  } catch {
    return DEFAULT_BET
  }
}

export function LotterySettingsSection({
  defaultValues,
}: {
  defaultValues: {
    enabled: boolean
    dailyPoolUsd: number
    displayDailyPoolUsd: number
    minBetUsd: number
    maxBetUsd: number
    maxDrawsPerIpPerDay: number
    requireRedemption: boolean
    freePrizesJson: string
    betPrizesJson: string
  }
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      enabled: defaultValues.enabled,
      dailyPoolUsd: defaultValues.dailyPoolUsd,
      displayDailyPoolUsd: defaultValues.displayDailyPoolUsd,
      minBetUsd: defaultValues.minBetUsd,
      maxBetUsd: defaultValues.maxBetUsd,
      maxDrawsPerIpPerDay: defaultValues.maxDrawsPerIpPerDay,
      requireRedemption: defaultValues.requireRedemption,
      freePrizes: parseFreePrizes(defaultValues.freePrizesJson),
      betPrizes: parseBetPrizes(defaultValues.betPrizesJson),
    },
  })

  useEffect(() => {
    form.reset({
      enabled: defaultValues.enabled,
      dailyPoolUsd: defaultValues.dailyPoolUsd,
      displayDailyPoolUsd: defaultValues.displayDailyPoolUsd,
      minBetUsd: defaultValues.minBetUsd,
      maxBetUsd: defaultValues.maxBetUsd,
      maxDrawsPerIpPerDay: defaultValues.maxDrawsPerIpPerDay,
      requireRedemption: defaultValues.requireRedemption,
      freePrizes: parseFreePrizes(defaultValues.freePrizesJson),
      betPrizes: parseBetPrizes(defaultValues.betPrizesJson),
    })
  }, [defaultValues, form])

  const freeArray = useFieldArray({ control: form.control, name: 'freePrizes' })
  const betArray = useFieldArray({ control: form.control, name: 'betPrizes' })

  const { isDirty, isSubmitting } = form.formState

  async function onSubmit(values: Values) {
    if (values.minBetUsd > values.maxBetUsd) {
      toast.error(t('Min bet cannot exceed max bet'))
      return
    }

    const freePayload = values.freePrizes.map((p) => ({
      name: p.name,
      usd: p.usd,
      weight: p.weight,
      is_thanks: p.is_thanks,
    }))
    const betPayload = values.betPrizes.map((p) => ({
      name: p.name,
      multiplier: p.multiplier,
      weight: p.weight,
      is_thanks: p.is_thanks,
    }))

    const updates: Array<{ key: string; value: string }> = [
      { key: 'lottery_setting.enabled', value: String(values.enabled) },
      {
        key: 'lottery_setting.daily_pool_usd',
        value: String(values.dailyPoolUsd),
      },
      {
        key: 'lottery_setting.display_daily_pool_usd',
        value: String(values.displayDailyPoolUsd),
      },
      { key: 'lottery_setting.min_bet_usd', value: String(values.minBetUsd) },
      { key: 'lottery_setting.max_bet_usd', value: String(values.maxBetUsd) },
      {
        key: 'lottery_setting.max_draws_per_ip_per_day',
        value: String(values.maxDrawsPerIpPerDay),
      },
      {
        key: 'lottery_setting.require_redemption',
        value: String(values.requireRedemption),
      },
      {
        key: 'lottery_setting.free_prizes',
        value: JSON.stringify(freePayload),
      },
      {
        key: 'lottery_setting.bet_prizes',
        value: JSON.stringify(betPayload),
      },
    ]

    try {
      for (const item of updates) {
        await updateOption.mutateAsync(item)
      }
      toast.success(t('Settings saved'))
      form.reset(values)
    } catch {
      toast.error(t('Failed to save settings'))
    }
  }

  return (
    <SettingsSection title={t('Lucky Slot Lottery')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={isSubmitting || updateOption.isPending}
            isSaveDisabled={!isDirty}
          />

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable lucky slot')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Shows Lucky Slot under Extensions. Draws are decided by the backend once per user per day.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending || isSubmitting}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <div className='space-y-6'>
            <FormField
              control={form.control}
              name='displayDailyPoolUsd'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('Display daily prize pool (USD)')}
                  </FormLabel>
                  <FormControl>
                    <Input type='number' step='0.01' {...field} />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Shown to users on the lottery page. Does not limit real payouts. Doubled on Thursdays. Set 0 to fall back to the actual pool.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='dailyPoolUsd'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Actual daily pool limit (USD)')}</FormLabel>
                  <FormControl>
                    <Input type='number' step='0.01' {...field} />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Real daily payout cap used by the backend. Hidden from users. Doubled on Thursdays.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='requireRedemption'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>
                      {t('Require redemption code to play')}
                    </FormLabel>
                    <FormDescription>
                      {t(
                        'On normal days, users must have redeemed at least one code. Crazy Thursday skips this requirement.'
                      )}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={updateOption.isPending || isSubmitting}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />

            <div className='grid gap-4 sm:grid-cols-3'>
              <FormField
                control={form.control}
                name='minBetUsd'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Min bet (USD)')}</FormLabel>
                    <FormControl>
                      <Input type='number' step='0.01' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='maxBetUsd'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Max bet (USD)')}</FormLabel>
                    <FormControl>
                      <Input type='number' step='0.01' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='maxDrawsPerIpPerDay'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Max draws per IP / day')}</FormLabel>
                    <FormControl>
                      <Input type='number' {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('0 means no IP limit.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='space-y-3'>
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <h3 className='text-sm font-medium'>
                    {t('Free mode prizes')}
                  </h3>
                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'Each row is a prize. Higher USD should usually have lower weight.'
                    )}
                  </p>
                </div>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() =>
                    freeArray.append({
                      name: t('New prize'),
                      usd: 0.1,
                      weight: 10,
                      is_thanks: false,
                    })
                  }
                >
                  <Plus className='mr-1 h-4 w-4' />
                  {t('Add prize')}
                </Button>
              </div>

              <div className='space-y-3'>
                {freeArray.fields.map((field, index) => (
                  <div
                    key={field.id}
                    className='grid gap-3 rounded-xl border p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto_auto] sm:items-end'
                  >
                    <FormField
                      control={form.control}
                      name={`freePrizes.${index}.name`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>{t('Name')}</FormLabel>
                          <FormControl>
                            <Input {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`freePrizes.${index}.usd`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>{t('USD')}</FormLabel>
                          <FormControl>
                            <Input type='number' step='0.01' {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`freePrizes.${index}.weight`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>{t('Weight')}</FormLabel>
                          <FormControl>
                            <Input type='number' min={1} {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`freePrizes.${index}.is_thanks`}
                      render={({ field: f }) => (
                        <FormItem className='flex flex-col gap-2'>
                          <FormLabel>{t('Thanks')}</FormLabel>
                          <FormControl>
                            <Switch
                              checked={f.value}
                              onCheckedChange={f.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='text-destructive'
                      disabled={freeArray.fields.length <= 1}
                      onClick={() => freeArray.remove(index)}
                      aria-label={t('Remove prize')}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className='space-y-3'>
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <h3 className='text-sm font-medium'>
                    {t('Bet mode prizes')}
                  </h3>
                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'Multiplier is relative to bet amount. Range: -1 to 2.'
                    )}
                  </p>
                </div>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() =>
                    betArray.append({
                      name: t('New prize'),
                      multiplier: 0.5,
                      weight: 10,
                      is_thanks: false,
                    })
                  }
                >
                  <Plus className='mr-1 h-4 w-4' />
                  {t('Add prize')}
                </Button>
              </div>

              <div className='space-y-3'>
                {betArray.fields.map((field, index) => (
                  <div
                    key={field.id}
                    className='grid gap-3 rounded-xl border p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto_auto] sm:items-end'
                  >
                    <FormField
                      control={form.control}
                      name={`betPrizes.${index}.name`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>{t('Name')}</FormLabel>
                          <FormControl>
                            <Input {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`betPrizes.${index}.multiplier`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>{t('Multiplier')}</FormLabel>
                          <FormControl>
                            <Input type='number' step='0.1' {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`betPrizes.${index}.weight`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>{t('Weight')}</FormLabel>
                          <FormControl>
                            <Input type='number' min={1} {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`betPrizes.${index}.is_thanks`}
                      render={({ field: f }) => (
                        <FormItem className='flex flex-col gap-2'>
                          <FormLabel>{t('Thanks')}</FormLabel>
                          <FormControl>
                            <Switch
                              checked={f.value}
                              onCheckedChange={f.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='text-destructive'
                      disabled={betArray.fields.length <= 1}
                      onClick={() => betArray.remove(index)}
                      aria-label={t('Remove prize')}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
