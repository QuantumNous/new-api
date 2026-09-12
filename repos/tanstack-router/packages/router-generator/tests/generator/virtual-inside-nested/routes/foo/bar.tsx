import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/foo/bar')({
  component: () => <div>Hello /foo/bar!</div>,
})
