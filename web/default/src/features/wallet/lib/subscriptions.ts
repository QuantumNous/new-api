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
import type {
  UserSubscription,
  UserSubscriptionRecord,
} from '@/features/subscriptions/types'

export function getSubscriptionStatus(
  subscription: UserSubscription,
  now: number
) {
  if (subscription.status === 'cancelled') return 'cancelled'
  if (subscription.status !== 'active' || subscription.end_time <= now) {
    return 'expired'
  }
  return subscription.start_time > now ? 'pending' : 'active'
}

export function partitionSubscriptions(
  subscriptions: UserSubscriptionRecord[],
  now: number
) {
  const groups = {
    active: [] as UserSubscriptionRecord[],
    pending: [] as UserSubscriptionRecord[],
    expired: [] as UserSubscriptionRecord[],
    cancelled: [] as UserSubscriptionRecord[],
    current: [] as UserSubscriptionRecord[],
    history: [] as UserSubscriptionRecord[],
  }
  for (const record of subscriptions) {
    const status = getSubscriptionStatus(record.subscription, now)
    groups[status].push(record)
    if (status === 'active' || status === 'pending') {
      groups.current.push(record)
    } else {
      groups.history.push(record)
    }
  }
  return groups
}

export function getNextSubscriptionTransition(
  subscriptions: UserSubscriptionRecord[],
  now: number
) {
  let next: number | null = null
  for (const { subscription } of subscriptions) {
    if (subscription.status !== 'active' || subscription.end_time <= now) {
      continue
    }
    for (const timestamp of [subscription.start_time, subscription.end_time]) {
      if (timestamp > now && (next === null || timestamp < next)) {
        next = timestamp
      }
    }
  }
  return next
}

export function getSubscriptionHistoryPage<T>(
  history: T[],
  requestedPage: number
) {
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(history.length / pageSize))
  const page = Math.min(Math.max(1, requestedPage), totalPages)
  return {
    page,
    totalPages,
    items: history.slice((page - 1) * pageSize, page * pageSize),
  }
}
