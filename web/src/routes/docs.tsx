import { createFileRoute } from '@tanstack/react-router'

import { OrbitDocumentation } from '@/features/orbit-community'

export const Route = createFileRoute('/docs')({ component: OrbitDocumentation })
