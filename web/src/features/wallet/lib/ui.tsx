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
import { CreditCard, Landmark } from 'lucide-react'
import type { ReactNode } from 'react'
import { SiAlipay, SiStripe } from 'react-icons/si'

import { ReactIconByName } from '@/components/react-icon-by-name'

import { PAYMENT_TYPES, PAYMENT_ICON_COLORS } from '../constants'

// ============================================================================
// UI Helper Functions
// ============================================================================

export function getPaymentBrandClassName(paymentType?: string): string {
  switch (paymentType) {
    case 'webmoney':
      return 'text-[#036cb5] dark:text-sky-400'
    case 'mixpay':
      return 'text-blue-600 dark:text-blue-400'
    case PAYMENT_TYPES.ALIPAY:
    case PAYMENT_TYPES.ALIPAY_DIRECT:
      return 'text-blue-600 dark:text-blue-400'
    case PAYMENT_TYPES.WECHAT:
    case 'wechatpay_native':
      return 'text-green-700 dark:text-green-400'
    case PAYMENT_TYPES.STRIPE:
      return 'text-violet-600 dark:text-violet-400'
    case PAYMENT_TYPES.CREEM:
      return 'text-indigo-600 dark:text-indigo-400'
    case PAYMENT_TYPES.WAFFO_PANCAKE:
      return 'text-orange-700 dark:text-orange-400'
    case PAYMENT_TYPES.WAFFO:
    case 'epay':
      return 'text-blue-600 dark:text-blue-400'
    default:
      return ''
  }
}

// Shared geometry for every wallet payment action, including Waffo channels.
export const PAYMENT_ACTION_CLASS_NAME =
  'relative h-14 min-h-14 w-full min-w-0 shrink-0 gap-2 overflow-hidden rounded-xl border px-3 py-2 text-sm font-semibold whitespace-normal text-white transition-transform duration-150 ease-out motion-safe:enabled:hover:scale-[1.02] motion-reduce:transition-none'

// Brand shades retain contrast with white payment-button labels.
export function getPaymentButtonClassName(paymentType: string): string {
  switch (paymentType) {
    case 'antom':
      return 'border border-[#0a22aa]/20 bg-white text-[#0a22aa]'
    case 'webmoney':
      return 'bg-[#036cb5]'
    case PAYMENT_TYPES.WECHAT:
    case 'wechatpay_native':
      return 'bg-[#07883f]'
    case PAYMENT_TYPES.ALIPAY:
    case PAYMENT_TYPES.ALIPAY_DIRECT:
      return 'bg-[#0969da]'
    case 'mixpay':
      return 'bg-[#194bff]'
    case PAYMENT_TYPES.STRIPE:
      return 'bg-[#635bff]'
    case PAYMENT_TYPES.CREEM:
      return 'bg-indigo-600'
    case PAYMENT_TYPES.WAFFO_PANCAKE:
      return 'bg-orange-700'
    default:
      return 'bg-blue-600'
  }
}

/**
 * Resolves a backend-provided image URL to https only. Rejects http:,
 * data:, blob:, file:, relative paths, and URLs with userinfo, which are unsafe
 * or ambiguous in <img src/>.
 */
function normalizeHttpIconUrl(raw: string | undefined | null): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  if (!/^https:\/\//i.test(s)) return null

  let url: URL
  try {
    url = new URL(s)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') {
    return null
  }
  if (url.username || url.password) {
    return null
  }
  return url.toString()
}

/**
 * Get payment method icon component
 *
 * When icon is provided, render a safe http(s) image URL or resolve it as a
 * react-icons component name. Invalid configured icons intentionally render
 * nothing instead of falling back to the payment type.
 */
