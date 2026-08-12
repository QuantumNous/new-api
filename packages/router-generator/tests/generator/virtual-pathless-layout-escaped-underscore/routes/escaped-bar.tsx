import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/_escaped-bar')({
  component: () => 'Escaped Bar',
})
