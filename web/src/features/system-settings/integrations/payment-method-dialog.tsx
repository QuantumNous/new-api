import { useEffect, useMemo } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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

const paymentMethodDialogSchema = z.object({
  name: z.string().min(1, 'Payment method name is required'),
  type: z.string().min(1, 'Payment method type is required'),
  color: z.string().min(1, 'Color is required'),
  min_topup: z.string().optional(),
})

type PaymentMethodDialogFormValues = z.infer<typeof paymentMethodDialogSchema>

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

// Map CSS variable colors to their actual values for preview
const CSS_VAR_COLOR_MAP: Record<string, string> = {
  'rgba(var(--semi-blue-5), 1)': '#1677FF',
  'rgba(var(--semi-green-5), 1)': '#52C41A',
}

const getColorPreview = (color: string) => {
  // Map CSS variables to actual colors
  if (CSS_VAR_COLOR_MAP[color]) {
    return CSS_VAR_COLOR_MAP[color]
  }
  // For other CSS variables, return null
  if (color.includes('var(--')) {
    return null
  }
  return color
}

const COLOR_PRESETS = [
  { value: 'rgba(var(--semi-blue-5), 1)', label: 'Blue (Alipay)' },
  { value: 'rgba(var(--semi-green-5), 1)', label: 'Green (WeChat)' },
  { value: '#635BFF', label: 'Purple (Stripe)' },
  { value: '#1677FF', label: 'Sky Blue' },
  { value: '#07C160', label: 'Lime Green' },
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
  const isEditMode = !!editData

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
            {isEditMode ? 'Edit payment method' : 'Add payment method'}
          </DialogTitle>
          <DialogDescription>
            Configure a payment method for user recharge options.
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
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder='e.g., Alipay, WeChat' {...field} />
                  </FormControl>
                  <FormDescription>
                    Display name for this payment method.
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
                  <FormLabel>Type</FormLabel>
                  <FormControl>
                    <Combobox
                      options={PAYMENT_TYPES}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder='Select or enter payment type'
                      searchPlaceholder='Search payment types...'
                      allowCustomValue
                    />
                  </FormControl>
                  <FormDescription>
                    Select from presets or type custom identifier.
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
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className='flex items-center gap-2'>
                      <Combobox
                        options={COLOR_PRESETS}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder='Select or enter color value'
                        searchPlaceholder='Search colors...'
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
                    Select preset or enter custom CSS color value.
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
                  <FormLabel>Minimum top-up (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      step='0.01'
                      placeholder='e.g., 50'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional minimum recharge amount for this method.
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
                Cancel
              </Button>
              <Button type='submit'>{isEditMode ? 'Update' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
