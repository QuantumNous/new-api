import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCreemPrice } from '../../lib/format'
import type { CreemProduct } from '../../types'

interface CreemConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  product: CreemProduct | null
  processing: boolean
}

export function CreemConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  product,
  processing,
}: CreemConfirmDialogProps) {
  const { t } = useTranslation()

  if (!product) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>{t('Confirm Creem Purchase')}</DialogTitle>
          <DialogDescription>
            {t('Review your purchase details before proceeding.')}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>{t('Product')}</span>
            <span className='font-medium'>{product.name}</span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>{t('Price')}</span>
            <span className='font-medium text-indigo-600'>
              {formatCreemPrice(product.price, product.currency)}
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>{t('Quota')}</span>
            <span className='font-medium'>{formatNumber(product.quota)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={processing}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={processing}>
            {processing && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('Confirm Payment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
