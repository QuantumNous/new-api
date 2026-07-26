import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import type { InvoiceItem } from '@/types/console'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useToast } from '@/composables/useToast'

export interface InvoiceForm {
  title: string
  tax_id: string
  amount: string
  email: string
  note: string
}

export function useInvoice() {
  const { t } = useI18n()
  const toast = useToast()

  const invoices = ref<InvoiceItem[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(10)
  const loading = ref(false)
  const submitting = ref(false)
  const listRequest = useLatestRequest()

  async function loadInvoices() {
    loading.value = true
    const result = await listRequest.run((signal) =>
      api.get<{ items: InvoiceItem[]; total: number }>(
        '/api/invoice/self',
        { page: page.value, page_size: pageSize.value },
        { signal }
      )
    )
    if (result.stale) return
    loading.value = false
    if (!result.ok) {
      toast.error(
        result.error instanceof ApiError
          ? result.error.message
          : String(result.error)
      )
      return
    }
    invoices.value = result.value.items
    total.value = result.value.total
  }

  async function submitApplication(form: InvoiceForm): Promise<boolean> {
    const titleTrimmed = form.title.trim()
    const amount = parseFloat(form.amount)
    const email = form.email.trim()

    if (!titleTrimmed) {
      toast.error(t('invoice.titleRequired'))
      return false
    }
    if (!form.amount || isNaN(amount) || amount < 200) {
      toast.error(t('invoice.amountMin'))
      return false
    }
    // The receipt email is optional, but a filled value must be well-formed.
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error(t('invoice.emailInvalid'))
      return false
    }

    submitting.value = true
    try {
      await api.post('/api/invoice/apply', {
        title: titleTrimmed,
        tax_id: form.tax_id.trim(),
        amount,
        email,
        note: form.note.trim(),
      })
      toast.success(t('invoice.submitted'))
      // Refresh list to show the new record
      page.value = 1
      await loadInvoices()
      return true
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : String(error))
      return false
    } finally {
      submitting.value = false
    }
  }

  function goToPage(p: number) {
    page.value = p
    void loadInvoices()
  }

  return {
    invoices,
    total,
    page,
    pageSize,
    loading,
    submitting,
    loadInvoices,
    submitApplication,
    goToPage,
  }
}
