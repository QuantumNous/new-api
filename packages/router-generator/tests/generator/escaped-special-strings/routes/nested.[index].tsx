import { createFileRoute } from '@tanstack/react-router'
// @ts-nocheck
// This should be /nested/index (literal), NOT treated as the index of /nested
export const Route = createFileRoute('/nested/index')()
