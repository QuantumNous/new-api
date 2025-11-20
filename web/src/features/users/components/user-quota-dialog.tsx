import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
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
  const { t } = useTranslation()
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

  const { config: currencyConfig, meta: currencyMeta } = getCurrencyDisplay()
  const currencyLabel = getCurrencyLabel()
  const tokensOnly =
    !currencyConfig.displayInCurrency || currencyMeta.kind === 'tokens'
  const placeholder = tokensOnly
    ? 'Enter amount in tokens (supports negative)'
    : `Enter amount in ${currencyLabel} (supports negative)`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Add Quota')}</DialogTitle>
          <DialogDescription>
            {t('Enter a positive or negative amount to adjust the quota')}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='text-muted-foreground text-sm'>
            {t('Current:')}{' '}
            {formatQuota(parseQuotaFromDollars(currentQuotaDollars))}
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
            step={tokensOnly ? 1 : 0.01}
            placeholder={placeholder}
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
            {t('Cancel')}
          </Button>
          <Button onClick={handleConfirm}>{t('Add')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
