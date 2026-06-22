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
import { useEffect, useMemo } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

const createPaymentMethodDialogSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t('Payment method name is required')),
    type: z.string().min(1, t('Payment method type is required')),
    color: z.string().min(1, t('Color is required')),
    min_topup: z.string().optional(),
  })

type PaymentMethodDialogFormValues = z.infer<
  ReturnType<typeof createPaymentMethodDialogSchema>
>

export type PaymentMethodData = {
  name: string
  type: string
  color: string
  min_topup?: string
}

type PaymentMethodDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: PaymentMethodData) => void
  editData?: PaymentMethodData | null
}

const PAYMENT_TYPES = [
  { value: 'alipay', label: 'Alipay' },
  { value: 'wxpay', label: 'WeChat Pay' },
  { value: 'stripe', label: 'Stripe' },
]

const getColorPreview = (color: string) => {
  if (color.includes('var(--')) {
    return null
  }
  return color
}

const COLOR_PRESETS = [
  { value: '#1677FF', label: 'Blue (Alipay)' },
  { value: '#07C160', label: 'Green (WeChat)' },
  { value: '#635BFF', label: 'Purple (Stripe)' },
  { value: '#1890FF', label: 'Sky Blue' },
  { value: '#52C41A', label: 'Lime Green' },
  { value: 'black', label: 'Black' },
  { value: '#FF4D4F', label: 'Red' },
  { value: '#FFA940', label: 'Orange' },
].map((preset) => {
  const previewColor = getColorPreview(preset.value)
  return {
    ...preset,
    icon: previewColor ? (
      <div
        className='size-4 rounded border'
        style={{ backgroundColor: previewColor }}
      />
    ) : (
      <div className='bg-muted size-4 rounded border' />
    ),
  }
})

export function PaymentMethodDialog({
  open,
  onOpenChange,
  onSave,
  editData,
}: PaymentMethodDialogProps) {
  const { t } = useTranslation()
  const isEditMode = !!editData
  const paymentMethodDialogSchema = createPaymentMethodDialogSchema(t)

  const form = useForm<PaymentMethodDialogFormValues>({
    resolver: zodResolver(paymentMethodDialogSchema),
    defaultValues: {
      name: '',
      type: '',
      color: '',
      min_topup: '',
    },
  })

  const colorValue = form.watch('color')

  const colorPreview = useMemo(() => {
    if (!colorValue) return null
    try {
      // For CSS variables like rgba(var(--semi-blue-5), 1), we can't preview accurately
      // but we can detect common patterns
      if (colorValue.includes('var(--')) {
        return null // Can't preview CSS variables reliably
      }
      return colorValue
    } catch {
      return null
    }
  }, [colorValue])

  useEffect(() => {
    if (editData) {
      form.reset(editData)
    } else {
      form.reset({
        name: '',
        type: '',
        color: '',
        min_topup: '',
      })
    }
  }, [editData, form, open])

  const handleSubmit = (values: PaymentMethodDialogFormValues) => {
    const data: PaymentMethodData = {
      name: values.name,
      type: values.type,
      color: values.color,
    }
    if (values.min_topup && values.min_topup.trim() !== '') {
      data.min_topup = values.min_topup
    }
    onSave(data)
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? t('Edit payment method') : t('Add payment method')}
          </DialogTitle>
          <DialogDescription>
            {t('Configure a payment method for user recharge options.')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('e.g., Alipay, WeChat')} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Display name for this payment method.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Type')}</FormLabel>
                  <FormControl>
                    <Combobox
                      options={PAYMENT_TYPES}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('Select or enter payment type')}
                      searchPlaceholder={t('Search payment types...')}
                      allowCustomValue
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Select from presets or type custom identifier.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='color'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Color')}</FormLabel>
                  <FormControl>
                    <div className='flex items-center gap-2'>
                      <Combobox
                        options={COLOR_PRESETS}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder={t('Select or enter color value')}
                        searchPlaceholder={t('Search colors...')}
                        allowCustomValue
                        className='flex-1'
                      />
                      {colorPreview && (
                        <div
                          className='size-9 shrink-0 rounded border'
                          style={{ backgroundColor: colorPreview }}
                          title={colorPreview}
                        />
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    {t('Select preset or enter custom CSS color value.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='min_topup'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Minimum top-up (optional)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      step='0.01'
                      placeholder={t('e.g., 50')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Optional minimum recharge amount for this method.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
              >
                {t('Cancel')}
              </Button>
              <Button type='submit'>
                {isEditMode ? t('Update') : t('Add')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
