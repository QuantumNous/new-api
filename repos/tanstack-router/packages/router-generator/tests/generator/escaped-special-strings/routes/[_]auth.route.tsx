import { createFileRoute } from '@tanstack/react-router'
// @ts-nocheck
// This should be a layout config for /_auth path (underscore is escaped, but .route suffix is honored)
export const Route = createFileRoute('/_auth')()
