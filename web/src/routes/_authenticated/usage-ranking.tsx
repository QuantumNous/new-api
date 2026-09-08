import { createFileRoute } from '@tanstack/react-router'
import { UsageRanking } from '@/features/usage-ranking'
export const Route = createFileRoute('/_authenticated/usage-ranking')({ component: UsageRanking })
