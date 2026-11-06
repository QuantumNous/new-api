import { createFileRoute } from '@tanstack/solid-router'
import { m } from '@/paraglide/messages'

export const Route = createFileRoute('/about')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>{m.about_message()}</div>
}
