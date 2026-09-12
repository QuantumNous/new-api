import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/_auth/')({
  component: () => <div>Hello /_auth/!</div>,
})
