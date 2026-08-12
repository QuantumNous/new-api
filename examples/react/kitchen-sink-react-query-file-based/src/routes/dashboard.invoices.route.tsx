import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Link, MatchRoute, Outlet } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Spinner } from '../components/Spinner'
import { invoicesQueryOptions } from '../utils/queryOptions'

export const Route = createFileRoute('/dashboard/invoices')({
  loader: (opts) =>
    opts.context.queryClient.ensureQueryData(invoicesQueryOptions()),
  component: InvoicesComponent,
})

function InvoicesComponent() {
  const invoicesQuery = useSuspenseQuery(invoicesQueryOptions())
  const invoices = invoicesQuery.data

  return (
    <div className="flex-1 flex">
      <div className="divide-y w-48">
        {invoices.map((invoice) => {
          return (
            <div key={invoice.id}>
              <Link
                to="/dashboard/invoices/$invoiceId"
                params={{
                  invoiceId: invoice.id,
                }}
                preload="intent"
                className="block py-2 px-3 text-blue-700"
                activeProps={{ className: `font-bold` }}
              >
                <pre className="text-sm">
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
        })}
      </div>
      <div className="flex-1 border-l">
        <Outlet />
      </div>
    </div>
  )
}
