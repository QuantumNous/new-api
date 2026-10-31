import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/_layout/dashboard')({
  component: () => <div>Hello !</div>,
})
