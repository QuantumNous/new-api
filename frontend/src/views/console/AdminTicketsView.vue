<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, RefreshCw, UserRoundCheck } from 'lucide-vue-next'

import { api } from '@/api/console'
import { ApiError, type PageResult } from '@/api/types'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import FilterSelect from '@/components/common/FilterSelect.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TicketImageLightbox from '@/components/console/tickets/TicketImageLightbox.vue'
import TicketReplyBox from '@/components/console/tickets/TicketReplyBox.vue'
import TicketThreadMessage from '@/components/console/tickets/TicketThreadMessage.vue'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useToast } from '@/composables/useToast'
import { ticketStatusTone } from '@/constants/console'
import { useAuthStore } from '@/stores/auth'
import { useTicketQueueStore } from '@/stores/ticketQueue'
import type {
  AdminTicketItem,
  TicketAgent,
  TicketMessage,
  TicketStatus,
} from '@/types/console'
import { formatTime, relativeTime } from '@/utils/format'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const ticketQueue = useTicketQueueStore()
const queueRequest = useLatestRequest()
const detailRequest = useLatestRequest()

const canReply = computed(() => auth.hasPermission('ticket', 'reply'))
const canManage = computed(() => auth.hasPermission('ticket', 'manage'))
const selectedID = computed(() => {
  const value = Number(route.params.id)
  return Number.isSafeInteger(value) && value > 0 ? value : 0
})

const tickets = ref<AdminTicketItem[]>([])
const total = ref(0)
const page = ref(Number(route.query.page) || 1)
const pageSize = 20
const queueLoading = ref(true)
const queueFailed = ref(false)
const detailLoading = ref(false)
const detailFailed = ref(false)
const ticket = ref<AdminTicketItem | null>(null)
const messages = ref<TicketMessage[]>([])
const agents = ref<TicketAgent[]>([])
const agentsLoading = ref(false)
const mutating = ref(false)
const replyBox = ref<InstanceType<typeof TicketReplyBox> | null>(null)
const lightbox = ref({ open: false, url: '' })

const keyword = ref(
  typeof route.query.keyword === 'string' ? route.query.keyword : ''
)
const status = ref(
  typeof route.query.status === 'string' ? route.query.status : 'open'
)
const category = ref(
  typeof route.query.category === 'string' ? route.query.category : ''
)
const priority = ref(
  typeof route.query.priority === 'string' ? route.query.priority : ''
)
const assignee = ref(
  typeof route.query.assignee === 'string' ? route.query.assignee : ''
)
const assignmentValue = ref('')

const statusTabs = computed(() => [
  { value: 'open', label: t('tickets.admin.queueOpen') },
  { value: 'replied', label: t('tickets.status.replied') },
  { value: 'closed', label: t('tickets.status.closed') },
  { value: '', label: t('common.all') },
])
const categoryOptions = computed(() => [
  { value: '', label: t('common.all') },
  ...(['billing', 'api', 'model', 'account', 'other'] as const).map(
    (value) => ({
      value,
      label: t(`tickets.category.${value}`),
    })
  ),
])
const priorityOptions = computed(() => [
  { value: '', label: t('common.all') },
  ...(['low', 'normal', 'high'] as const).map((value) => ({
    value,
    label: t(`tickets.priority.${value}`),
  })),
])
const assigneeOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'unassigned', label: t('tickets.admin.unassigned') },
  { value: 'mine', label: t('tickets.admin.mine') },
  ...agents.value.map((agent) => ({
    value: String(agent.id),
    label: agent.display_name || agent.username,
  })),
])
const assignmentOptions = computed(() => [
  { value: '', label: t('tickets.admin.unassigned') },
  ...agents.value.map((agent) => ({
    value: String(agent.id),
    label: agent.display_name || agent.username,
  })),
])
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

function routeQuery(): Record<string, string> {
  const query: Record<string, string> = {}
  if (keyword.value.trim()) query.keyword = keyword.value.trim()
  if (status.value) query.status = status.value
  if (category.value) query.category = category.value
  if (priority.value) query.priority = priority.value
  if (assignee.value) query.assignee = assignee.value
  if (page.value > 1) query.page = String(page.value)
  return query
}

function syncRoute(id = selectedID.value): void {
  void router.replace({
    name: 'ticket-management',
    params: { id: id > 0 ? String(id) : '' },
    query: routeQuery(),
  })
}

