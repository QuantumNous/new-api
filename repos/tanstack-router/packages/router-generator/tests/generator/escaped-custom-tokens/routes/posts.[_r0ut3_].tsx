import { createFileRoute } from '@tanstack/react-router'
// @ts-nocheck
// Escaped custom routeToken - should be literal /posts/_r0ut3_ path, NOT treated as layout config
export const Route = createFileRoute('/posts/_r0ut3_')()
