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
import { RefreshIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AgentCodesTable } from './components/agent-codes-table'
import { AgentCreditLogsTable } from './components/agent-credit-logs-table'
import { AgentCustomerLogs } from './components/agent-customer-logs'
import { AgentCustomersTable } from './components/agent-customers-table'
import { AgentOffers } from './components/agent-offers'
import { AgentOrdersTable } from './components/agent-orders-table'
import { AgentOverview } from './components/agent-overview'
import {
  agentMutationInvalidationKeys,
  agentQueryKeys,
  type AgentWorkspaceSearch,
} from './lib/workspace'
import type { AgentOverview as AgentOverviewData } from './types'

type AgentWorkspaceProps = {
  initialOverview: AgentOverviewData
  search: AgentWorkspaceSearch
  onSearchChange: (updates: Partial<AgentWorkspaceSearch>) => void
}

export function AgentWorkspace(props: AgentWorkspaceProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const activeTab = props.search.tab ?? 'overview'

  const refresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        ...agentMutationInvalidationKeys.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        ),
        queryClient.invalidateQueries({ queryKey: agentQueryKeys.offers }),
        queryClient.invalidateQueries({ queryKey: agentQueryKeys.promotion }),
        queryClient.invalidateQueries({ queryKey: agentQueryKeys.customers }),
        queryClient.invalidateQueries({
          queryKey: agentQueryKeys.customerLogs,
        }),
        queryClient.invalidateQueries({
          queryKey: agentQueryKeys.customerLogStats,
        }),
      ])
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Agent workspace')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          type='button'
          variant='outline'
          disabled={refreshing}
          onClick={refresh}
        >
          <HugeiconsIcon
            icon={RefreshIcon}
            strokeWidth={2}
            data-icon='inline-start'
            className={refreshing ? 'animate-spin' : undefined}
          />
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            props.onSearchChange({
              tab: value as AgentWorkspaceSearch['tab'],
              p: 1,
            })
          }
        >
          <div className='overflow-x-auto pb-1'>
            <TabsList>
              <TabsTrigger value='overview'>{t('Overview')}</TabsTrigger>
              <TabsTrigger value='orders'>{t('Orders')}</TabsTrigger>
              <TabsTrigger value='codes'>{t('Code inventory')}</TabsTrigger>
              <TabsTrigger value='ledger'>{t('Point ledger')}</TabsTrigger>
              <TabsTrigger value='customers'>{t('Customers')}</TabsTrigger>
              <TabsTrigger value='customer-logs'>
                {t('Customer logs')}
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value='overview' className='flex flex-col gap-6 pt-2'>
            <AgentOverview initialOverview={props.initialOverview} />
            <AgentOffers />
          </TabsContent>
          <TabsContent value='orders' className='pt-2'>
            <AgentOrdersTable
              search={props.search}
              onSearchChange={props.onSearchChange}
            />
          </TabsContent>
          <TabsContent value='codes' className='pt-2'>
            <AgentCodesTable
              search={props.search}
              onSearchChange={props.onSearchChange}
            />
          </TabsContent>
          <TabsContent value='ledger' className='pt-2'>
            <AgentCreditLogsTable
              search={props.search}
              onSearchChange={props.onSearchChange}
            />
          </TabsContent>
          <TabsContent value='customers' className='pt-2'>
            <AgentCustomersTable
              search={props.search}
              onSearchChange={props.onSearchChange}
            />
          </TabsContent>
          <TabsContent value='customer-logs' className='pt-2'>
            <AgentCustomerLogs
              search={props.search}
              onSearchChange={props.onSearchChange}
            />
          </TabsContent>
        </Tabs>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
