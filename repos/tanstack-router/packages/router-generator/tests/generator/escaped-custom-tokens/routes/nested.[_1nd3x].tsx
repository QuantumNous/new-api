import { createFileRoute } from '@tanstack/react-router'
// @ts-nocheck
// Escaped custom indexToken in nested path - should be literal /nested/_1nd3x, NOT index of /nested
export const Route = createFileRoute('/nested/_1nd3x')()
