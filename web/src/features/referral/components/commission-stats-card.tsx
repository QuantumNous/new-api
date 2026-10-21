/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { centsToYuan } from '../lib/format-commission'
import type { CommissionStats } from '../types'
import { RedeemDialog } from './redeem-dialog'

export function CommissionStatsCard({ stats }: { stats: CommissionStats }) {
  const { t } = useTranslation()
  const [openRedeem, setOpenRedeem] = useState(false)
  const canRedeem = stats.commission_balance_cents > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Commission Account')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
          <StatTile
            label={t('Redeemable')}
            value={`¥${centsToYuan(stats.commission_balance_cents)}`}
          />
          <StatTile
            label={t('Pending')}
            value={`¥${centsToYuan(stats.commission_pending_cents)}`}
          />
          <StatTile
            label={t('Lifetime')}
            value={`¥${centsToYuan(stats.commission_lifetime_cents)}`}
          />
          <StatTile
            label={t('Total Redeemed')}
            value={`¥${centsToYuan(stats.commission_redeemed_cents)}`}
          />
        </div>
        <div className='mt-4'>
          <Button disabled={!canRedeem} onClick={() => setOpenRedeem(true)}>
            {t('Redeem to Wallet')}
          </Button>
        </div>
      </CardContent>
      <RedeemDialog
        open={openRedeem}
        maxCents={stats.commission_balance_cents}
        onOpenChange={setOpenRedeem}
      />
    </Card>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-md border p-3'>
      <div className='text-muted-foreground text-xs'>{label}</div>
      <div className='mt-1 text-xl font-semibold'>{value}</div>
    </div>
  )
}
