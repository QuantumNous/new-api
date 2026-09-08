import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { QueryClient } from '@tanstack/react-query'

import type { AgentOverview, ApiResult } from '../types'
import {
  refreshAgentMutationQueries,
  setAgentMutationBalance,
} from './mutation-sync'
import {
  agentAccessQueryKey,
  agentQueryKeys,
  agentUserQueryKey,
} from './workspace'

const overview = (balance: string): AgentOverview => ({
  status: 'active',
  balance,
  daily_code_limit: 200,
  daily_code_count: 10,
  daily_remaining: 190,
  next_daily_reset_at: 123,
  account_last_updated: 120,
})

describe('agent mutation cache synchronization', () => {
  test('updates both current-user caches without creating partial entries', () => {
    const queryClient = new QueryClient()
    const currentOverview = overview('400.00')
    queryClient.setQueryData(
      agentUserQueryKey(agentQueryKeys.overview, 41),
      currentOverview
    )
    queryClient.setQueryData(agentAccessQueryKey(41), currentOverview)
    queryClient.setQueryData(
      agentUserQueryKey(agentQueryKeys.overview, 99),
      currentOverview
    )

    setAgentMutationBalance(queryClient, 41, '457.00')

    assert.equal(
      queryClient.getQueryData<AgentOverview>(
        agentUserQueryKey(agentQueryKeys.overview, 41)
      )?.balance,
      '457.00'
    )
    assert.equal(
      queryClient.getQueryData<AgentOverview>(agentAccessQueryKey(41))?.balance,
      '457.00'
    )
    assert.equal(
      queryClient.getQueryData<AgentOverview>(
        agentUserQueryKey(agentQueryKeys.overview, 41)
      )?.daily_code_count,
      10
    )
    assert.equal(
      queryClient.getQueryData<AgentOverview>(
        agentUserQueryKey(agentQueryKeys.overview, 99)
      ),
      currentOverview
    )
    assert.equal(
      queryClient.getQueryData(agentUserQueryKey(agentQueryKeys.overview, 7)),
      undefined
    )
  })

  test('uses a complete server overview to reconcile both caches', async () => {
    const queryClient = new QueryClient()
    setAgentMutationBalance(queryClient, 41, '457.00')
    const serverOverview = overview('456.99')
    serverOverview.daily_code_count = 11
    serverOverview.daily_remaining = 189

    const probe = async (): Promise<ApiResult<AgentOverview>> => ({
      success: true,
      message: '',
      data: serverOverview,
    })

    await refreshAgentMutationQueries(queryClient, 41, probe)

    assert.deepEqual(
      queryClient.getQueryData<AgentOverview>(
        agentUserQueryKey(agentQueryKeys.overview, 41)
      ),
      serverOverview
    )
    assert.deepEqual(
      queryClient.getQueryData<AgentOverview>(agentAccessQueryKey(41)),
      serverOverview
    )
  })

  test('keeps the confirmed balance when background reconciliation fails', async () => {
    const queryClient = new QueryClient()
    const currentOverview = overview('400.00')
    queryClient.setQueryData(
      agentUserQueryKey(agentQueryKeys.overview, 41),
      currentOverview
    )
    queryClient.setQueryData(agentAccessQueryKey(41), currentOverview)
    setAgentMutationBalance(queryClient, 41, '457.00')

    await refreshAgentMutationQueries(queryClient, 41, async () => {
      throw new Error('temporary failure')
    })

    assert.equal(
      queryClient.getQueryData<AgentOverview>(
        agentUserQueryKey(agentQueryKeys.overview, 41)
      )?.balance,
      '457.00'
    )
    assert.equal(
      queryClient.getQueryData<AgentOverview>(agentAccessQueryKey(41))?.balance,
      '457.00'
    )
  })
})
