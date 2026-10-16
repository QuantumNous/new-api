import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/users/')({
  component: UsersIndexComponent,
})

function UsersIndexComponent() {
  return <div>Select a user.</div>
}
