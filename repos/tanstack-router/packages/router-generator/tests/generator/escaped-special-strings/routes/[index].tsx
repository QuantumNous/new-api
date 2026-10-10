import { createFileRoute } from '@tanstack/react-router'
// @ts-nocheck
// This should be a literal /index path, NOT treated as the index route
export const Route = createFileRoute('/index')()
