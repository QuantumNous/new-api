import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/classic/hello/')({
  component: () => <div>This is the index</div>,
})
