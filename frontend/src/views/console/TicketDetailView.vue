<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import type { TicketItem, TicketMessage } from '@/types/console'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageBreadcrumb from '@/components/console/PageBreadcrumb.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TicketReplyBox from '@/components/console/tickets/TicketReplyBox.vue'
import TicketThreadMessage from '@/components/console/tickets/TicketThreadMessage.vue'
import TicketImageLightbox from '@/components/console/tickets/TicketImageLightbox.vue'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useFeatureAccess } from '@/composables/useFeatureAccess'
import { useToast } from '@/composables/useToast'
import { ticketStatusTone } from '@/constants/console'
import { formatTime } from '@/utils/format'

type TicketMeta = Omit<TicketItem, 'messages'>

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { readOnly } = useFeatureAccess('tickets', 'prototype')

const ticket = ref<TicketMeta | null>(null)
const messages = ref<TicketMessage[]>([])
const loading = ref(true)
const notFound = ref(false)
const loadFailed = ref(false)
const submitting = ref(false)
const confirmClose = ref(false)
const lightbox = ref({ open: false, url: '' })
const detailRequest = useLatestRequest()
// Mutations (reply / status change) have their own guard so a route change
// mid-flight can't apply a reply to the wrong ticket.
let mutationSequence = 0

const ticketId = computed(() => Number(route.params.id))

async function load(id = ticketId.value) {
  mutationSequence += 1
  ticket.value = null
  messages.value = []
  submitting.value = false
  confirmClose.value = false
  if (!Number.isSafeInteger(id) || id <= 0) {
    loading.value = false
    notFound.value = true
    return
  }

  loading.value = true
  notFound.value = false
  loadFailed.value = false
  const result = await detailRequest.run((signal) =>
    api.get<{
      ticket: TicketMeta
      messages: TicketMessage[]
    }>(`/api/ticket/${id}`, undefined, { signal })
  )
  if (result.stale) return
  loading.value = false
  if (!result.ok) {
    if (result.error instanceof ApiError && result.error.business) {
      notFound.value = true
    } else {
      loadFailed.value = true
      toast.error(
        result.error instanceof ApiError
          ? result.error.message
          : String(result.error)
      )
    }
    return
  }
  ticket.value = result.value.ticket
  messages.value = result.value.messages
}

async function sendReply(payload: { content: string; images: string[] }) {
  if (readOnly.value || !ticket.value || submitting.value) return
  const id = ticket.value.id
  const sequence = ++mutationSequence
  submitting.value = true
  try {
    const data = await api.post<{ message: TicketMessage }>(
      `/api/ticket/${id}/reply`,
      payload
    )
    if (sequence !== mutationSequence || ticket.value?.id !== id) return
    messages.value.push(data.message)
    ticket.value.status = 'open'
    ticket.value.reply_count = messages.value.length
    ticket.value.updated = data.message.created
    toast.success(t('tickets.replied'))
  } catch (error) {
    if (sequence === mutationSequence) {
      toast.error(error instanceof ApiError ? error.message : String(error))
    }
  } finally {
    if (sequence === mutationSequence) submitting.value = false
  }
}

async function changeStatus(next: 'open' | 'closed') {
  if (readOnly.value || !ticket.value || submitting.value) return
  const id = ticket.value.id
  const sequence = ++mutationSequence
  submitting.value = true
  try {
    const data = await api.put<{ ticket: TicketMeta }>(
      `/api/ticket/${id}/status`,
      { status: next }
    )
    if (sequence !== mutationSequence || ticket.value?.id !== id) return
    ticket.value = data.ticket
    toast.success(
      next === 'closed' ? t('tickets.closed') : t('tickets.reopened')
    )
    // Refresh the thread to pick up the system note the backend appended.
    await load(id)
  } catch (error) {
    if (sequence === mutationSequence) {
      toast.error(error instanceof ApiError ? error.message : String(error))
    }
  } finally {
    if (sequence === mutationSequence) {
      submitting.value = false
      confirmClose.value = false
    }
  }
}

function openLightbox(url: string) {
  lightbox.value = { open: true, url }
}

watch(ticketId, (id) => void load(id), { immediate: true })
</script>

