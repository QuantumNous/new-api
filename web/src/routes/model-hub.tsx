import { createFileRoute } from '@tanstack/react-router'

import { OrbitModelHub } from '@/features/home/components/orbit-landing'

export const Route = createFileRoute('/model-hub')({ component: OrbitModelHub })
