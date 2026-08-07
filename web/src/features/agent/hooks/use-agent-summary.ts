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

import { useAuthStore } from '@/stores/auth-store'

import {
  fetchAgentSummary,
  getAgentSummaryRetryDelay,
  shouldRetryAgentSummary,
} from '../api'
import type { AgentSummaryResult, AgentSummaryState } from '../types'

const AGENT_SUMMARY_STALE_TIME_MS = 2 * 60 * 1_000
const AGENT_SUMMARY_RECOVERY_INTERVAL_MS = 60 * 1_000

export function agentSummaryQueryKey(
  userId: number | undefined,
  sid: string | undefined
) {
  return ['agent-summary', userId ?? null, sid ?? null] as const
}

type UseAgentSummaryResult = {
  state: AgentSummaryState
  result?: AgentSummaryResult
  isFetching: boolean
}

export function useAgentSummary(): UseAgentSummaryResult {
  const userId = useAuthStore((state) => state.auth.user?.id)
  const sid = useAuthStore((state) => state.auth.session?.sid)
  const identityReady =
    typeof userId === 'number' && userId > 0 && typeof sid === 'string' && !!sid

  const query = useQuery({
    queryKey: agentSummaryQueryKey(userId, sid),
    enabled: identityReady,
    queryFn: ({ signal }) => fetchAgentSummary(signal),
    staleTime: AGENT_SUMMARY_STALE_TIME_MS,
    refetchInterval: (activeQuery) => {
      const data = activeQuery.state.data as AgentSummaryResult | undefined
      if (
        activeQuery.state.status === 'error' ||
        data?.state === 'transient-error'
      ) {
        return AGENT_SUMMARY_RECOVERY_INTERVAL_MS
      }
      return false
    },
    refetchOnWindowFocus: 'always',
    retry: shouldRetryAgentSummary,
    retryDelay: getAgentSummaryRetryDelay,
  })

  if (!identityReady || query.isPending) {
    return {
      state: 'loading',
      result: query.data,
      isFetching: query.isFetching,
    }
  }
  if (query.isError && !query.data) {
    return {
      state: 'transient-error',
      result: query.data,
      isFetching: query.isFetching,
    }
  }
  return {
    state: query.data?.state ?? 'transient-error',
    result: query.data,
    isFetching: query.isFetching,
  }
}
