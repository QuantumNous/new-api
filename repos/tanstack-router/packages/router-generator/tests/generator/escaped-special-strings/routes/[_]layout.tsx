import { createFileRoute } from '@tanstack/react-router'
// @ts-nocheck
// This should be a literal /_layout path, NOT treated as a pathless layout
export const Route = createFileRoute('/_layout')()
