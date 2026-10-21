/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

import { useQuotaPreview } from '../hooks/use-quota-preview'
import { useRedeemCommission } from '../hooks/use-redeem-commission'
import { centsToYuan, yuanToCents } from '../lib/format-commission'

type Props = {
  open: boolean
  maxCents: number
  onOpenChange: (v: boolean) => void
}

export function RedeemDialog({ open, maxCents, onOpenChange }: Props) {
  const { t } = useTranslation()
  const [yuan, setYuan] = useState(centsToYuan(maxCents))
  const cents = Math.min(yuanToCents(Number(yuan) || 0), maxCents)
  const preview = useQuotaPreview(cents)
  const redeem = useRedeemCommission()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Redeem to Wallet')}</DialogTitle>
        </DialogHeader>
        <div className='space-y-3'>
          <div className='text-muted-foreground text-sm'>
            {t('Redeemable')}: ¥{centsToYuan(maxCents)}
          </div>
          <Input
            type='number'
            step='0.01'
            min='0.01'
            max={maxCents / 100}
            value={yuan}
            onChange={(e) => setYuan(e.target.value)}
          />
          {preview.data && (
            <div className='bg-muted rounded-md p-3 text-sm'>
              <div>
                {t('Current rate')}: 1 USD ≈{' '}
                {preview.data.usd_exchange_rate.toFixed(4)} CNY
              </div>
              <div className='mt-1'>
                ¥{centsToYuan(cents)} →{' '}
                <span className='font-semibold'>
                  {preview.data.quota_credited.toLocaleString()}
                </span>{' '}
                {t('quota')}
              </div>
            </div>
          )}
          {preview.isError && (
            <div className='text-destructive text-sm'>
              {(preview.error as Error).message}
            </div>
          )}
          <div className='text-muted-foreground text-xs'>
            {t('Exchange uses the current system rate at redeem time.')}
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button
            disabled={!cents || cents > maxCents || redeem.isPending}
            onClick={async () => {
              await redeem.mutateAsync(cents)
              onOpenChange(false)
            }}
          >
            {t('Confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
