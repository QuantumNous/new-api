import { type ReactNode } from 'react'
import { CreditCard } from 'lucide-react'
import { SiAlipay, SiWechat, SiStripe } from 'react-icons/si'
import { PAYMENT_TYPES, PAYMENT_ICON_COLORS } from '../constants'

// ============================================================================
// UI Helper Functions
// ============================================================================

/**
 * Get payment method icon component
 */
export function getPaymentIcon(
  paymentType: string | undefined,
  className: string = 'h-4 w-4'
): ReactNode {
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
    default:
      return <CreditCard className={className} />
  }
}
