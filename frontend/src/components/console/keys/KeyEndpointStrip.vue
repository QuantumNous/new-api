<script setup lang="ts">
import { onBeforeUnmount, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/composables/useToast'

import { runEndpointProbe } from './endpointProbe'

type ProbeStatus = 'idle' | 'testing' | 'success' | 'timeout' | 'error'

interface ProbeResult {
  status: ProbeStatus
  latency?: number
}

const ENDPOINTS = [
  {
    id: 'default',
    labelKey: 'keys.endpoints.defaultName',
    url: 'https://renai.uno',
    isDefault: true,
  },
  {
    id: 'usWest',
    labelKey: 'keys.endpoints.usWestName',
    url: 'https://vm.renai.uno',
    isDefault: false,
  },
  {
    id: 'cloudflare',
    labelKey: 'keys.endpoints.cloudflareName',
    url: 'https://cf.renai.uno',
    isDefault: false,
  },
  {
    id: 'asiaPacific',
    labelKey: 'keys.endpoints.asiaPacificName',
    url: 'https://cn.renai.uno',
    isDefault: false,
  },
] as const

const PROBE_TIMEOUT_MS = 5_000

const { t } = useI18n()
const toast = useToast()
const results = reactive<Record<string, ProbeResult>>(
  Object.fromEntries(
    ENDPOINTS.map((endpoint) => [endpoint.id, { status: 'idle' }])
  )
)
const controllers = new Map<string, AbortController>()
const timers = new Map<string, number>()

async function copyEndpoint(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.success(t('keys.endpoints.copied'))
  } catch {
    toast.error(t('common.copyFailed'))
  }
}

async function probeEndpoint(id: string, url: string) {
  if (results[id]?.status === 'testing') return

  const controller = new AbortController()
  let timedOut = false
  controllers.set(id, controller)
  results[id] = { status: 'testing' }
  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, PROBE_TIMEOUT_MS)
  timers.set(id, timer)

  try {
    const latency = await runEndpointProbe(id, url, controller.signal)
    results[id] = {
      status: 'success',
      latency,
    }
  } catch {
    results[id] = { status: timedOut ? 'timeout' : 'error' }
  } finally {
    window.clearTimeout(timer)
    timers.delete(id)
    controllers.delete(id)
  }
}

function resultLabel(result: ProbeResult): string {
  switch (result.status) {
    case 'testing':
      return t('keys.endpoints.testing')
    case 'success':
      return t('keys.endpoints.latency', { ms: result.latency })
    case 'timeout':
      return t('keys.endpoints.timeout')
    case 'error':
      return t('keys.endpoints.unreachable')
    default:
      return ''
  }
}

onBeforeUnmount(() => {
  for (const controller of controllers.values()) controller.abort()
  for (const timer of timers.values()) window.clearTimeout(timer)
  controllers.clear()
  timers.clear()
})
</script>

<template>
  <div
    class="grid min-w-0 grid-cols-1 gap-1 sm:flex sm:flex-wrap sm:justify-start lg:justify-end"
    :aria-label="t('keys.endpoints.regionLabel')"
  >
    <div
      v-for="endpoint in ENDPOINTS"
      :key="endpoint.id"
      class="flex min-w-0 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-2 py-1 sm:min-w-max sm:flex-none"
    >
      <span class="shrink-0 text-[11px] font-medium text-[var(--text-primary)]">
        {{ t(endpoint.labelKey) }}
      </span>
      <span
        v-if="endpoint.isDefault"
        class="shrink-0 rounded bg-[var(--status-success-soft)] px-1 py-px text-[9px] font-medium text-[var(--status-success-text)]"
      >
        {{ t('keys.endpoints.defaultBadge') }}
      </span>
      <span
        class="h-4 w-px shrink-0 bg-[var(--border-subtle)]"
        aria-hidden="true"
      />
      <code
        class="min-w-0 max-w-28 truncate text-[11px] text-[var(--text-secondary)]"
        :title="endpoint.url"
      >
        {{ endpoint.url }}
      </code>
      <span
        v-if="results[endpoint.id].status !== 'idle'"
        class="shrink-0 text-[10px] font-medium"
        :class="
          results[endpoint.id].status === 'success'
            ? 'text-[var(--status-success-text)]'
            : results[endpoint.id].status === 'testing'
              ? 'text-[var(--accent-text)]'
              : 'text-[var(--status-danger-text)]'
        "
        aria-live="polite"
      >
        {{ resultLabel(results[endpoint.id]) }}
      </span>
      <button
        type="button"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-ring sm:h-5 sm:w-5"
        :aria-label="t('keys.endpoints.copy', { name: t(endpoint.labelKey) })"
        :title="t('keys.endpoints.copy', { name: t(endpoint.labelKey) })"
        @click="copyEndpoint(endpoint.url)"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
      <button
        type="button"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded text-[var(--text-tertiary)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)] focus-ring disabled:cursor-wait disabled:opacity-50 sm:h-5 sm:w-5"
        :disabled="results[endpoint.id].status === 'testing'"
        :aria-label="t('keys.endpoints.test', { name: t(endpoint.labelKey) })"
        :title="t('keys.endpoints.test', { name: t(endpoint.labelKey) })"
        @click="probeEndpoint(endpoint.id, endpoint.url)"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m13 2-9 12h8l-1 8 9-12h-8l1-8Z" />
        </svg>
      </button>
    </div>
  </div>
</template>