async function loadQueue(): Promise<void> {
  queueLoading.value = true
  queueFailed.value = false
  const result = await queueRequest.run((signal) =>
    api.get<PageResult<AdminTicketItem>>(
      '/api/next/admin/tickets',
      {
        page: page.value,
        page_size: pageSize,
        keyword: keyword.value.trim(),
        status: status.value,
        category: category.value,
        priority: priority.value,
        assignee: assignee.value,
      },
      { signal }
    )
  )
  if (result.stale) return
  queueLoading.value = false
  if (!result.ok) {
    queueFailed.value = true
    toast.error(
      result.error instanceof ApiError
        ? result.error.message
        : String(result.error)
    )
    return
  }
  tickets.value = result.value.items
  total.value = result.value.total
}

async function loadDetail(id: number): Promise<void> {
  if (!id) {
    ticket.value = null
    messages.value = []
    detailFailed.value = false
    return
  }
  detailLoading.value = true
  detailFailed.value = false
  const result = await detailRequest.run((signal) =>
    api.get<{ ticket: AdminTicketItem; messages: TicketMessage[] }>(
      `/api/next/admin/tickets/${id}`,
      undefined,
      { signal }
    )
  )
  if (result.stale) return
  detailLoading.value = false
  if (!result.ok) {
    detailFailed.value = true
    toast.error(
      result.error instanceof ApiError
        ? result.error.message
        : String(result.error)
    )
    return
  }
  ticket.value = result.value.ticket
  messages.value = result.value.messages
  assignmentValue.value = result.value.ticket.assignee_id
    ? String(result.value.ticket.assignee_id)
    : ''
}

async function loadAgents(): Promise<void> {
  if (!canManage.value) return
  agentsLoading.value = true
  try {
    const data = await api.get<{ items: TicketAgent[] }>(
      '/api/next/admin/tickets/agents'
    )
    agents.value = data.items
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    agentsLoading.value = false
  }
}

function selectTicket(id: number): void {
  void router.push({
    name: 'ticket-management',
    params: { id: String(id) },
    query: routeQuery(),
  })
}

function showQueue(): void {
  void router.push({
    name: 'ticket-management',
    params: { id: '' },
    query: routeQuery(),
  })
}

async function refreshAfterMutation(reloadDetail = false): Promise<void> {
  await Promise.all([loadQueue(), ticketQueue.refresh()])
  if (reloadDetail && selectedID.value) await loadDetail(selectedID.value)
}

async function sendReply(payload: { content: string; attachments: File[] }) {
  if (!ticket.value || !canReply.value || mutating.value) return
  const id = ticket.value.id
  mutating.value = true
  try {
    const body = new FormData()
    body.set('content', payload.content)
    for (const file of payload.attachments) body.append('attachments', file)
    const data = await api.post<{
      message: TicketMessage
      ticket: {
        status: TicketStatus
        assignee_id: number | null
        assigned_at: number
        updated: number
      }
    }>(`/api/next/admin/tickets/${id}/messages`, body)
    if (ticket.value?.id !== id) return
    messages.value.push(data.message)
    ticket.value.status = data.ticket.status
    ticket.value.assignee_id = data.ticket.assignee_id
    ticket.value.assigned_at = data.ticket.assigned_at
    ticket.value.updated = data.ticket.updated
    ticket.value.message_count = messages.value.length
    ticket.value.reply_count = messages.value.length
    if (data.ticket.assignee_id === auth.user?.id) {
      ticket.value.assignee_name = auth.user.username
      assignmentValue.value = String(auth.user.id)
    }
    replyBox.value?.reset()
    toast.success(t('tickets.replied'))
    await refreshAfterMutation()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    mutating.value = false
  }
}

async function changeStatus(next: 'open' | 'closed'): Promise<void> {
  if (!ticket.value || !canManage.value || mutating.value) return
  const id = ticket.value.id
  mutating.value = true
  try {
    const data = await api.patch<{
      ticket: { id: number; status: TicketStatus; updated: number }
    }>(`/api/next/admin/tickets/${id}/status`, { status: next })
    if (ticket.value?.id !== id) return
    ticket.value.status = data.ticket.status
    ticket.value.updated = data.ticket.updated
    toast.success(
      next === 'closed' ? t('tickets.closed') : t('tickets.reopened')
    )
    await refreshAfterMutation()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    mutating.value = false
  }
}

