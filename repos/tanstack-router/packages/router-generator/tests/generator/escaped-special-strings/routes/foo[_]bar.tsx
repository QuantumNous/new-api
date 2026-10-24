import { createFileRoute } from '@tanstack/react-router'
// @ts-nocheck
// This should be a literal /foo_bar path with underscore in middle
export const Route = createFileRoute('/foo_bar')()
