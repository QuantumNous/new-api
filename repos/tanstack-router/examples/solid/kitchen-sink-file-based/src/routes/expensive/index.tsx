import { createFileRoute } from '@tanstack/solid-router'
import Expensive from './-components/Expensive'

export const Route = createFileRoute('/expensive/')({
  component: Expensive,
})
