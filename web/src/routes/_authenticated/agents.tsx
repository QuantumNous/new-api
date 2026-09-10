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
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { AgentWorkspace } from '@/features/agents'
import { useAgentAccess } from '@/features/agents/hooks/use-agent-access'
import {
  agentWorkspaceSearchSchema,
  getAgentRouteGateState,
  retryAgentRouteGate,
} from '@/features/agents/lib/workspace'
import { useStatus } from '@/hooks/use-status'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/agents')({
  beforeLoad: ({ location }) => {
    const { auth } = useAuthStore.getState()
    if (!auth.user) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }
  },
  validateSearch: agentWorkspaceSearchSchema,
  component: AgentRouteGate,
})

function AgentRouteGate() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = Route.useSearch()
  const routeNavigate = Route.useNavigate()
  const access = useAgentAccess()
  const status = useStatus()
  const userID = useAuthStore((state) => state.auth.user?.id ?? 0)
  const gateState = getAgentRouteGateState({
    statusEnabled: status.status?.agent_enabled === true,
    statusAuthoritative: status.hasAuthoritativeData,
    statusPending: status.loading || status.isFetching,
    statusError: status.isError,
    accessPending: access.isChecking,
    accessDenied: access.data === null,
    accessError: access.isError,
    accessReady: access.data !== null && access.data !== undefined,
  })

  useEffect(() => {
    if (gateState === 'denied') {
      void navigate({ to: '/403', replace: true })
    }
  }, [gateState, navigate])

  if (gateState === 'loading' || gateState === 'denied') {
    return (
      <div className='flex min-h-64 items-center justify-center'>
        <Spinner className='size-6' aria-label={t('Loading agent workspace')} />
      </div>
    )
  }

  if (gateState === 'error' || !access.data) {
    return (
      <div className='flex min-h-64 items-center justify-center p-4'>
        <Empty className='max-w-md border'>
          <EmptyHeader>
            <EmptyTitle>
              {t('Agent workspace is temporarily unavailable')}
            </EmptyTitle>
            <EmptyDescription>
              {t('Try loading your agent access again.')}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              type='button'
              variant='outline'
              onClick={() =>
                retryAgentRouteGate(status.refetch, access.refetch)
              }
            >
              {t('Retry')}
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  return (
    <AgentWorkspace
      key={userID}
      initialOverview={access.data}
      search={search}
      onSearchChange={(updates) =>
        routeNavigate({
          replace: true,
          search: (previous) => ({ ...previous, ...updates }),
        })
      }
    />
  )
}
