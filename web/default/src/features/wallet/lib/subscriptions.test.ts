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
import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { UserSubscriptionRecord } from '@/features/subscriptions/types'

import {
  getNextSubscriptionTransition,
  getSubscriptionHistoryPage,
  getSubscriptionStatus,
  partitionSubscriptions,
} from './subscriptions'

function record(
  id: number,
  status = 'active',
  start = 900,
  end = 1100
): UserSubscriptionRecord {
  return {
    subscription: {
      id,
      user_id: 1,
      plan_id: 1,
      status,
      start_time: start,
      end_time: end,
      amount_total: 100,
      amount_used: 20,
    },
  }
}

const ids = (records: UserSubscriptionRecord[]) =>
  records.map((item) => item.subscription.id)

test('current subscriptions keep renewals and do not count them as expired', () => {
  const records = [
    record(1),
    record(2, 'active', 1100, 1200),
    record(3, 'expired', 800, 900),
    record(4, 'cancelled', 900, 1200),
    record(5, 'active', 900, 1000),
    record(6, 'expired', 900, 1200),
  ]
  const original = structuredClone(records)
  const groups = partitionSubscriptions(records, 1000)
  assert.deepEqual(ids(groups.current), [1, 2])
  assert.deepEqual(ids(groups.active), [1])
  assert.deepEqual(ids(groups.pending), [2])
  assert.deepEqual(ids(groups.expired), [3, 5, 6])
  assert.deepEqual(ids(groups.cancelled), [4])
  assert.deepEqual(ids(groups.history), [3, 4, 5, 6])
  assert.deepEqual(
    records,
    original,
    'purchase counts must retain the full history'
  )
})

test('start is inclusive and end is exclusive, including delayed expiry jobs', () => {
  const sub = record(1, 'active', 1000, 1100).subscription
  assert.equal(getSubscriptionStatus(sub, 999), 'pending')
  assert.equal(getSubscriptionStatus(sub, 1000), 'active')
  assert.equal(getSubscriptionStatus(sub, 1100), 'expired')
  assert.equal(
    getSubscriptionStatus(record(2, 'cancelled').subscription, 1100),
    'cancelled'
  )
  assert.equal(
    getSubscriptionStatus(record(3, 'active', 0, 0).subscription, 1000),
    'expired'
  )
})

test('all-expired and empty accounts have no current subscriptions', () => {
  const records = [record(1, 'expired'), record(2, 'cancelled')]
  assert.deepEqual(partitionSubscriptions(records, 1000).current, [])
  assert.deepEqual(ids(partitionSubscriptions(records, 1000).history), [1, 2])
  assert.deepEqual(partitionSubscriptions([], 1000).history, [])
})

test('time updates target the next renewal or expiry, ignoring inactive records', () => {
  const records = [
    record(1),
    record(2, 'active', 1100, 1200),
    record(3, 'cancelled', 1001, 1002),
  ]
  assert.equal(getNextSubscriptionTransition(records, 1000), 1100)
  assert.equal(getNextSubscriptionTransition(records, 1100), 1200)
  assert.equal(getNextSubscriptionTransition(records, 1200), null)
  const groups = partitionSubscriptions(records, 1100)
  assert.deepEqual(ids(groups.active), [2])
  assert.deepEqual(ids(groups.expired), [1])
})

test('history pages stay bounded and clamp after records are removed', () => {
  const history = Array.from({ length: 23 }, (_, index) => index + 1)
  assert.deepEqual(
    getSubscriptionHistoryPage(history, 1).items,
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  )
  assert.deepEqual(
    getSubscriptionHistoryPage(history, 2).items,
    [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
  )
  assert.deepEqual(getSubscriptionHistoryPage(history, 4), {
    page: 3,
    totalPages: 3,
    items: [21, 22, 23],
  })
  assert.deepEqual(getSubscriptionHistoryPage(history.slice(0, 3), 3), {
    page: 1,
    totalPages: 1,
    items: [1, 2, 3],
  })
  assert.deepEqual(getSubscriptionHistoryPage([], 2), {
    page: 1,
    totalPages: 1,
    items: [],
  })
})
