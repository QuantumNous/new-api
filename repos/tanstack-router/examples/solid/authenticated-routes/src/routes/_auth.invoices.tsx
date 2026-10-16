import { Link, Outlet, createFileRoute } from '@tanstack/solid-router'

import { fetchInvoices } from '../posts'

export const Route = createFileRoute('/_auth/invoices')({
  loader: async () => ({
    invoices: await fetchInvoices(),
  }),
  component: InvoicesRoute,
})

function InvoicesRoute() {
  const loaderData = Route.useLoaderData()

  return (
    <div class="grid grid-cols-3 md:grid-cols-5 min-h-[500px]">
      <div class="col-span-1 py-2 pl-2 pr-4 md:border-r">
        <p class="mb-2">Choose an invoice from the list below.</p>
        <ol class="grid gap-2">
          {loaderData().invoices.map((invoice) => (
            <li>
              <Link
                to="/invoices/$invoiceId"
                params={{ invoiceId: invoice.id.toString() }}
                class="text-blue-600 hover:opacity-75"
                activeProps={{ class: 'font-bold underline' }}
              >
                <span class="tabular-nums">
                  #{invoice.id.toString().padStart(2, '0')}
                </span>{' '}
                - {invoice.title.slice(0, 16)}...
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <div class="col-span-2 md:col-span-4 py-2 px-4">
        <Outlet />
      </div>
    </div>
  )
}
