import { createFileRoute } from '@tanstack/react-router'

import { MarketingContactSales } from '@/features/marketing/pages/ContactSales'

export const Route = createFileRoute('/contact-sales')({
  component: MarketingContactSales,
})