<template>
  <div>
    <PageBreadcrumb
      :crumbs="[
        t('tickets.detailBreadcrumb.0'),
        t('tickets.detailBreadcrumb.1'),
        t('tickets.detailBreadcrumb.2'),
      ]"
    />

    <button
      type="button"
      class="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-text)]"
      @click="router.push({ name: 'tickets' })"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {{ t('tickets.detail.backToList') }}
    </button>

    <!-- loading -->
    <div v-if="loading" class="space-y-4">
      <div class="sketch-lg h-28 animate-pulse bg-[var(--surface-muted)]" />
      <div class="sketch-lg h-48 animate-pulse bg-[var(--surface-muted)]" />
    </div>

    <!-- load failure -->
    <ConsoleCard v-else-if="loadFailed">
      <div class="flex flex-col items-center py-12 text-center">
        <p class="text-[var(--text-secondary)]">{{ t('common.failed') }}</p>
        <ConsoleButton class="mt-4" variant="secondary" @click="load()">
          {{ t('common.retry') }}
        </ConsoleButton>
      </div>
    </ConsoleCard>

    <!-- not found -->
    <ConsoleCard v-else-if="notFound || !ticket">
      <div class="flex flex-col items-center py-12 text-center">
        <p class="text-[var(--text-secondary)]">{{ t('tickets.notFound') }}</p>
        <ConsoleButton
          class="mt-4"
          variant="secondary"
          @click="router.push({ name: 'tickets' })"
        >
          {{ t('tickets.detail.backToList') }}
        </ConsoleButton>
      </div>
    </ConsoleCard>

    <template v-else>
      <!-- header -->
      <ConsoleCard class="mb-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="mb-2 flex flex-wrap items-center gap-2">
              <span
                class="display-number font-mono text-xs text-[var(--text-tertiary)]"
              >
                #TK-{{ String(ticket.id).padStart(4, '0') }}
              </span>
              <StatusChip :tone="ticketStatusTone[ticket.status]">
                {{ t(`tickets.status.${ticket.status}`) }}
              </StatusChip>
              <StatusChip tone="neutral">{{
                t(`tickets.priority.${ticket.priority}`)
              }}</StatusChip>
              <StatusChip tone="neutral">{{
                t(`tickets.category.${ticket.category}`)
              }}</StatusChip>
            </div>
            <h1
              class="display-title text-2xl font-bold text-[var(--text-primary)]"
            >
              {{ ticket.title }}
            </h1>
            <div
              class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-tertiary)]"
            >
              <span
                >{{ t('tickets.detail.metaCreated') }}
                {{ formatTime(ticket.created) }}</span
              >
              <span
                >{{ t('tickets.detail.metaUpdated') }}
                {{ formatTime(ticket.updated) }}</span
              >
              <span v-if="ticket.model_id" class="font-mono"
                >Model: {{ ticket.model_id }}</span
              >
              <span v-if="ticket.request_id" class="font-mono"
                >Request: {{ ticket.request_id }}</span
              >
            </div>
          </div>
          <ConsoleButton
            v-if="ticket.status !== 'closed'"
            variant="secondary"
            size="sm"
            :loading="submitting"
            :disabled="readOnly"
            @click="confirmClose = true"
          >
            {{ t('tickets.closeTicket') }}
          </ConsoleButton>
          <ConsoleButton
            v-else
            variant="secondary"
            size="sm"
            :loading="submitting"
            :disabled="readOnly"
            @click="changeStatus('open')"
          >
            {{ t('tickets.reopenTicket') }}
          </ConsoleButton>
        </div>
      </ConsoleCard>

      <!-- thread -->
      <ConsoleCard class="mb-5">
        <div class="space-y-5">
          <TicketThreadMessage
            v-for="msg in messages"
            :key="msg.id"
            :message="msg"
            @image-click="openLightbox"
          />
        </div>
      </ConsoleCard>

      <!-- reply / closed banner -->
      <ConsoleCard v-if="ticket.status !== 'closed'">
        <TicketReplyBox
          :submitting="submitting"
          :readonly="readOnly"
          @submit="sendReply"
        />
      </ConsoleCard>
      <ConsoleCard v-else>
        <div class="flex flex-col items-start gap-1">
          <p class="display-title font-semibold text-[var(--text-primary)]">
            {{ t('tickets.detail.closedBanner') }}
          </p>
          <p class="text-sm text-[var(--text-secondary)]">
            {{ t('tickets.detail.closedHint') }}
          </p>
        </div>
      </ConsoleCard>
    </template>

    <ConfirmDialog
      :open="confirmClose"
      :title="t('tickets.detail.confirmCloseTitle')"
      :message="t('tickets.detail.confirmCloseMessage')"
      :confirm-text="t('tickets.closeTicket')"
      :loading="submitting"
      @confirm="changeStatus('closed')"
      @cancel="confirmClose = false"
    />

    <TicketImageLightbox
      :open="lightbox.open"
      :url="lightbox.url"
      @close="lightbox.open = false"
    />
  </div>
</template>