export function getPaymentIcon(
  paymentType: string | undefined,
  className: string = 'h-4 w-4',
  icon?: string,
  altName?: string
): ReactNode {
  let brandColor: string | undefined =
    PAYMENT_ICON_COLORS[paymentType as keyof typeof PAYMENT_ICON_COLORS]
  if (
    paymentType === PAYMENT_TYPES.ALIPAY ||
    paymentType === PAYMENT_TYPES.ALIPAY_DIRECT
  ) {
    brandColor = PAYMENT_ICON_COLORS[PAYMENT_TYPES.ALIPAY]
  } else if (
    paymentType === PAYMENT_TYPES.WECHAT ||
    paymentType === 'wechatpay_native'
  ) {
    brandColor = PAYMENT_ICON_COLORS[PAYMENT_TYPES.WECHAT]
  }
  if (paymentType === 'epay') brandColor = '#2563EB'
  const iconValue = icon?.trim()
  const safeIconUrl = normalizeHttpIconUrl(iconValue)
  if (safeIconUrl) {
    return (
      <img
        src={safeIconUrl}
        alt={altName || paymentType || 'payment'}
        className={className}
        style={{ objectFit: 'contain' }}
        loading='lazy'
        decoding='async'
        referrerPolicy='no-referrer'
      />
    )
  }
  if (
    iconValue &&
    !(
      iconValue === 'SiWechat' &&
      (paymentType === PAYMENT_TYPES.WECHAT ||
        paymentType === 'wechatpay_native')
    )
  ) {
    return (
      <ReactIconByName
        name={iconValue}
        className={className}
        title={altName || paymentType || iconValue}
        style={{ color: brandColor }}
      />
    )
  }

  if (!paymentType) {
    return <CreditCard className={className} />
  }

  switch (paymentType) {
    case 'antom':
      return (
        <img
          src='/antom-logo.svg'
          alt='Antom'
          className={className}
          style={{ width: 'auto', objectFit: 'contain' }}
        />
      )
    case 'webmoney':
      return (
        <img
          src='/webmoney-logo.svg'
          alt={altName || 'WebMoney'}
          className={className}
          style={{ objectFit: 'contain' }}
        />
      )
    case 'mixpay':
      return (
        <img
          src='/mixpay-logo.svg'
          alt={altName || 'MixPay'}
          className={className}
          style={{ objectFit: 'contain' }}
        />
      )
    case PAYMENT_TYPES.ALIPAY:
    case PAYMENT_TYPES.ALIPAY_DIRECT:
      return (
        <SiAlipay
          className={className}
          style={{ color: PAYMENT_ICON_COLORS[PAYMENT_TYPES.ALIPAY] }}
        />
      )
    case PAYMENT_TYPES.WECHAT:
    case 'wechatpay_native':
      return (
        <img
          src='/wechatpay-logo.svg'
          alt={altName || 'WeChat Pay'}
          className={className}
          style={{ objectFit: 'contain' }}
        />
      )
    case PAYMENT_TYPES.STRIPE:
      return (
        <SiStripe
          className={className}
          style={{ color: PAYMENT_ICON_COLORS[PAYMENT_TYPES.STRIPE] }}
        />
      )
    case PAYMENT_TYPES.CREEM:
      return (
        <Landmark
          className={className}
          style={{ color: PAYMENT_ICON_COLORS[PAYMENT_TYPES.CREEM] }}
        />
      )
    case PAYMENT_TYPES.WAFFO:
    case 'epay':
      return (
        <CreditCard
          className={className}
          style={{ color: PAYMENT_ICON_COLORS[PAYMENT_TYPES.WAFFO] }}
        />
      )
    case PAYMENT_TYPES.WAFFO_PANCAKE:
      return (
        <span
          aria-hidden='true'
          className={`inline-block shrink-0 bg-current text-orange-700 dark:text-orange-400 ${className}`}
          style={{
            maskImage: 'url(/waffo-logo-light.svg)',
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
            transform: 'scale(2)',
          }}
        />
      )
    default:
      return <CreditCard className={className} />
  }
}
