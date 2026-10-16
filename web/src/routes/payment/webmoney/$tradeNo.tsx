import { createFileRoute } from '@tanstack/react-router'

import { HostedPaymentPage } from '@/features/wallet/hosted-payment-page'

export const Route = createFileRoute('/payment/webmoney/$tradeNo')({
  component: Checkout,
})
function Checkout() {
  const { tradeNo } = Route.useParams()
  return <HostedPaymentPage provider='webmoney' tradeNo={tradeNo} />
}
