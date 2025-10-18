import { useEffect, useMemo } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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

const amountDiscountDialogSchema = z.object({
  amount: z
    .number()
    .positive('Amount must be greater than 0')
    .int('Amount must be a whole number'),
  discountRate: z
    .number()
    .positive('Discount rate must be greater than 0')
    .max(1, 'Discount rate must be ≤ 1'),
})

type AmountDiscountDialogFormValues = z.infer<typeof amountDiscountDialogSchema>

export type AmountDiscountData = {
  amount: number
  discountRate: number
}

type AmountDiscountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: AmountDiscountData) => void
  editData?: AmountDiscountData | null
}

export function AmountDiscountDialog({
  open,
  onOpenChange,
  onSave,
  editData,
}: AmountDiscountDialogProps) {
  const isEditMode = !!editData

  const form = useForm<AmountDiscountDialogFormValues>({
    resolver: zodResolver(amountDiscountDialogSchema),
    defaultValues: {
      amount: 0,
      discountRate: 1,
    },
  })

  const discountRate = form.watch('discountRate')

  const discountPercentage = useMemo(() => {
    if (!discountRate || discountRate >= 1) return 0
    return Math.round((1 - discountRate) * 100)
  }, [discountRate])

  useEffect(() => {
    if (editData) {
      form.reset(editData)
    } else {
      form.reset({
        amount: 0,
        discountRate: 1,
      })
    }
  }, [editData, form, open])

  const handleSubmit = (values: AmountDiscountDialogFormValues) => {
    onSave({
      amount: values.amount,
      discountRate: values.discountRate,
    })
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit discount tier' : 'Add discount tier'}
          </DialogTitle>
          <DialogDescription>
            Set a discount rate for a specific recharge amount threshold.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='amount'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recharge Amount (USD)</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      step='1'
                      min='1'
                      placeholder='e.g., 100'
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                      disabled={isEditMode}
                    />
                  </FormControl>
                  <FormDescription>
                    {isEditMode
                      ? 'Amount cannot be changed when editing.'
                      : 'Minimum recharge amount to qualify for this discount.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='discountRate'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Discount Rate</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      step='0.01'
                      min='0.01'
                      max='1'
                      placeholder='e.g., 0.95'
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Final price multiplier (0.95 = 5% discount
                    {discountPercentage > 0 && (
                      <span className='ml-1 font-medium text-green-600 dark:text-green-400'>
                        = {discountPercentage}% off
                      </span>
                    )}
                    )
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
