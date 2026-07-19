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

import type { LotteryDrawResult, LotteryStatus } from './types'

type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}

export async function getLotteryStatus(): Promise<LotteryStatus> {
  const res = await api.get('/api/user/lottery')
  const body = res.data as ApiResponse<LotteryStatus>
  if (!body.success || !body.data) {
    throw new Error(body.message || 'Failed to load lottery status')
  }
  return body.data
}

export async function drawLottery(
  betUsd: number,
  turnstileToken?: string
): Promise<LotteryDrawResult> {
  const url = turnstileToken
    ? `/api/user/lottery?turnstile=${encodeURIComponent(turnstileToken)}`
    : '/api/user/lottery'
  const res = await api.post(url, { bet_usd: betUsd })
  const body = res.data as ApiResponse<LotteryDrawResult>
  if (!body.success || !body.data) {
    throw new Error(body.message || 'Lottery draw failed')
  }
  return body.data
}
