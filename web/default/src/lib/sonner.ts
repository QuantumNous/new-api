/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com

---

Deduplication wrapper for sonner toasts.

Automatically prevents duplicate toast messages from appearing simultaneously.
Any call site that calls `toast.success('some message')` while another toast
with the exact same message is already visible will be silently skipped.
*/
import {
  toast as originalToast,
  Toaster,
  useSonner,
} from 'sonner'
import type {
  Action,
  ExternalToast,
  ToastClassnames,
  ToastT,
  ToastToDismiss,
  ToasterProps,
} from 'sonner'

// ── Dedup helpers ──────────────────────────────────────────────────────────

/** Check whether a toast with the same title is already visible. */
function hasDuplicate(title: unknown): boolean {
  if (typeof title !== 'string' || !title) return false
  return originalToast
    .getToasts()
    .some((t) => 'title' in t && (t as ToastT).title === title)
}

/** Return a wrapper that deduplicates by message content. */
function dedup<F extends (...args: any[]) => string | number | undefined>(
  fn: F,
): (...args: Parameters<F>) => ReturnType<F> | undefined {
  return ((...args: Parameters<F>) => {
    const [message] = args
    if (hasDuplicate(message)) return undefined
    return fn(...args)
  }) as (...args: Parameters<F>) => ReturnType<F> | undefined
}

// ── Dedup-aware toast ──────────────────────────────────────────────────────

/** Default toast function with deduplication. */
function toast(message: string, options?: ExternalToast): string | number | undefined
function toast(message: string, options?: ExternalToast) {
  if (hasDuplicate(message)) return
  return originalToast(message, options)
}

// Attach dedup-aware methods (and pass-through for non-message ones).
toast.success = dedup(originalToast.success.bind(originalToast))
toast.error = dedup(originalToast.error.bind(originalToast))
toast.info = dedup(originalToast.info.bind(originalToast))
toast.warning = dedup(originalToast.warning.bind(originalToast))
toast.loading = dedup(originalToast.loading.bind(originalToast))
toast.message = dedup(originalToast.message.bind(originalToast))

// Methods that don't need dedup.
toast.dismiss = originalToast.dismiss.bind(originalToast)
toast.getToasts = originalToast.getToasts.bind(originalToast)
toast.getHistory = originalToast.getHistory.bind(originalToast)
toast.promise = originalToast.promise.bind(originalToast)
toast.custom = originalToast.custom.bind(originalToast)

// ── Re-exports ─────────────────────────────────────────────────────────────

export { Toaster, toast, useSonner }
export type {
  Action,
  ExternalToast,
  ToastClassnames,
  ToastT,
  ToastToDismiss,
  ToasterProps,
}
