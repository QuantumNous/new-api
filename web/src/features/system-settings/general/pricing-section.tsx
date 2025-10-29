import * as z from 'zod'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RotateCcw } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import { SettingsAccordion } from '../components/settings-accordion'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'

const pricingSchema = z
  .object({
    QuotaPerUnit: z.coerce.number().min(0),
    USDExchangeRate: z.coerce.number().min(0.0001),
    DisplayInCurrencyEnabled: z.boolean(),
    DisplayTokenStatEnabled: z.boolean(),
    general_setting: z.object({
      quota_display_type: z.enum(['USD', 'CNY', 'TOKENS', 'CUSTOM']),
      custom_currency_symbol: z.string().max(8).optional(),
      custom_currency_exchange_rate: z.coerce.number().min(0.0001).optional(),
    }),
  })
  .superRefine((data, ctx) => {
    const displayType = data.general_setting.quota_display_type

    if (displayType === 'CUSTOM') {
      if (!data.general_setting.custom_currency_symbol?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['general_setting', 'custom_currency_symbol'],
          message: 'Custom currency symbol is required',
        })
      }

      if (
        data.general_setting.custom_currency_exchange_rate == null ||
        data.general_setting.custom_currency_exchange_rate <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['general_setting', 'custom_currency_exchange_rate'],
          message: 'Exchange rate must be greater than 0',
        })
      }
    }
  })

type PricingFormValues = z.infer<typeof pricingSchema>

type PricingSectionProps = {
  defaultValues: PricingFormValues
}

export function PricingSection({ defaultValues }: PricingSectionProps) {
  const updateOption = useUpdateOption()

  const { form, handleSubmit, handleReset, isDirty, isSubmitting } =
    useSettingsForm<PricingFormValues>({
      resolver: zodResolver(pricingSchema) as Resolver<
        PricingFormValues,
        any,
        PricingFormValues
      >,
      defaultValues,
      onSubmit: async (_data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          if (value === undefined || value === null) continue
          if (typeof value === 'object') continue

          let serialized: string | boolean = value as any

          if (typeof value === 'boolean') {
            serialized = String(value)
          } else if (typeof value === 'number') {
            serialized = Number.isFinite(value) ? String(value) : '0'
          }

          await updateOption.mutateAsync({
            key,
            value: serialized,
          })
        }
      },
    })

  const displayType = form.watch('general_setting.quota_display_type') ?? 'USD'

  return (
    <>
      <FormNavigationGuard when={isDirty} />

      <SettingsAccordion
        value='pricing'
        title='Pricing & Display'
        description='Configure pricing model and display options'
      >
        <Form {...form}>
          <form onSubmit={handleSubmit} className='space-y-6'>
            <FormDirtyIndicator isDirty={isDirty} />
            <FormField
              control={form.control}
              name='QuotaPerUnit'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quota Per Unit</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      step='0.01'
                      value={field.value as number}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    Number of tokens per unit quota
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='general_setting.quota_display_type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Mode</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select display mode' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='USD'>USD</SelectItem>
                      <SelectItem value='CNY'>CNY</SelectItem>
                      <SelectItem value='CUSTOM'>Custom Currency</SelectItem>
                      <SelectItem value='TOKENS'>Tokens Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose how quota values are shown to users
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {displayType !== 'TOKENS' && (
              <FormField
                control={form.control}
                name='USDExchangeRate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {displayType === 'CNY'
                        ? 'CNY per USD'
                        : displayType === 'USD'
                          ? 'USD Exchange Rate'
                          : 'USD Exchange Rate'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        step='0.01'
                        value={field.value as number}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        name={field.name}
                        onBlur={field.onBlur}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>
                      Real exchange rate between USD and your payment gateway
                      currency
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {displayType === 'CUSTOM' && (
              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='general_setting.custom_currency_symbol'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Currency Symbol</FormLabel>
                      <FormControl>
                        <Input
                          type='text'
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          maxLength={8}
                          placeholder='e.g. ¥ or HK$'
                        />
                      </FormControl>
                      <FormDescription>
                        Prefix used when displaying prices
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='general_setting.custom_currency_exchange_rate'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Units per USD</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          step='0.01'
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ''
                                ? undefined
                                : e.target.valueAsNumber
                            )
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          placeholder='e.g. 8 means 1 USD = 8 units'
                        />
                      </FormControl>
                      <FormDescription>
                        Conversion rate from USD to your custom currency
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name='DisplayInCurrencyEnabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Display in Currency
                    </FormLabel>
                    <FormDescription>
                      {displayType === 'TOKENS'
                        ? 'Tokens-only mode will show raw quota values regardless of this toggle.'
                        : 'Show prices in currency instead of quota.'}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='DisplayTokenStatEnabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Display Token Statistics
                    </FormLabel>
                    <FormDescription>
                      Show token usage statistics in the UI
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className='flex gap-2'>
              <Button
                type='submit'
                disabled={updateOption.isPending || isSubmitting}
              >
                {updateOption.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={handleReset}
                disabled={!isDirty || updateOption.isPending || isSubmitting}
              >
                <RotateCcw className='mr-2 h-4 w-4' />
                Reset
              </Button>
            </div>
          </form>
        </Form>
      </SettingsAccordion>
    </>
  )
}
