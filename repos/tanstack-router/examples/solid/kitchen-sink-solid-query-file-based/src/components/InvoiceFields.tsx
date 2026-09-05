import type { Invoice } from '../utils/mockTodos'

export function InvoiceFields({
  invoice,
  disabled,
}: {
  invoice?: Invoice
  disabled?: boolean
}) {
  return (
    <div class="space-y-2">
      <h2 class="font-bold text-lg">
        <input
          name="title"
          value={invoice?.title ?? ''}
          placeholder="Invoice Title"
          class="border border-opacity-50 rounded-sm p-2 w-full"
          disabled={disabled}
        />
      </h2>
      <div>
        <textarea
          name="body"
          value={invoice?.body ?? ''}
          rows={6}
          placeholder="Invoice Body..."
          class="border border-opacity-50 p-2 rounded-sm w-full"
          disabled={disabled}
        />
      </div>
    </div>
  )
}
