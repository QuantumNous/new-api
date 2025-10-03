import { useState } from 'react'
import { formatQuota, parseQuotaFromDollars } from '@/lib/format'
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

interface UserQuotaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentQuotaDollars: number
  onConfirm: (deltaAmount: number) => void
}

export function UserQuotaDialog({
  open,
  onOpenChange,
  currentQuotaDollars,
  onConfirm,
}: UserQuotaDialogProps) {
  const [quotaDelta, setQuotaDelta] = useState('')

  const deltaValue = parseFloat(quotaDelta) || 0
  const newTotal = currentQuotaDollars + deltaValue

  const handleConfirm = () => {
    if (deltaValue === 0) {
      onOpenChange(false)
      return
    }
    onConfirm(deltaValue)
    setQuotaDelta('')
    onOpenChange(false)
  }

  const handleCancel = () => {
    setQuotaDelta('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Quota</DialogTitle>
          <DialogDescription>
            Enter a positive or negative amount to adjust the quota
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='text-muted-foreground text-sm'>
            Current: {formatQuota(parseQuotaFromDollars(currentQuotaDollars))}
            {quotaDelta && (
              <>
                {' + '}
                {formatQuota(parseQuotaFromDollars(deltaValue))}
                {' = '}
                {formatQuota(parseQuotaFromDollars(newTotal))}
              </>
            )}
          </div>
          <Input
            type='number'
            step='0.01'
            placeholder='Enter amount (supports negative)'
            value={quotaDelta}
            onChange={(e) => setQuotaDelta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleConfirm()
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
