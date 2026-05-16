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
import { type CSSProperties, type ReactNode } from 'react'
import { CreditCard, Landmark } from 'lucide-react'
import { SiAlipay, SiWechat, SiStripe } from 'react-icons/si'
import { PAYMENT_TYPES, PAYMENT_ICON_COLORS } from '../constants'

// ============================================================================
// UI Helper Functions
// ============================================================================

const HAS_LOCATION =
  typeof globalThis !== 'undefined' && 'location' in globalThis
const WAFFO_PANCAKE_LOGO = '/waffo-pancake-logo.svg'
const WAFFO_PANCAKE_ICON_BOX_STYLE: CSSProperties = {
  display: 'inline-flex',
  width: 18,
  height: 18,
  overflow: 'hidden',
  alignItems: 'center',
  justifyContent: 'flex-start',
  flex: '0 0 18px',
}
const WAFFO_PANCAKE_ICON_IMAGE_STYLE: CSSProperties = {
  display: 'block',
  height: 22,
  width: 'auto',
  maxWidth: 'none',
  transform: 'translateY(-2px)',
}

/**
 * Resolves a backend-provided image URL to http(s) only. Rejects javascript:,
 * data:, blob:, file:, and URLs with userinfo, which are unsafe in <img src/>.
 */
function normalizeHttpIconUrl(raw: string | undefined | null): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  let url: URL
  try {
    url = HAS_LOCATION
      ? new URL(s, (globalThis as { location: Location }).location.href)
      : new URL(s)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
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
 * When iconUrl is provided, render an <img/> with that URL so custom
 * gateway logos can be configured per-method.
 */
export function getPaymentIcon(
  paymentType: string | undefined,
  className: string = 'h-4 w-4',
  iconUrl?: string,
  altName?: string
): ReactNode {
  const safeIconUrl = normalizeHttpIconUrl(iconUrl)
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

  if (!paymentType) {
    return <CreditCard className={className} />
  }

  switch (paymentType) {
    case PAYMENT_TYPES.ALIPAY:
      return (
        <SiAlipay
          className={className}
          style={{ color: PAYMENT_ICON_COLORS[PAYMENT_TYPES.ALIPAY] }}
        />
      )
    case PAYMENT_TYPES.WECHAT:
      return (
        <SiWechat
          className={className}
          style={{ color: PAYMENT_ICON_COLORS[PAYMENT_TYPES.WECHAT] }}
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
      return (
        <CreditCard
          className={className}
          style={{ color: PAYMENT_ICON_COLORS[PAYMENT_TYPES.WAFFO] }}
        />
      )
    case PAYMENT_TYPES.WAFFO_PANCAKE:
      return (
        <span
          className={className}
          style={WAFFO_PANCAKE_ICON_BOX_STYLE}
          aria-hidden='true'
        >
          <img
            src={WAFFO_PANCAKE_LOGO}
            alt=''
            style={WAFFO_PANCAKE_ICON_IMAGE_STYLE}
          />
        </span>
      )
    default:
      return <CreditCard className={className} />
  }
}
