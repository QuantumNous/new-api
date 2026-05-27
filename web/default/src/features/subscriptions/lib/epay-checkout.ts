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
export interface SubscriptionEpayCheckout {
  tradeNo: string
  url: string
  params: Record<string, unknown>
  createdAt: number
}

const CHECKOUT_STORAGE_PREFIX = 'subscription-epay-checkout:'
const CHECKOUT_STORAGE_TTL_MS = 10 * 60 * 1000

function getStorageKey(tradeNo: string): string {
  return `${CHECKOUT_STORAGE_PREFIX}${tradeNo}`
}

function parseSafeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

export function saveSubscriptionEpayCheckout(
  checkout: Omit<SubscriptionEpayCheckout, 'createdAt'>
): void {
  if (typeof window === 'undefined' || !checkout.tradeNo || !checkout.url) {
    return
  }

  const payload: SubscriptionEpayCheckout = {
    ...checkout,
    createdAt: Date.now(),
  }
  window.sessionStorage.setItem(
    getStorageKey(checkout.tradeNo),
    JSON.stringify(payload)
  )
}

export function readSubscriptionEpayCheckout(
  tradeNo: string
): SubscriptionEpayCheckout | null {
  if (typeof window === 'undefined' || !tradeNo) {
    return null
  }

  const raw = window.sessionStorage.getItem(getStorageKey(tradeNo))
  if (!raw) {
    return null
  }

  try {
    const checkout = JSON.parse(raw) as SubscriptionEpayCheckout
    if (Date.now() - checkout.createdAt > CHECKOUT_STORAGE_TTL_MS) {
      clearSubscriptionEpayCheckout(tradeNo)
      return null
    }
    if (!checkout.url || !checkout.params) {
      return null
    }
    return checkout
  } catch {
    clearSubscriptionEpayCheckout(tradeNo)
    return null
  }
}

export function clearSubscriptionEpayCheckout(tradeNo: string): void {
  if (typeof window === 'undefined' || !tradeNo) {
    return
  }
  window.sessionStorage.removeItem(getStorageKey(tradeNo))
}

export function submitSubscriptionEpayCheckout(
  checkout: SubscriptionEpayCheckout,
  target: string
): boolean {
  const checkoutUrl = parseSafeHttpUrl(checkout.url)
  if (!checkoutUrl) {
    return false
  }

  const form = document.createElement('form')
  form.action = checkoutUrl
  form.method = 'POST'
  form.target = target

  Object.entries(checkout.params).forEach(([key, value]) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = key
    input.value = String(value)
    form.appendChild(input)
  })

  document.body.appendChild(form)
  form.submit()
  document.body.removeChild(form)
  return true
}
