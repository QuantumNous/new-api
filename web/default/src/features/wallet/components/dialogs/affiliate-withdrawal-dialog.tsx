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
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatQuota } from '@/lib/format'

import { QUOTA_PER_DOLLAR } from '../../constants'
import type { AffiliateWithdrawalRequest } from '../../types'

interface AffiliateWithdrawalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (request: AffiliateWithdrawalRequest) => Promise<boolean>
  availableQuota: number
  withdrawing: boolean
}

export function AffiliateWithdrawalDialog(props: AffiliateWithdrawalDialogProps) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState(QUOTA_PER_DOLLAR)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [account, setAccount] = useState('')
  const [remark, setRemark] = useState('')

  useEffect(() => {
    if (props.open) {
      setAmount(Math.min(QUOTA_PER_DOLLAR, props.availableQuota))
      setPaymentMethod('')
      setAccount('')
      setRemark('')
    }
  }, [props.availableQuota, props.open])

  const invalid =
    amount <= 0 ||
    amount > props.availableQuota ||
    paymentMethod.trim() === '' ||
    account.trim() === ''

  const handleConfirm = async () => {
    const success = await props.onConfirm({
      amount,
      payment_method: paymentMethod.trim(),
      account: account.trim(),
      remark: remark.trim(),
    })
    if (success) {
      props.onOpenChange(false)
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Withdraw Referral Rewards')}
      description={t(
        'Submit a withdrawal request for available referral rewards'
      )}
      contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'
      titleClassName='text-xl font-semibold'
      footerClassName='grid grid-cols-2 gap-2 sm:flex'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={props.withdrawing}
          >
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={props.withdrawing || invalid}
          >
            {props.withdrawing && (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            )}
            {t('Submit')}
          </Button>
        </>
      }
    >
      <div className='space-y-4 py-3 sm:space-y-5 sm:py-4'>
        <div className='space-y-2'>
          <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
            {t('Available Rewards')}
          </Label>
          <div className='text-2xl font-semibold'>
            {formatQuota(props.availableQuota)}
          </div>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='affiliate-withdrawal-amount'>
            {t('Withdrawal Amount')}
          </Label>
          <Input
            id='affiliate-withdrawal-amount'
            type='number'
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
            min={1}
            max={props.availableQuota}
            step={QUOTA_PER_DOLLAR}
            className='font-mono'
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='affiliate-withdrawal-method'>
            {t('Payment Method')}
          </Label>
          <Input
            id='affiliate-withdrawal-method'
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
            placeholder={t('Bank transfer, PayPal, Alipay...')}
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='affiliate-withdrawal-account'>
            {t('Receiving Account')}
          </Label>
          <Input
            id='affiliate-withdrawal-account'
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            placeholder={t('Account, email, or wallet address')}
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='affiliate-withdrawal-remark'>{t('Remark')}</Label>
          <Textarea
            id='affiliate-withdrawal-remark'
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
            rows={3}
          />
        </div>
      </div>
    </Dialog>
  )
}
