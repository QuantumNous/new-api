import { Loader2, Zap } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_DISCOUNT_RATE } from '../../constants'
import { formatCurrency, getPaymentIcon } from '../../lib'
import type { PaymentMethod } from '../../types'

interface PaymentConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  topupAmount: number
  paymentAmount: number
  paymentMethod: PaymentMethod | undefined
  calculating: boolean
  processing: boolean
  discountRate?: number
}

export function PaymentConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  topupAmount,
  paymentAmount,
  paymentMethod,
  calculating,
  processing,
  discountRate = DEFAULT_DISCOUNT_RATE,
}: PaymentConfirmDialogProps) {
  const hasDiscount = discountRate > 0 && discountRate < 1 && paymentAmount > 0
  const originalAmount = hasDiscount ? paymentAmount / discountRate : 0
  const discountAmount = hasDiscount ? originalAmount - paymentAmount : 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className='flex items-center gap-2'>
            <Zap className='h-5 w-5' />
            Confirm Payment
          </AlertDialogTitle>
          <AlertDialogDescription>
            Please review your payment details before proceeding.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Card className='border-muted bg-muted/50 p-4'>
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Topup Amount:</span>
              <span className='text-sm font-semibold'>
                {formatNumber(topupAmount)}
              </span>
            </div>

            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Payment Amount:</span>
              {calculating ? (
                <Skeleton className='h-4 w-20' />
              ) : (
                <div className='flex items-baseline gap-2'>
                  <span className='text-destructive text-sm font-bold'>
                    ${formatCurrency(paymentAmount)}
                  </span>
                  {hasDiscount && (
                    <span className='text-xs text-emerald-600'>
                      {Math.round(discountRate * 100)}%
                    </span>
                  )}
                </div>
              )}
            </div>

            {hasDiscount && !calculating && (
              <>
                <div className='flex items-center justify-between'>
                  <span className='text-muted-foreground text-xs'>
                    Original Price:
                  </span>
                  <span className='text-muted-foreground text-xs line-through'>
                    ${formatCurrency(originalAmount)}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-muted-foreground text-xs'>
                    Discount:
                  </span>
                  <span className='text-xs text-emerald-600'>
                    -${formatCurrency(discountAmount)}
                  </span>
                </div>
              </>
            )}

            <div className='border-muted flex items-center justify-between border-t pt-3'>
              <span className='text-sm font-medium'>Payment Method:</span>
              <div className='flex items-center gap-2'>
                {getPaymentIcon(paymentMethod?.type)}
                <span className='text-sm'>{paymentMethod?.name}</span>
              </div>
            </div>
          </div>
        </Card>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={processing}>
            {processing && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Confirm Payment
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
