// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'

const shared = 1

function SharedComponent() {
  return <div>{shared}</div>
}

export const Route = createFileRoute('/jsx')({
  loader: () => shared,
  component: SharedComponent,
})
