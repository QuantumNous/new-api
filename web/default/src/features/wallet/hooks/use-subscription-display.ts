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
import { useEffect, useMemo, useState } from 'react'

import type { UserSubscriptionRecord } from '@/features/subscriptions/types'

import {
  getNextSubscriptionTransition,
  partitionSubscriptions,
} from '../lib/subscriptions'

export function useSubscriptionDisplay(
  subscriptions: UserSubscriptionRecord[]
) {
  const [now, setNow] = useState(() => Date.now() / 1000)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      clearTimeout(timer)
      const timestamp = Date.now() / 1000
      setNow(timestamp)
      const next = getNextSubscriptionTransition(subscriptions, timestamp)
      if (next !== null) {
        // Browsers overflow longer timeout delays; recheck when the cap is reached.
        timer = setTimeout(
          update,
          Math.min((next - timestamp) * 1000, 2147483647)
        )
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') update()
    }
    update()
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [subscriptions])

  const groups = useMemo(
    () => partitionSubscriptions(subscriptions, now),
    [subscriptions, now]
  )
  return { ...groups, now }
}
