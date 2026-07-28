<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import type { InvoiceItem } from '@/types/console'
import PageHero from '@/components/console/PageHero.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import FormField from '@/components/common/FormField.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import TextInput from '@/components/common/TextInput.vue'
import { useInvoice, type InvoiceForm } from '@/composables/useInvoice'
import { formatDate } from '@/utils/format'
import { safeExternalUrl } from '@/utils/safeUrl'

const { t } = useI18n()

const { invoices, total, page, pageSize, loading, loadInvoices, goToPage } =
  useInvoice()

const form = reactive<InvoiceForm>({
  title: '',
  tax_id: '',
  amount: '',
  email: '',
  note: '',
})

/** Map invoice status → StatusChip tone */
function statusTone(
  status: InvoiceItem['status']
): 'warning' | 'success' | 'danger' {
  if (status === 'issued') return 'success'
  if (status === 'rejected') return 'danger'
  return 'warning'
}

function downloadPDF(invoice: InvoiceItem) {
  if (invoice.status !== 'issued') return
  const url = safeExternalUrl(invoice.pdf_url)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

onMounted(() => {
  loadInvoices()
})
</script>

<template>
  <div>
    <PageHero
      :title="t('invoice.title')"
      :crumbs="[$t('invoice.breadcrumb.0'), $t('invoice.breadcrumb.1')]"
    >
      <p class="mt-1 text-sm text-[var(--text-tertiary)]">
        {{ t('invoice.bannerDesc') }}
      </p>
      <template #actions>
        <div
          id="invoice-contact-owner-note"
          role="note"
          class="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--status-info)] bg-[var(--status-info-soft)] px-4 text-sm font-semibold text-[var(--status-info-text)]"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"
            />
          </svg>
          {{ t('invoice.contactOwner') }}
        </div>
      </template>
    </PageHero>

    <!-- ── Main two-column layout ── -->
    <div class="grid gap-6 lg:grid-cols-5">
      <!-- ── Left: application form (3 / 5) ── -->
      <ConsoleCard :title="t('invoice.formTitle')" class="lg:col-span-3">
        <form class="space-y-5" @submit.prevent>
          <!-- 发票抬头 * -->
          <FormField :label="`${t('invoice.titleLabel')} *`">
            <TextInput
              v-model="form.title"
              :placeholder="t('invoice.titlePlaceholder')"
            >
              <template #icon>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </template>
            </TextInput>
          </FormField>

          <!-- 税号 + 开票金额 * (two columns) -->
          <div class="grid gap-4 sm:grid-cols-2">
            <FormField :label="t('invoice.taxIdLabel')">
              <TextInput
                v-model="form.tax_id"
                :placeholder="t('invoice.taxIdPlaceholder')"
              >
                <template #icon>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path
                      d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
                    />
                    <rect x="9" y="3" width="6" height="4" rx="1" />
                  </svg>
                </template>
              </TextInput>
            </FormField>
            <FormField :label="`${t('invoice.amountLabel')} *`">
              <TextInput
                v-model="form.amount"
                type="number"
                min="200"
                step="0.01"
                :placeholder="t('invoice.amountPlaceholder')"
              >
                <template #icon>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                    <line x1="12" y1="6" x2="12" y2="8" />
                    <line x1="12" y1="16" x2="12" y2="18" />
                  </svg>
                </template>
              </TextInput>
              <p class="mt-1.5 text-xs text-[var(--text-tertiary)]">
                {{ t('invoice.amountHint') }}
              </p>
            </FormField>
          </div>

          <!-- 接收邮箱 -->
          <FormField :label="t('invoice.emailLabel')">
            <TextInput
              v-model="form.email"
              type="email"
              :placeholder="t('invoice.emailPlaceholder')"
            >
              <template #icon>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </template>
            </TextInput>
          </FormField>

          <!-- 备注 -->
          <FormField :label="t('invoice.noteLabel')">
            <textarea
              v-model="form.note"
              rows="3"
              :placeholder="t('invoice.notePlaceholder')"
              class="w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none transition focus:border-[var(--border-strong)] focus-ring"
            />
          </FormField>

          <!-- Submit -->
          <ConsoleButton
            type="submit"
            size="lg"
            block
            disabled
            aria-describedby="invoice-contact-owner-note"
            :title="t('invoice.contactOwner')"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              class="shrink-0"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="m9 11 3 3L22 4" />
            </svg>
            {{ t('invoice.submit') }}
          </ConsoleButton>
        </form>
      </ConsoleCard>

      <!-- ── Right: invoice record list (2 / 5) ── -->
      <div class="lg:col-span-2">
        <ConsoleCard :padded="false">
          <template #action>
            <span class="text-sm font-semibold text-[var(--text-primary)]">
              {{ t('invoice.listTitle') }}
            </span>
          </template>

          <!-- Loading skeleton -->
          <div v-if="loading" class="space-y-3 p-5">
            <div
              v-for="i in 3"
              :key="i"
              class="h-16 animate-pulse rounded-xl bg-[var(--surface-muted)]"
            />
          </div>

          <!-- Empty state -->
          <EmptyState
            v-else-if="!invoices.length"
            :title="t('invoice.emptyTitle')"
            :hint="t('invoice.emptyHint')"
            illustration="empty-invoice"
          />

          <!-- Record rows -->
          <div v-else class="divide-y divide-[var(--border-subtle)]">
            <div
              v-for="inv in invoices"
              :key="inv.id"
              class="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-[var(--surface-muted)]"
            >
              <!-- Title + status -->
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p
                    class="truncate text-sm font-medium text-[var(--text-primary)]"
                  >
                    {{ inv.title }}
                  </p>
                  <p class="mt-0.5 text-xs text-[var(--text-tertiary)]">
                    {{ formatDate(inv.created) }}
                  </p>
                </div>
                <StatusChip
                  :tone="statusTone(inv.status)"
                  class="mt-0.5 shrink-0"
                >
                  {{ t(`invoice.status.${inv.status}`) }}
                </StatusChip>
              </div>

              <!-- Amount + action -->
              <div class="flex items-center justify-between gap-2">
                <span
                  class="text-sm font-semibold tabular-nums text-[var(--text-primary)]"
                >
                  ¥{{
                    inv.amount.toLocaleString('zh-CN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  }}
                </span>
                <!-- Rejection reason (truncated, full text on hover) -->
                <span
                  v-if="inv.status === 'rejected' && inv.reject_reason"
                  class="max-w-[160px] truncate text-xs"
                  style="color: var(--status-danger-text)"
                  :title="inv.reject_reason"
                >
                  {{ inv.reject_reason }}
                </span>
                <!-- PDF download -->
                <button
                  v-if="inv.status === 'issued'"
                  type="button"
                  class="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-solid)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus-ring"
                  @click="downloadPDF(inv)"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {{ t('invoice.download') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div
            v-if="total > pageSize"
            class="border-t border-[var(--border-subtle)]"
          >
            <TablePagination
              :page="page"
              :page-size="pageSize"
              :total="total"
              @update:page="goToPage"
            />
          </div>
        </ConsoleCard>
      </div>
    </div>
  </div>
</template>
