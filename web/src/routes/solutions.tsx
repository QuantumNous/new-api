import { createFileRoute } from '@tanstack/react-router'

import { MarketingSolutions } from '@/features/marketing/pages/Solutions'

export const Route = createFileRoute('/solutions')({
  component: MarketingSolutions,
})
