import { createFileRoute } from '@tanstack/react-router'
import { Link, Outlet } from '@tanstack/react-router'

import { fetchInvoices } from '../posts'

export const Route = createFileRoute('/_auth/invoices')({
  loader: async () => ({
    invoices: await fetchInvoices(),
  }),
  component: InvoicesRoute,
})

function InvoicesRoute() {
  const { invoices } = Route.useLoaderData()

  return (
    <div className="grid grid-cols-3 md:grid-cols-5 min-h-[500px]">
      <div className="col-span-1 py-2 pl-2 pr-4 md:border-r">
        <p className="mb-2">Choose an invoice from the list below.</p>
        <ol className="grid gap-2">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <Link
                to="/invoices/$invoiceId"
                params={{ invoiceId: invoice.id.toString() }}
                className="text-blue-600 hover:opacity-75"
                activeProps={{ className: 'font-bold underline' }}
              >
                <span className="tabular-nums">
                  #{invoice.id.toString().padStart(2, '0')}
                </span>{' '}
                - {invoice.title.slice(0, 16)}...
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <div className="col-span-2 md:col-span-4 py-2 px-4">
        <Outlet />
      </div>
    </div>
  )
}
