import { createFileRoute } from '@tanstack/react-router'

// This route.tsx in a physical directory mounted at root level
// conflicts with the virtual root __root.tsx - can't have two root routes
export const Route = createFileRoute('')({})
