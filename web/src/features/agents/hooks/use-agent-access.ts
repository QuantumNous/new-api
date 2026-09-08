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
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

import { useStatus } from '@/hooks/use-status'
import { useAuthStore } from '@/stores/auth-store'

import { getAgentAccessOverview } from '../api'
import { agentAccessQueryKey } from '../lib/workspace'
import type { AgentOverview, ApiResult } from '../types'

export { agentAccessQueryKey } from '../lib/workspace'

function isAgentAccessDenied(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 403
}

const agentBusinessDenials = new Set([
  'agent workspace is disabled',
  'agent account not found',
  'agent account is disabled',
])

type AgentAccessProbe = () => Promise<ApiResult<AgentOverview>>

export async function resolveAgentAccess(
  probe: AgentAccessProbe = getAgentAccessOverview
): Promise<AgentOverview | null> {
  try {
    const response = await probe()
    if (response.success) return response.data
    if (agentBusinessDenials.has(response.message.trim().toLowerCase())) {
      return null
    }
    throw new Error('Agent access probe failed')
  } catch (error) {
    if (isAgentAccessDenied(error)) return null
    throw error
  }
}

type AgentStatusAccessInput = {
  hasStatusData: boolean
  isPlaceholderData: boolean
  isFetching: boolean
  isError: boolean
  agentEnabled: boolean
}

export function getAgentStatusAccessState(input: AgentStatusAccessInput): {
  isAuthoritative: boolean
  globallyEnabled: boolean
} {
  const isAuthoritative = input.hasStatusData && !input.isPlaceholderData
  return {
    isAuthoritative,
    globallyEnabled: isAuthoritative && input.agentEnabled,
  }
}

export function useAgentAccess() {
  const userID = useAuthStore((state) => state.auth.user?.id)
  const statusQuery = useStatus()
  const { globallyEnabled } = getAgentStatusAccessState({
    hasStatusData: statusQuery.status !== null,
    isPlaceholderData: false,
    isFetching: statusQuery.loading,
    isError: Boolean(statusQuery.error),
    agentEnabled: statusQuery.status?.agent_enabled === true,
  })
  const shouldCheck = userID !== undefined && globallyEnabled

  const query = useQuery({
    queryKey: agentAccessQueryKey(userID ?? 0),
    queryFn: () => resolveAgentAccess(),
    enabled: shouldCheck,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: (failureCount, error) =>
      !isAgentAccessDenied(error) && failureCount < 1,
  })

  return {
    ...query,
    globallyEnabled,
    hasAccess: shouldCheck && query.data !== null && query.data !== undefined,
    isChecking: statusQuery.status === null && statusQuery.loading || (shouldCheck && query.isPending),
  }
}
