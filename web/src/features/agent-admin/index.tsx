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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUpdateOption } from '@/features/system-settings/hooks/use-update-option'
import { useStatus } from '@/hooks/use-status'
import { useAuthStore } from '@/stores/auth-store'

import { AgentCodesTable } from './components/agent-codes-table'
import { AgentCreditLogsTable } from './components/agent-credit-logs-table'
import { AgentOffersTable } from './components/agent-offers-table'
import { AgentOrdersTable } from './components/agent-orders-table'
import { AgentsTable } from './components/agents-table'
import {
  agentAdminQueryKeys,
  getAgentAdminAccess,
  getAgentSystemSwitchState,
  type AgentAdminSearch,
} from './lib/admin'

type AgentAdminProps = {
  search: AgentAdminSearch
  onSearchChange: (updates: Partial<AgentAdminSearch>) => void
}

export function AgentAdmin(props: AgentAdminProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const user = useAuthStore((state) => state.auth.user)
  const status = useStatus()
  const updateOption = useUpdateOption()
  const access = getAgentAdminAccess(user?.role)
  const scope = user?.id ?? 0
  const systemSwitchState = getAgentSystemSwitchState({
    canMutate: access.canMutate,
    hasAuthoritativeStatus: Boolean(status.status),
    statusError: Boolean(status.error),
  })
  const changeTab = (tab: AgentAdminSearch['tab']) =>
    props.onSearchChange({
      tab,
      p: 1,
      keyword: undefined,
      agent_user_id: undefined,
      plan_id: undefined,
      order_id: undefined,
      status: undefined,
    })
  const refresh = async () => {
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries({
        queryKey: agentAdminQueryKeys.root,
      })
    } finally {
      setRefreshing(false)
    }
  }
  const setAgentSystemEnabled = async (enabled: boolean) => {
    try {
      const result = await updateOption.mutateAsync({
        key: 'agent_setting.enabled',
        value: enabled,
      })
      if (result.success) {
        await Promise.resolve()
      }
    } catch {
      // useUpdateOption owns the user-facing error toast.
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Agent management')}</SectionPageLayout.Title>
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
        <div className='flex flex-col gap-4'>
          {systemSwitchState !== 'hidden' && (
            <Card>
              <CardContent className='flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5'>
                <div className='flex flex-col gap-1'>
                  <h2 className='font-medium'>{t('Agent system')}</h2>
                  <p className='text-muted-foreground text-sm'>
                    {t(
                      'Enable the agent workspace, package offers, and redemption-code sales.'
                    )}
                  </p>
                </div>
                {systemSwitchState === 'loading' && (
                  <Skeleton className='h-6 w-11' />
                )}
                {systemSwitchState === 'error' && (
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => Promise.resolve()}
                  >
                    {t('Retry')}
                  </Button>
                )}
                {systemSwitchState === 'ready' && (
                  <div className='flex items-center gap-3'>
                    <span className='text-muted-foreground text-sm'>
                      {status.status?.agent_enabled
                        ? t('Enabled')
                        : t('Disabled')}
                    </span>
                    <Switch
                      aria-label={t('Agent system')}
                      checked={status.status?.agent_enabled === true}
                      disabled={updateOption.isPending || status.loading}
                      onCheckedChange={(enabled) => {
                        void setAgentSystemEnabled(enabled)
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {!access.canMutate && (
            <Alert>
              <AlertTitle>{t('Read-only agent administration')}</AlertTitle>
              <AlertDescription>
                {t(
                  'Administrators can inspect agents, offers, ledgers, orders, codes, and reconciliation. Only the super administrator can change financial or lifecycle data.'
                )}
              </AlertDescription>
            </Alert>
          )}
          <Tabs
            value={props.search.tab}
            onValueChange={(value) =>
              changeTab(value as AgentAdminSearch['tab'])
            }
          >
            <div className='overflow-x-auto pb-1'>
              <TabsList>
                <TabsTrigger value='agents'>{t('Agents')}</TabsTrigger>
                <TabsTrigger value='offers'>{t('Offers')}</TabsTrigger>
                <TabsTrigger value='orders'>{t('Orders')}</TabsTrigger>
                <TabsTrigger value='codes'>{t('Code inventory')}</TabsTrigger>
                <TabsTrigger value='ledger'>{t('Point ledger')}</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value='agents' className='pt-3'>
              <AgentsTable
                scope={scope}
                canMutate={access.canMutate}
                search={props.search}
                onSearchChange={props.onSearchChange}
              />
            </TabsContent>
            <TabsContent value='offers' className='pt-3'>
              <AgentOffersTable scope={scope} canMutate={access.canMutate} />
            </TabsContent>
            <TabsContent value='orders' className='pt-3'>
              <AgentOrdersTable
                scope={scope}
                search={props.search}
                onSearchChange={props.onSearchChange}
              />
            </TabsContent>
            <TabsContent value='codes' className='pt-3'>
              <AgentCodesTable
                scope={scope}
                canMutate={access.canMutate}
                search={props.search}
                onSearchChange={props.onSearchChange}
              />
            </TabsContent>
            <TabsContent value='ledger' className='pt-3'>
              <AgentCreditLogsTable
                scope={scope}
                search={props.search}
                onSearchChange={props.onSearchChange}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