async function saveAssignment(value = assignmentValue.value): Promise<void> {
  if (!ticket.value || !canManage.value || mutating.value) return
  const id = ticket.value.id
  const nextID = value ? Number(value) : null
  mutating.value = true
  try {
    const data = await api.patch<{
      ticket: {
        id: number
        assignee_id: number | null
        assigned_at: number
        updated: number
      }
    }>(`/api/next/admin/tickets/${id}/assignee`, { assignee_id: nextID })
    if (ticket.value?.id !== id) return
    ticket.value.assignee_id = data.ticket.assignee_id
    ticket.value.assigned_at = data.ticket.assigned_at
    ticket.value.updated = data.ticket.updated
    assignmentValue.value = data.ticket.assignee_id
      ? String(data.ticket.assignee_id)
      : ''
    const agent = agents.value.find(
      (item) => item.id === data.ticket.assignee_id
    )
    ticket.value.assignee_name = agent?.display_name || agent?.username || ''
    toast.success(t('tickets.admin.assigneeSaved'))
    await refreshAfterMutation()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    mutating.value = false
  }
}

function takeTicket(): void {
  if (!auth.user?.id) return
  void saveAssignment(String(auth.user.id))
}

function openLightbox(url: string): void {
  lightbox.value = { open: true, url }
}

let searchTimer = 0
watch(keyword, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    page.value = 1
    syncRoute()
    void loadQueue()
  }, 300)
})
watch([status, category, priority, assignee], () => {
  page.value = 1
  syncRoute()
  void loadQueue()
})
watch(page, () => {
  syncRoute()
  void loadQueue()
})
watch(selectedID, (id) => void loadDetail(id), { immediate: true })

onMounted(() => {
  void loadQueue()
  void loadAgents()
})
onBeforeUnmount(() => window.clearTimeout(searchTimer))
</script>

