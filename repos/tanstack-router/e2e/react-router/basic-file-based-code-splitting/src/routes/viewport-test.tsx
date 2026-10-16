import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/viewport-test')({
  component: () => <div>Hello /viewport-test!</div>,
})
