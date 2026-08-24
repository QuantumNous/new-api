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
  RecallOfferView,
  RecallOffersResponse,
  RecallPurchaseKind,
} from '../types'

export type RecallPriceDiscount = {
  type: string
  originalAmount: number
  discountAmount: number
  discountedAmount: number
  currency: string
}

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
  productId: string | number | undefined,
  purchaseKind: RecallPurchaseKind,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!claim || productId === undefined || claim.expires_at <= nowSeconds) {
    return false
  }

  if (purchaseKind === 'topup') {
    return (
      typeof productId === 'string' &&
      claim.products.topup_price_ids.includes(productId)
    )
  }
  return (
    (typeof productId === 'string' &&
      claim.products.subscription_price_ids.includes(productId)) ||
    (typeof productId === 'number' &&
      (claim.products.subscription_plan_ids ?? []).includes(productId))
  )
}

function currencyMinorUnitFactor(currency: string): number {
  return currency.toUpperCase() === 'JPY' ? 1 : 100
}

function amountToMinor(amountMajor: number, currency: string): number {
  if (!Number.isFinite(amountMajor) || amountMajor <= 0) return 0
  return Math.round(amountMajor * currencyMinorUnitFactor(currency))
}

function minorToAmount(amountMinor: number, currency: string): number {
  return Math.round(amountMinor) / currencyMinorUnitFactor(currency)
}

function getFixedDiscountMinor(
  claim: RecallClaimView,
  currency: string
): number | null {
  const requestedCurrency = currency.toUpperCase()
  const options = claim.discount.currency_options ?? {}
  const optionAmount =
    options[requestedCurrency] ?? options[requestedCurrency.toLowerCase()]
  if (typeof optionAmount === 'number') {
    return Math.max(0, Math.round(optionAmount))
  }
  if (claim.discount.currency.toUpperCase() !== requestedCurrency) return null
  return Math.max(0, Math.round(claim.discount.amount_off || 0))
}

export function getRecallPriceDiscount(
  claim: RecallClaimView | null | undefined,
  productId: string | number | undefined,
  purchaseKind: RecallPurchaseKind,
  amountMajor: number,
  currency: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): RecallPriceDiscount | null {
  const normalizedCurrency = currency.trim().toUpperCase()
  if (
    !isRecallPriceEligible(claim, productId, purchaseKind, nowSeconds) ||
    !claim ||
    !normalizedCurrency
  ) {
    return null
  }

  const priceMinor = amountToMinor(amountMajor, normalizedCurrency)
  if (priceMinor <= 0) return null

  const minimumAmount = Math.max(
    0,
    Math.round(claim.discount.minimum_amount || 0)
  )
  if (minimumAmount > 0) {
    if (
      claim.discount.minimum_amount_currency.toUpperCase() !==
      normalizedCurrency
    ) {
      return null
    }
    if (priceMinor < minimumAmount) return null
  }

  let rawDiscountMinor: number
  if (claim.discount.type === 'percent') {
    rawDiscountMinor = Math.round(
      (priceMinor * Math.max(0, claim.discount.percent_off || 0)) / 100
    )
  } else {
    const fixedMinor = getFixedDiscountMinor(claim, normalizedCurrency)
    if (fixedMinor === null) return null
    rawDiscountMinor = fixedMinor
  }
  const discountMinor = Math.min(priceMinor, Math.max(0, rawDiscountMinor))
  if (discountMinor <= 0) return null

  return {
    type: claim.discount.type,
    originalAmount: minorToAmount(priceMinor, normalizedCurrency),
    discountAmount: minorToAmount(discountMinor, normalizedCurrency),
    discountedAmount: minorToAmount(priceMinor - discountMinor, normalizedCurrency),
    currency: normalizedCurrency,
  }
}

export type RecallOfferPurchaseFacts = {
  purchaseKind: RecallPurchaseKind
  productId: string | number | undefined
  amountMajor: number
  currency: string
  nowSeconds?: number
}

export function selectBestRecallOffer(
  offers: readonly RecallOfferView[],
  facts: RecallOfferPurchaseFacts
): RecallOfferView | null {
  let best: {
    offer: RecallOfferView
    discountMinor: number
  } | null = null

  for (const offer of offers) {
    const discount = getRecallPriceDiscount(
      offer,
      facts.productId,
      facts.purchaseKind,
      facts.amountMajor,
      facts.currency,
      facts.nowSeconds
    )
    if (!discount) continue

    const offerDiscountMinor = amountToMinor(
      discount.discountAmount,
      discount.currency
    )
    if (
      !best ||
      offerDiscountMinor > best.discountMinor ||
      (offerDiscountMinor === best.discountMinor &&
        (offer.issued_at > best.offer.issued_at ||
          (offer.issued_at === best.offer.issued_at &&
            offer.recipient_id < best.offer.recipient_id)))
    ) {
      best = { offer, discountMinor: offerDiscountMinor }
    }
  }

  return best?.offer ?? null
}

export async function listRecallOffers(): Promise<RecallOffersResponse> {
  const { api } = await import('@/lib/api')
  const response = await api.get('/api/user/recall/offers')
  return response.data
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