<template>
  <div
    class="flex h-[calc(100dvh-11.75rem)] min-h-[560px] overflow-hidden border-y border-[var(--border-subtle)] bg-[var(--surface-solid)] lg:h-[calc(100dvh-8rem)]"
  >
    <aside
      class="min-w-0 flex-col border-r border-[var(--border-subtle)] lg:flex lg:w-[360px] lg:shrink-0"
      :class="selectedID ? 'hidden' : 'flex w-full'"
      :aria-label="t('tickets.admin.queue')"
    >
      <header class="border-b border-[var(--border-subtle)] px-4 py-3">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div>
            <h1
              class="display-title text-lg font-bold text-[var(--text-primary)]"
            >
              {{ t('tickets.admin.title') }}
            </h1>
            <p class="text-xs text-[var(--text-tertiary)]">
              {{ t('tickets.admin.queueSummary', ticketQueue.summary) }}
            </p>
          </div>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] focus-ring"
            :aria-label="t('common.refresh')"
            @click="loadQueue"
          >
            <RefreshCw :size="16" aria-hidden="true" />
          </button>
        </div>

        <div
          class="mb-3 grid grid-cols-4 gap-1 rounded-lg bg-[var(--surface-muted)] p-1"
        >
          <button
            v-for="tab in statusTabs"
            :key="tab.value"
            type="button"
            class="min-w-0 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-ring"
            :class="
              status === tab.value
                ? 'bg-[var(--surface-solid)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)]'
            "
            @click="status = tab.value"
          >
            <span class="block truncate">{{ tab.label }}</span>
          </button>
        </div>

        <SearchInput
          v-model="keyword"
          :placeholder="t('tickets.admin.searchPlaceholder')"
          :aria-label="t('tickets.admin.searchPlaceholder')"
          name="admin-ticket-search"
          class="mb-2 w-full"
        />
        <div class="grid grid-cols-3 gap-2">
          <FilterSelect
            v-model="category"
            :options="categoryOptions"
            :label="t('tickets.create.categoryLabel')"
            size="sm"
          />
          <FilterSelect
            v-model="priority"
            :options="priorityOptions"
            :label="t('tickets.create.priorityLabel')"
            size="sm"
          />
          <FilterSelect
            v-model="assignee"
            :options="assigneeOptions"
            :label="t('tickets.admin.assignee')"
            size="sm"
          />
        </div>
      </header>

      <div class="subtle-scroll min-h-0 flex-1 overflow-y-auto">
        <div v-if="queueLoading" class="space-y-1 p-2">
          <div
            v-for="index in 7"
            :key="index"
            class="h-24 animate-pulse rounded-md bg-[var(--surface-muted)]"
          />
        </div>
        <div
          v-else-if="queueFailed"
          class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
        >
          <p class="text-sm text-[var(--text-secondary)]">
            {{ t('tickets.listLoadFailed') }}
          </p>
          <ConsoleButton size="sm" variant="secondary" @click="loadQueue">
            {{ t('common.retry') }}
          </ConsoleButton>
        </div>
        <div
          v-else-if="tickets.length === 0"
          class="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--text-tertiary)]"
        >
          {{ t('tickets.admin.emptyQueue') }}
        </div>
        <template v-else>
          <button
            v-for="item in tickets"
            :key="item.id"
            type="button"
            class="w-full border-b border-[var(--border-subtle)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-muted)] focus-ring"
            :class="item.id === selectedID ? 'bg-[var(--accent-soft)]' : ''"
            @click="selectTicket(item.id)"
          >
            <div class="mb-1.5 flex items-start justify-between gap-3">
              <span
                class="min-w-0 truncate text-sm font-semibold text-[var(--text-primary)]"
              >
                {{ item.title }}
              </span>
              <StatusChip :tone="ticketStatusTone[item.status]">
                {{ t(`tickets.status.${item.status}`) }}
              </StatusChip>
            </div>
            <div
              class="mb-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]"
            >
              <span class="truncate">{{
                item.user.display_name || item.user.username
              }}</span>
              <span aria-hidden="true">·</span>
              <span>{{ t(`tickets.category.${item.category}`) }}</span>
              <span aria-hidden="true">·</span>
              <span>{{ t(`tickets.priority.${item.priority}`) }}</span>
            </div>
            <div
              class="flex items-center justify-between gap-2 text-xs text-[var(--text-tertiary)]"
            >
              <span class="truncate">
                {{ item.assignee_name || t('tickets.admin.unassigned') }}
              </span>
              <time>{{ relativeTime(item.updated, locale) }}</time>
            </div>
          </button>
        </template>
      </div>

      <footer
        v-if="total > pageSize"
        class="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-2 text-xs text-[var(--text-secondary)]"
      >
        <button
          type="button"
          class="px-2 py-1 disabled:opacity-40"
          :disabled="page <= 1"
          @click="page -= 1"
        >
          {{ t('common.prevPage') }}
        </button>
        <span>{{ page }} / {{ pageCount }}</span>
        <button
          type="button"
          class="px-2 py-1 disabled:opacity-40"
          :disabled="page >= pageCount"
          @click="page += 1"
        >
          {{ t('common.nextPage') }}
        </button>
      </footer>
    </aside>

    <section
      class="min-w-0 flex-1 flex-col lg:flex"
      :class="selectedID ? 'flex' : 'hidden'"
      :aria-label="t('tickets.admin.workspace')"
    >
      <div
        v-if="!selectedID"
        class="hidden h-full items-center justify-center text-sm text-[var(--text-tertiary)] lg:flex"
      >
        {{ t('tickets.admin.selectHint') }}
      </div>
      <div
        v-else-if="detailLoading"
        class="flex h-full items-center justify-center text-sm text-[var(--text-tertiary)]"
      >
        {{ t('common.loading') }}
      </div>
      <div
        v-else-if="detailFailed || !ticket"
        class="flex h-full flex-col items-center justify-center gap-3"
      >
        <p class="text-sm text-[var(--text-secondary)]">
          {{ t('common.failed') }}
        </p>
        <ConsoleButton
          size="sm"
          variant="secondary"
          @click="loadDetail(selectedID)"
        >
          {{ t('common.retry') }}
        </ConsoleButton>
      </div>
      <div v-else class="flex min-h-0 flex-1 flex-col">
        <header
          class="border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5"
        >
          <div class="flex items-start gap-3">
            <button
              type="button"
              class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] focus-ring lg:hidden"
              :aria-label="t('tickets.detail.backToList')"
              @click="showQueue"
            >
              <ArrowLeft :size="17" aria-hidden="true" />
            </button>
            <div class="min-w-0 flex-1">
              <div class="mb-1 flex flex-wrap items-center gap-2">
                <span class="font-mono text-xs text-[var(--text-tertiary)]"
                  >#TK-{{ ticket.id }}</span
                >
                <StatusChip :tone="ticketStatusTone[ticket.status]">
                  {{ t(`tickets.status.${ticket.status}`) }}
                </StatusChip>
              </div>
              <h2
                class="display-title truncate text-lg font-bold text-[var(--text-primary)]"
              >
                {{ ticket.title }}
              </h2>
            </div>
          </div>
        </header>

        <div class="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div class="flex min-h-0 flex-col">
            <div
              class="subtle-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6"
            >
              <TicketThreadMessage
                v-for="message in messages"
                :key="message.id"
                :message="message"
                viewer="support"
                @image-click="openLightbox"
              />
            </div>
            <div class="border-t border-[var(--border-subtle)] p-4 sm:px-6">
              <TicketReplyBox
                v-if="ticket.status !== 'closed'"
                ref="replyBox"
                :submitting="mutating"
                :readonly="!canReply"
                @submit="sendReply"
              />
              <p v-else class="text-sm text-[var(--text-secondary)]">
                {{ t('tickets.detail.closedHint') }}
              </p>
            </div>
          </div>

          <aside
            class="subtle-scroll overflow-y-auto border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 lg:border-l lg:border-t-0"
          >
            <section class="border-b border-[var(--border-subtle)] pb-4">
              <h3
                class="mb-3 text-xs font-semibold uppercase text-[var(--text-tertiary)]"
              >
                {{ t('tickets.admin.requester') }}
              </h3>
              <p class="font-medium text-[var(--text-primary)]">
                {{ ticket.user.display_name || ticket.user.username }}
              </p>
              <p class="mt-1 break-all text-xs text-[var(--text-secondary)]">
                {{ ticket.user.email || '-' }}
              </p>
            </section>

            <section class="border-b border-[var(--border-subtle)] py-4">
              <div class="mb-2 flex items-center justify-between gap-2">
                <h3
                  class="text-xs font-semibold uppercase text-[var(--text-tertiary)]"
                >
                  {{ t('tickets.admin.assignee') }}
                </h3>
                <button
                  v-if="canManage && ticket.assignee_id !== auth.user?.id"
                  type="button"
                  class="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-text)] hover:underline"
                  @click="takeTicket"
                >
                  <UserRoundCheck :size="14" aria-hidden="true" />
                  {{ t('tickets.admin.take') }}
                </button>
              </div>
              <FilterSelect
                v-model="assignmentValue"
                :options="assignmentOptions"
                :label="t('tickets.admin.assignee')"
                :disabled="agentsLoading || !canManage"
                size="sm"
              />
              <ConsoleButton
                v-if="canManage"
                class="mt-2"
                size="sm"
                variant="secondary"
                block
                :loading="mutating"
                @click="saveAssignment()"
              >
                {{ t('common.save') }}
              </ConsoleButton>
            </section>

            <section
              class="border-b border-[var(--border-subtle)] py-4 text-sm"
            >
              <h3
                class="mb-3 text-xs font-semibold uppercase text-[var(--text-tertiary)]"
              >
                {{ t('tickets.admin.details') }}
              </h3>
              <dl class="space-y-2">
                <div class="flex justify-between gap-3">
                  <dt class="text-[var(--text-tertiary)]">
                    {{ t('tickets.create.categoryLabel') }}
                  </dt>
                  <dd class="text-[var(--text-primary)]">
                    {{ t(`tickets.category.${ticket.category}`) }}
                  </dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-[var(--text-tertiary)]">
                    {{ t('tickets.create.priorityLabel') }}
                  </dt>
                  <dd class="text-[var(--text-primary)]">
                    {{ t(`tickets.priority.${ticket.priority}`) }}
                  </dd>
                </div>
                <div v-if="ticket.model_id">
                  <dt class="text-xs text-[var(--text-tertiary)]">
                    {{ t('tickets.admin.modelId') }}
                  </dt>
                  <dd
                    class="mt-1 break-all font-mono text-xs text-[var(--text-primary)]"
                  >
                    {{ ticket.model_id }}
                  </dd>
                </div>
                <div v-if="ticket.request_id">
                  <dt class="text-xs text-[var(--text-tertiary)]">
                    {{ t('tickets.admin.requestId') }}
                  </dt>
                  <dd
                    class="mt-1 break-all font-mono text-xs text-[var(--text-primary)]"
                  >
                    {{ ticket.request_id }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-[var(--text-tertiary)]">
                    {{ t('tickets.colCreated') }}
                  </dt>
                  <dd class="mt-1 text-xs text-[var(--text-primary)]">
                    {{ formatTime(ticket.created) }}
                  </dd>
                </div>
              </dl>
            </section>

            <section v-if="canManage" class="pt-4">
              <ConsoleButton
                v-if="ticket.status !== 'closed'"
                variant="danger"
                size="sm"
                block
                :loading="mutating"
                @click="changeStatus('closed')"
              >
                {{ t('tickets.closeTicket') }}
              </ConsoleButton>
              <ConsoleButton
                v-else
                variant="secondary"
                size="sm"
                block
                :loading="mutating"
                @click="changeStatus('open')"
              >
                {{ t('tickets.reopenTicket') }}
              </ConsoleButton>
            </section>
          </aside>
        </div>
      </div>
    </section>

    <TicketImageLightbox
      :open="lightbox.open"
      :url="lightbox.url"
      @close="lightbox.open = false"
    />
  </div>
</template>
