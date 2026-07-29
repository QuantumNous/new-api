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
import { api } from '@/lib/api'

import type {
  CheckinLeaderboardResponse,
  UsageLeaderboardResponse,
  UsagePeriod,
} from './types'

type ApiEnvelope<T> = {
  success: boolean
  message?: string
  data: T
}

// Cap client-side limit to keep the payload small. The backend already
// caps at 100; we request 20 which is plenty for a leaderboard view.
const LEADERBOARD_LIMIT = 20

export async function getUsageLeaderboard(
  period: UsagePeriod
): Promise<UsageLeaderboardResponse> {
  const res = await api.get<ApiEnvelope<UsageLeaderboardResponse>>(
    '/api/usage/leaderboard',
    { params: { period, limit: LEADERBOARD_LIMIT } }
  )
  return res.data.data
}

export async function getCheckinLeaderboard(): Promise<CheckinLeaderboardResponse> {
  const res = await api.get<ApiEnvelope<CheckinLeaderboardResponse>>(
    '/api/usage/checkin',
    { params: { limit: LEADERBOARD_LIMIT } }
  )
  return res.data.data
}
