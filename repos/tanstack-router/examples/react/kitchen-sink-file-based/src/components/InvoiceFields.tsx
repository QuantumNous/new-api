/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import * as React from 'react'
import type { Invoice } from '../utils/mockTodos'

export function InvoiceFields({
  invoice,
  disabled,
}: {
  invoice: Invoice
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <h2 className="font-bold text-lg">
        <input
          name="title"
          defaultValue={invoice?.title}
          placeholder="Invoice Title"
          className="border border-opacity-50 rounded-sm p-2 w-full"
          disabled={disabled}
        />
      </h2>
      <div>
        <textarea
          name="body"
          defaultValue={invoice?.body}
          rows={6}
          placeholder="Invoice Body..."
          className="border border-opacity-50 p-2 rounded-sm w-full"
          disabled={disabled}
        />
      </div>
    </div>
  )
}
