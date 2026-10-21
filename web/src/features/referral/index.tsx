/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { CommissionStatsCard } from './components/commission-stats-card'
import { DownlinesTable } from './components/downlines-table'
import { InviteCodeCard } from './components/invite-code-card'
import { InviteLinkCard } from './components/invite-link-card'
import { RecordsTable } from './components/records-table'
import { RedemptionsTable } from './components/redemptions-table'
import { useCommissionStats } from './hooks/use-commission-stats'

export function ReferralPage() {
  const { t } = useTranslation()
  const { data: stats, isLoading, error } = useCommissionStats()

  if (isLoading || !stats) {
    return (
      <div className='text-muted-foreground p-6'>
        {isLoading ? t('Loading…') : (error as Error | null)?.message}
      </div>
    )
  }

  return (
    <div className='space-y-6 p-6'>
      <h1 className='text-2xl font-bold'>{t('My Referral')}</h1>
      <div className='grid gap-4 md:grid-cols-2'>
        <InviteCodeCard affCode={stats.aff_code} />
        <InviteLinkCard affCode={stats.aff_code} />
      </div>
      <CommissionStatsCard stats={stats} />
      <Tabs defaultValue='records'>
        <TabsList>
          <TabsTrigger value='records'>{t('Commission Records')}</TabsTrigger>
          <TabsTrigger value='redemptions'>{t('Redemptions')}</TabsTrigger>
          <TabsTrigger value='downlines'>{t('My Downlines')}</TabsTrigger>
        </TabsList>
        <TabsContent value='records'>
          <RecordsTable />
        </TabsContent>
        <TabsContent value='redemptions'>
          <RedemptionsTable />
        </TabsContent>
        <TabsContent value='downlines'>
          <DownlinesTable />
        </TabsContent>
      </Tabs>
    </div>
  )
}
