import { createFileRoute } from '@tanstack/solid-router'
import * as Solid from 'solid-js'
import { Link, MatchRoute, Outlet } from '@tanstack/solid-router'
import { Spinner } from '../components/Spinner'
import { fetchInvoices } from '../utils/mockTodos'

export const Route = createFileRoute('/dashboard/invoices')({
  loader: () => fetchInvoices(),
  component: InvoicesComponent,
})

function InvoicesComponent() {
  const invoices = Route.useLoaderData()

  return (
    <div class="flex-1 flex">
      <div class="divide-y w-48">
        <Solid.For each={invoices()}>
          {(invoice) => {
            return (
              <div>
                <Link
                  to="/dashboard/invoices/$invoiceId"
                  params={{
                    invoiceId: invoice.id,
                  }}
                  preload="intent"
                  class="block py-2 px-3 text-blue-700"
                  activeProps={{ class: `font-bold` }}
                >
                  <pre class="text-sm">
                    #{invoice.id} - {invoice.title.slice(0, 10)}{' '}
                    <MatchRoute
                      to="/dashboard/invoices/$invoiceId"
                      params={{
                        invoiceId: invoice.id,
                      }}
                      pending
                    >
                      {(match) => <Spinner show={!!match} wait="delay-50" />}
                    </MatchRoute>
                  </pre>
                </Link>
              </div>
            )
          }}
        </Solid.For>
      </div>
      <div class="flex-1 border-l">
        <Outlet />
      </div>
    </div>
  )
}
