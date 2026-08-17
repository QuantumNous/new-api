import { ref } from 'vue'
import { defineStore } from 'pinia'

import { api } from '@/api/console'
import type { TicketQueueSummary } from '@/types/console'

import { useAuthStore } from './auth'

const REFRESH_INTERVAL_MS = 60_000

export const useTicketQueueStore = defineStore('ticket-queue', () => {
  const summary = ref<TicketQueueSummary>({
    pending: 0,
    unassigned: 0,
    mine: 0,
  })
  let timer = 0
  let consumers = 0
  let refreshing: Promise<void> | null = null

  async function refresh(): Promise<void> {
    const auth = useAuthStore()
    if (!auth.hasPermission('ticket', 'read')) {
      summary.value = { pending: 0, unassigned: 0, mine: 0 }
      return
    }
    if (refreshing) return refreshing
    refreshing = api
      .get<TicketQueueSummary>('/api/next/admin/tickets/summary')
      .then((value) => {
        summary.value = value
      })
      .catch((error: unknown) => {
        console.error('Failed to refresh ticket queue summary', error)
      })
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  function onFocus(): void {
    void refresh()
  }

  function start(): void {
    consumers += 1
    if (consumers > 1) return
    void refresh()
    timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
    window.addEventListener('focus', onFocus)
  }

  function stop(): void {
    consumers = Math.max(0, consumers - 1)
    if (consumers > 0) return
    window.clearInterval(timer)
    timer = 0
    window.removeEventListener('focus', onFocus)
  }

  return { summary, refresh, start, stop }
})
