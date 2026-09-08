import type { QueryClient } from '@tanstack/react-query'

import { getAgentAccessOverview } from '../api'
import type { AgentOverview, ApiResult } from '../types'
import {
  agentAccessQueryKey,
  agentMutationInvalidationKeys,
  agentQueryKeys,
  agentUserQueryKey,
} from './workspace'

export function setAgentMutationBalance(
  queryClient: QueryClient,
  userID: number,
  balanceAfter: string
): void {
  const queryKeys = [
    agentUserQueryKey(agentQueryKeys.overview, userID),
    agentAccessQueryKey(userID),
  ]

  for (const queryKey of queryKeys) {
    queryClient.setQueryData<AgentOverview>(queryKey, (current) =>
      current ? { ...current, balance: balanceAfter } : current
    )
  }
}

export async function refreshAgentMutationQueries(
  queryClient: QueryClient,
  userID: number,
  probe: () => Promise<ApiResult<AgentOverview>> = getAgentAccessOverview
): Promise<void> {
  const listRefreshes = agentMutationInvalidationKeys
    .filter((queryKey) => queryKey !== agentQueryKeys.overview)
    .map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'all' })
    )

  await Promise.allSettled(listRefreshes)

  try {
    const response = await probe()
    if (!response.success) return

    queryClient.setQueryData(
      agentUserQueryKey(agentQueryKeys.overview, userID),
      response.data
    )
    queryClient.setQueryData(agentAccessQueryKey(userID), response.data)
  } catch {
    // Keep the balance confirmed by the completed mutation.
  }
}
