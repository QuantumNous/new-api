import { useEffect } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CreemProduct } from '@/features/wallet/types'

const creemProductDialogSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  productId: z.string().min(1, 'Product ID is required'),
  price: z.number().min(0.01, 'Price must be greater than 0'),
  quota: z.number().min(1, 'Quota must be at least 1'),
  currency: z.enum(['USD', 'EUR']),
})

type CreemProductDialogFormValues = z.infer<typeof creemProductDialogSchema>

// Re-export for backwards compatibility
export type CreemProductData = CreemProduct

type CreemProductDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: CreemProduct) => void
  editData?: CreemProduct | null
}

export function CreemProductDialog({
  open,
  onOpenChange,
  onSave,
  editData,
}: CreemProductDialogProps) {
  const { t } = useTranslation()
  const isEditMode = !!editData

  const form = useForm<CreemProductDialogFormValues>({
    resolver: zodResolver(creemProductDialogSchema),
    defaultValues: {
      name: '',
      productId: '',
      price: 0,
      quota: 0,
      currency: 'USD',
    },
  })

  useEffect(() => {
    if (editData) {
      form.reset(editData)
    } else {
      form.reset({
        name: '',
        productId: '',
        price: 0,
        quota: 0,
        currency: 'USD',
      })
    }
  }, [editData, form, open])

  const handleSubmit = (values: CreemProductDialogFormValues) => {
    const data: CreemProduct = {
      name: values.name,
      productId: values.productId,
      price: values.price,
      quota: values.quota,
      currency: values.currency,
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
            {isEditMode ? t('Edit product') : t('Add product')}
          </DialogTitle>
          <DialogDescription>
            {t('Configure a Creem product for user recharge options.')}
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
                  <FormLabel>{t('Product Name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('e.g., Basic Package')} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Display name shown to users.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='productId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Product ID')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('e.g., prod_xxx')}
                      disabled={isEditMode}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Creem product ID from your Creem dashboard.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='currency'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Currency')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select currency')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='USD'>USD ($)</SelectItem>
                        <SelectItem value='EUR'>EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='price'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Price')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        step='0.01'
                        min={0.01}
                        placeholder='10.00'
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='quota'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Quota')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      placeholder={t('e.g., 500000')}
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Amount of quota to credit to user account.')}
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
