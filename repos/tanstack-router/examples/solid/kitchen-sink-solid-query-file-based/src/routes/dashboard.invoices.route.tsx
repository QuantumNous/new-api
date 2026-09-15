import {
  Link,
  MatchRoute,
  Outlet,
  createFileRoute,
} from '@tanstack/solid-router'
import { useQuery } from '@tanstack/solid-query'
import { Spinner } from '../components/Spinner'
import { invoicesQueryOptions } from '../utils/queryOptions'

export const Route = createFileRoute('/dashboard/invoices')({
  loader: (opts) =>
    opts.context.queryClient.ensureQueryData(invoicesQueryOptions()),
  component: InvoicesComponent,
})

function InvoicesComponent() {
  const invoicesQuery = useQuery(() => invoicesQueryOptions())
  const invoices = invoicesQuery.data

  return (
    <div class="flex-1 flex">
      <div class="divide-y w-48">
        {invoices?.map((invoice) => {
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
        })}
      </div>
      <div class="flex-1 border-l">
        <Outlet />
      </div>
    </div>
  )
}
