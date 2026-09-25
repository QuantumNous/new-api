import { createFileRoute } from '@tanstack/react-router'
import Expensive from './-components/Expensive'

export const Route = createFileRoute('/expensive/')({
  component: Expensive,
})
