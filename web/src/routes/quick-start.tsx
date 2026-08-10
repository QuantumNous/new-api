import { createFileRoute } from '@tanstack/react-router'

import { MarketingQuickStart } from '@/features/marketing/pages/QuickStart'

export const Route = createFileRoute('/quick-start')({
  component: MarketingQuickStart,
})
