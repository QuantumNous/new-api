import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
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
  const [amount, setAmount] = useState(QUOTA_PER_DOLLAR)

  useEffect(() => {
    if (open) {
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
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl font-semibold'>
            Transfer Rewards
          </DialogTitle>
          <DialogDescription>
            Move affiliate rewards to your main balance
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6 py-4'>
          <div className='space-y-2'>
            <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              Available Rewards
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
              Transfer Amount
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
              Minimum: {formatQuota(QUOTA_PER_DOLLAR)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={transferring}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={transferring}>
            {transferring && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
