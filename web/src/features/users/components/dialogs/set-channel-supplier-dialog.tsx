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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isValidDiscountText, parseDiscountText } from '@/lib/discount'

interface SetChannelSupplierDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  username: string
  // The discount the user had before, kept while they were not a supplier;
  // empty when none was ever set.
  currentDiscount?: number | null
  onConfirm: (discount: number) => Promise<void>
}

export function SetChannelSupplierDialog(props: SetChannelSupplierDialogProps) {
  const { t } = useTranslation()
  const [discount, setDiscount] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const currentDiscount = props.currentDiscount
  const currentText = currentDiscount == null ? '' : String(currentDiscount)

  // Prefill from the stored value each time the dialog opens, so a supplier
  // that was unset and set again shows the discount it kept.
  useEffect(() => {
    if (props.open) {
      setDiscount(currentText)
      setError('')
    }
  }, [props.open, currentText])

  const discountMessage = t(
    'Payable discount must be greater than 0 and at most 1, with at most 4 decimal places'
  )

  const handleConfirm = async () => {
    const text = discount.trim()
    if (!isValidDiscountText(text)) {
      setError(discountMessage)
      return
    }
    setLoading(true)
    try {
      await props.onConfirm(parseDiscountText(text))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Set as channel supplier')}
      description={t(
        'Confirm the payable discount for {{username}} before making the account a channel supplier.',
        { username: props.username }
      )}
      contentHeight='auto'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={loading}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? t('Processing...') : t('Confirm')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
        <Label htmlFor='payable-discount'>{t('Payable Discount')}</Label>
        <Input
          id='payable-discount'
          value={discount}
          inputMode='decimal'
          autoComplete='off'
          placeholder='0.85'
          aria-invalid={error !== ''}
          onChange={(e) => {
            setDiscount(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm()
          }}
        />
        <p
          className={
            error ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'
          }
        >
          {error ||
            t('Between 0 and 1. For example, 0.85 means 85% of the list price')}
        </p>
      </div>
    </Dialog>
  )
}
