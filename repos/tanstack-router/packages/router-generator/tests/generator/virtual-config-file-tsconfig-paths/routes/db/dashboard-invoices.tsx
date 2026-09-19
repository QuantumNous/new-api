import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/_layout/dashboard/invoices')({
  component: () => <div>Hello !</div>,
})
