import { createFileRoute } from '@tanstack/react-router'
// @ts-nocheck
// This should be a literal /blog_ path, NOT escaping from parent layout
export const Route = createFileRoute('/blog_')()
