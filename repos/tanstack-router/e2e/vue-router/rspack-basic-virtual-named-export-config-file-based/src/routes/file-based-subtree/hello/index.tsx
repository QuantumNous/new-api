import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/classic/hello/')({
  component: () => <div>This is the index</div>,
})
