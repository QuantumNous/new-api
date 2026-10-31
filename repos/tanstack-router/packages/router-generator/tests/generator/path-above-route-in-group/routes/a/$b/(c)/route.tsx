import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/a/$b/(c)')({
  component: () => <div>Hello /a/$b/(c)!</div>,
})
