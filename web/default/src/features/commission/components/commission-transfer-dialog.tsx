import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CommissionTransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (amount: number) => Promise<boolean>
  availableQuota: number
  transferring: boolean
}

const MIN_TRANSFER = 500000

export function CommissionTransferDialog({ open, onOpenChange, onConfirm, availableQuota, transferring }: CommissionTransferDialogProps) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState(MIN_TRANSFER)

  useEffect(() => { if (open) setAmount(MIN_TRANSFER) }, [open])

  const handleConfirm = async () => {
    const success = await onConfirm(amount)
    if (success) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl font-semibold'>{t('转入余额')}</DialogTitle>
          <DialogDescription>{t('将返佣额度转入账户余额,即可用于消费')}</DialogDescription>
        </DialogHeader>
        <div className='space-y-4 py-3 sm:space-y-6 sm:py-4'>
          <div className='space-y-2'>
            <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>{t('可转额度')}</Label>
            <div className='text-2xl font-semibold'>{formatQuota(availableQuota)}</div>
          </div>
          <div className='space-y-3'>
            <Label htmlFor='commission-transfer-amount' className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>{t('转入金额')}</Label>
            <Input id='commission-transfer-amount' type='number' value={amount} onChange={(e) => setAmount(Number(e.target.value))} min={MIN_TRANSFER} max={availableQuota} step={MIN_TRANSFER} className='font-mono text-lg' />
            <p className='text-muted-foreground text-xs'>{t('最小金额:')} {formatQuota(MIN_TRANSFER)}</p>
          </div>
        </div>
        <DialogFooter className='grid grid-cols-2 gap-2 sm:flex'>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={transferring}>{t('取消')}</Button>
          <Button onClick={handleConfirm} disabled={transferring}>{transferring && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}{t('确认转入')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
