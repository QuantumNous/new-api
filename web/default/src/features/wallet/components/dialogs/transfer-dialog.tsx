import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QUOTA_PER_DOLLAR } from '../../constants'

interface TransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (amount: number) => Promise<boolean>
  availableQuota: number
  transferring: boolean
}

export function TransferDialog({
  open,
  onOpenChange,
  onConfirm,
  availableQuota,
  transferring,
}: TransferDialogProps) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState(QUOTA_PER_DOLLAR)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAmount(QUOTA_PER_DOLLAR)
    }
  }, [open])

  const handleConfirm = async () => {
    const success = await onConfirm(amount)
    if (success) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl font-semibold'>
            {t('Transfer Rewards')}
          </DialogTitle>
          <DialogDescription>
            {t('Move affiliate rewards to your main balance')}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-3 sm:space-y-6 sm:py-4'>
          <div className='space-y-2'>
            <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              {t('Available Rewards')}
            </Label>
            <div className='text-2xl font-semibold'>
              {formatQuota(availableQuota)}
            </div>
          </div>

          <div className='space-y-3'>
            <Label
              htmlFor='transfer-amount'
              className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
            >
              {t('Transfer Amount')}
            </Label>
            <Input
              id='transfer-amount'
              type='number'
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={QUOTA_PER_DOLLAR}
              max={availableQuota}
              step={QUOTA_PER_DOLLAR}
              className='font-mono text-lg'
            />
            <p className='text-muted-foreground text-xs'>
              {t('Minimum:')} {formatQuota(QUOTA_PER_DOLLAR)}
            </p>
          </div>
        </div>

        <DialogFooter className='grid grid-cols-2 gap-2 sm:flex'>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={transferring}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={transferring}>
            {transferring && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('Transfer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
