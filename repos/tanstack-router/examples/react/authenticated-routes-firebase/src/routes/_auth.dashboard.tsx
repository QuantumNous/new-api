import { createFileRoute } from '@tanstack/react-router'

import { useAuth } from '../auth'

export const Route = createFileRoute('/_auth/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { user } = useAuth()

  return (
    <section className="grid gap-2 p-2">
      <p>Hi {user?.displayName || user?.email || 'there'}!</p>
      <p>You are currently on the dashboard route.</p>
    </section>
  )
}
