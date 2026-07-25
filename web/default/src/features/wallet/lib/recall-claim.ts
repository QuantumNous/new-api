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
  RecallClaimResponse,
  RecallClaimView,
  RecallPurchaseKind,
} from '../types'

export function normalizeRecallClaim(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const claim = value.trim()
  return claim || undefined
}

export function removeRecallClaimFromSearch(search: string): string {
  const searchParams = new URLSearchParams(search)
  searchParams.delete('recall_claim')
  const remainingSearch = searchParams.toString()
  return remainingSearch ? `?${remainingSearch}` : ''
}

export function getTopupStripePriceId(
  stripePriceIds: Record<number, string> | undefined,
  amount: number
): string | undefined {
  return normalizeRecallClaim(stripePriceIds?.[amount])
}

export function isRecallPriceEligible(
  claim: RecallClaimView | null | undefined,
  priceId: string | undefined,
  purchaseKind: RecallPurchaseKind,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!claim || !priceId || claim.expires_at <= nowSeconds) {
    return false
  }

  const eligiblePriceIds =
    purchaseKind === 'topup'
      ? claim.products.topup_price_ids
      : claim.products.subscription_price_ids
  return eligiblePriceIds.includes(priceId)
}

export async function validateRecallClaim(input: {
  claim: string
  price_id?: string
  purchase_kind?: RecallPurchaseKind
}): Promise<RecallClaimResponse> {
  const { api } = await import('@/lib/api')
  const response = await api.post('/api/user/recall/claim/validate', input, {
    skipBusinessError: true,
    skipErrorHandler: true,
  })
  return response.data
}
