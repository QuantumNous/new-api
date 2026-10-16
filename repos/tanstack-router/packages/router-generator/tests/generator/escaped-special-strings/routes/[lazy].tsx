import { createFileRoute } from '@tanstack/react-router'
// @ts-nocheck
// This should be a literal /lazy path, NOT treated as a lazy-loaded route
export const Route = createFileRoute('/lazy')()
