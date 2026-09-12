import { createFileRoute } from '@tanstack/solid-router'
import * as Solid from 'solid-js'

import { fetchInvoices } from '../utils/mockTodos'

export const Route = createFileRoute('/dashboard/')({
  loader: () => fetchInvoices(),
  component: DashboardIndexComponent,
})

function DashboardIndexComponent() {
  const invoices = Route.useLoaderData()

  return (
    <div class="p-2">
      <div class="p-2">
        Welcome to the dashboard! You have{' '}
        <strong>{invoices.length} total invoices</strong>.
      </div>
    </div>
  )
}
