import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { QuotaDataItem } from '../../types'
import { processUserChartData } from '../charts'

test('keeps users with the same display name in separate chart series', () => {
  const rows: QuotaDataItem[] = [
    {
      user_id: 1,
      username: 'username1',
      display_name: 'User A',
      created_at: 1_735_689_600,
      quota: 100,
    },
    {
      user_id: 2,
      username: 'username2',
      display_name: 'User A',
      created_at: 1_735_689_600,
      quota: 200,
    },
  ]

  const result = processUserChartData(rows)
  const rankValues = result.spec_user_rank.data[0].values as Array<{
    User: string
    rawQuota: number
    Usage: number
  }>
  const trendValues = result.spec_user_trend.data[0].values as Array<{
    User: string
    rawQuota: number
  }>

  assert.deepEqual(rankValues, [
    { User: 'User A (username2)', rawQuota: 200, Usage: 0.0004 },
    { User: 'User A (username1)', rawQuota: 100, Usage: 0.0002 },
  ])
  assert.deepEqual(
    trendValues.map(({ User, rawQuota }) => ({ User, rawQuota })),
    [
      { User: 'User A (username2)', rawQuota: 200 },
      { User: 'User A (username1)', rawQuota: 100 },
    ]
  )
})

test('uses usernames to separate legacy rows without user ids', () => {
  const rows: QuotaDataItem[] = [
    {
      user_id: 0,
      username: 'alice',
      display_name: 'Alice',
      created_at: 1_735_689_600,
      quota: 100,
    },
    {
      user_id: 0,
      username: 'bob',
      display_name: 'Bob',
      created_at: 1_735_689_600,
      quota: 200,
    },
  ]

  const result = processUserChartData(rows)
  const rankValues = result.spec_user_rank.data[0].values as Array<{
    User: string
    rawQuota: number
  }>

  assert.deepEqual(
    rankValues.map(({ User, rawQuota }) => ({ User, rawQuota })),
    [
      { User: 'Bob', rawQuota: 200 },
      { User: 'Alice', rawQuota: 100 },
    ]
  )
})
