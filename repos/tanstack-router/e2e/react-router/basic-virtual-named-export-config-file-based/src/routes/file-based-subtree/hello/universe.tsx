import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/classic/hello/universe')({
  component: () => <div>Hello /classic/hello/universe!</div>,
})
