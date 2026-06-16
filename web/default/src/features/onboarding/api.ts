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
  ApiResponse,
  CardBindRequest,
  CardBindResponse,
  CardStatusResponse,
} from './types'

/**
 * Check if an API response indicates success.
 */
export function isApiSuccess(response: ApiResponse): boolean {
  return response.success === true || response.message === 'success'
}

/**
 * Begin Stripe card binding: returns a hosted Checkout (setup mode) link to redirect to.
 */
export async function beginCardBind(
  request: CardBindRequest = {}
): Promise<CardBindResponse> {
  const res = await api.post('/api/user/stripe/card/bind', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Fetch the current user's card-binding status.
 */
export async function getCardStatus(): Promise<CardStatusResponse> {
  const res = await api.get('/api/user/stripe/card')
  return res.data
}
