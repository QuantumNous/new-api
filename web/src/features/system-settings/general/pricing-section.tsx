import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
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
import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import { SettingsAccordion } from '../components/settings-accordion'
import { useUpdateOption } from '../hooks/use-update-option'

const pricingSchema = z.object({
  QuotaPerUnit: z.coerce.number().min(0),
  USDExchangeRate: z.coerce.number().min(0),
  DisplayInCurrencyEnabled: z.boolean(),
  DisplayTokenStatEnabled: z.boolean(),
})

type PricingFormValues = z.infer<typeof pricingSchema>

type PricingSectionProps = {
  defaultValues: PricingFormValues
}

export function PricingSection({ defaultValues }: PricingSectionProps) {
  const updateOption = useUpdateOption()

  const form = useForm({
    resolver: zodResolver(pricingSchema),
    defaultValues,
  })

  const onSubmit = async (data: PricingFormValues) => {
    const updates = Object.entries(data).filter(
      ([key, value]) => value !== defaultValues[key as keyof PricingFormValues]
    )

    if (updates.length === 0) {
      toast.info('No changes to save')
      return
    }

    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value })
    }

    form.reset(data)
  }

  const handleReset = () => {
    form.reset(defaultValues, {
      keepDirty: false,
      keepDirtyValues: false,
      keepErrors: false,
    })
    toast.success('Form reset to saved values')
  }

  return (
    <>
      <FormNavigationGuard when={form.formState.isDirty} />

      <SettingsAccordion
        value='pricing'
        title='Pricing & Display'
        description='Configure pricing model and display options'
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            <FormDirtyIndicator isDirty={form.formState.isDirty} />
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
              name='USDExchangeRate'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>USD Exchange Rate</FormLabel>
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
                    Exchange rate from local currency to USD
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      Show prices in currency instead of quota
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
              <Button type='submit' disabled={updateOption.isPending}>
                {updateOption.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={handleReset}
                disabled={!form.formState.isDirty || updateOption.isPending}
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
