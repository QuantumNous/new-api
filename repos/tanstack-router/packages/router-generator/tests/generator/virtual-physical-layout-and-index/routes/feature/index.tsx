import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/feature/')({
  component: () => <div>Feature Index</div>,
})
