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
*/
import { useQuery } from '@tanstack/react-query'
import { Link, getRouteApi } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { getDistributor } from '../api'
import { DISTRIBUTOR_STATUS_CONFIG, DISTRIBUTOR_TIER_CONFIG } from '../constants'
import { DistributorBillingTab } from './distributor-billing-tab'
import { DistributorPricesTab } from './distributor-prices-tab'
import { DistributorSubUsersTab } from './distributor-sub-users-tab'

const route = getRouteApi('/_authenticated/distributors/$distributorId/')

export function DistributorDetail() {
  const { t } = useTranslation()
  const { distributorId } = route.useParams()
  const id = Number(distributorId)

  const { data: distributor } = useQuery({
    queryKey: ['distributor', id],
    queryFn: async () => {
      const result = await getDistributor(id)
      return result.success ? (result.data ?? null) : null
    },
  })

  const tierConfig = distributor
    ? DISTRIBUTOR_TIER_CONFIG[distributor.tier]
    : undefined
  const statusConfig = distributor
    ? DISTRIBUTOR_STATUS_CONFIG[distributor.status]
    : undefined

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        <span className='flex items-center gap-2'>
          {distributor?.name ?? t('Distributor')}
          {tierConfig && (
            <StatusBadge
              label={t(tierConfig.labelKey)}
              variant={tierConfig.variant}
              copyable={false}
            />
          )}
          {statusConfig && (
            <StatusBadge
              label={t(statusConfig.labelKey)}
              variant={statusConfig.variant}
              copyable={false}
            />
          )}
        </span>
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button variant='outline' size='sm' render={<Link to='/distributors' />}>
          <ArrowLeft className='h-4 w-4' />
          {t('Back')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <Tabs defaultValue='prices'>
          <TabsList>
            <TabsTrigger value='prices'>{t('Price Overrides')}</TabsTrigger>
            <TabsTrigger value='sub-users'>{t('Sub-Users')}</TabsTrigger>
            <TabsTrigger value='billing'>{t('Billing')}</TabsTrigger>
          </TabsList>
          <TabsContent value='prices' className='pt-4'>
            <DistributorPricesTab distributorId={id} />
          </TabsContent>
          <TabsContent value='sub-users' className='pt-4'>
            <DistributorSubUsersTab distributorId={id} />
          </TabsContent>
          <TabsContent value='billing' className='pt-4'>
            <DistributorBillingTab distributorId={id} />
          </TabsContent>
        </Tabs>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
