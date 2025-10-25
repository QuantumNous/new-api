import { createFileRoute } from '@tanstack/react-router'
import { ModelDetails } from '@/features/pricing/components/model-details'

export const Route = createFileRoute('/pricing/$modelId/')({
  component: ModelDetails,
})
