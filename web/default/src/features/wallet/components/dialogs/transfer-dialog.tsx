/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  formatQuota,
  parseQuotaFromDollars,
  quotaUnitsToDollars,
} from '@/lib/format'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
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

interface TransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (amount: number) => Promise<boolean>
  availableQuota: number
  transferring: boolean
}

function formatInputAmount(value: number): string {
  if (!Number.isFinite(value)) return ''

  const normalized = Number(value.toFixed(6))
  return String(normalized)
}

export function TransferDialog({
  open,
  onOpenChange,
  onConfirm,
  availableQuota,
  transferring,
}: TransferDialogProps) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState('')
  const { config, meta: currencyMeta } = getCurrencyDisplay()
  const currencyLabel = getCurrencyLabel()
  const tokensOnly = currencyMeta.kind === 'tokens'
  const minTransferQuota = Math.round(config.quotaPerUnit)
  const minAmount = quotaUnitsToDollars(minTransferQuota)
  const availableAmount = quotaUnitsToDollars(availableQuota)
  const amountValue = Number(amount)
  const quotaToTransfer =
    Number.isFinite(amountValue) && amountValue > 0
      ? parseQuotaFromDollars(amountValue)
      : 0
  const canTransfer =
    quotaToTransfer >= minTransferQuota && quotaToTransfer <= availableQuota
  const placeholder = tokensOnly
    ? t('Enter amount in tokens')
    : t('Enter amount in {{currency}}', { currency: currencyLabel })

  useEffect(() => {
    if (open) {
      const initialAmount =
        availableQuota >= minTransferQuota ? minAmount : availableAmount
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAmount(availableQuota > 0 ? formatInputAmount(initialAmount) : '')
    }
  }, [open, availableQuota, availableAmount, minAmount, minTransferQuota])

  const handleConfirm = async () => {
    if (!canTransfer || transferring) return

    const success = await onConfirm(quotaToTransfer)
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
            <div className='flex gap-2'>
              <Input
                id='transfer-amount'
                type='number'
                inputMode='decimal'
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={minAmount}
                max={availableAmount}
                step={tokensOnly ? 1 : 0.01}
                placeholder={placeholder}
                aria-invalid={amount !== '' && !canTransfer}
                className='font-mono text-lg'
              />
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => setAmount(formatInputAmount(availableAmount))}
                disabled={transferring || availableQuota < minTransferQuota}
              >
                {t('All')}
              </Button>
            </div>
            <p className='text-muted-foreground text-xs'>
              {t('Minimum:')} {formatQuota(minTransferQuota)}
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
          <Button
            onClick={handleConfirm}
            disabled={transferring || !canTransfer}
          >
            {transferring && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('Transfer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
