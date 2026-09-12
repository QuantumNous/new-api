import { createFileRoute } from '@tanstack/solid-router'
import { fetchInvoiceById } from '../posts'

export const Route = createFileRoute('/_auth/invoices/$invoiceId')({
  loader: async ({ params: { invoiceId } }) => {
    return {
      invoice: await fetchInvoiceById(Number.parseInt(invoiceId)),
    }
  },
  component: InvoicePage,
})

function InvoicePage() {
  const loaderData = Route.useLoaderData()

  return (
    <section class="grid gap-2">
      <h2 class="text-lg">
        <strong>Invoice No.</strong> #
        {loaderData().invoice.id.toString().padStart(2, '0')}
      </h2>
      <p>
        <strong>Invoice title:</strong> {loaderData().invoice.title}
      </p>
      <p>
        <strong>Invoice body:</strong> {loaderData().invoice.body}
      </p>
    </section>
  )
}
