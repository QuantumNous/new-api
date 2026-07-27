<script setup lang="ts">
import { defineComponent, onErrorCaptured, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const hasError = ref(false)
const retryKey = ref(0)
const RENDER_ERROR_SOURCES = new Set([
  'setup function',
  'render function',
  'async component loader',
  'scheduler flush',
])

const ResetHost = defineComponent({
  name: 'AppErrorBoundaryResetHost',
  setup(_, { slots }) {
    return () => slots.default?.()
  },
})

onErrorCaptured((error, _instance, info) => {
  if (!RENDER_ERROR_SOURCES.has(info)) return

  console.error('[AppErrorBoundary] Unhandled rendering error', error, info)
  hasError.value = true
  return false
})

function retry() {
  retryKey.value += 1
  hasError.value = false
}
</script>

<template>
  <ResetHost v-if="!hasError" :key="retryKey">
    <slot />
  </ResetHost>

  <main
    v-else
    class="texture-paper draft-grid flex min-h-screen items-center justify-center bg-[var(--page-background)] px-5 py-12 text-center"
    role="alert"
    aria-live="assertive"
    data-handdrawn-scope="error"
  >
    <div class="w-full max-w-lg">
      <p
        class="font-mono text-xs font-semibold uppercase text-[var(--status-danger-text)]"
      >
        {{ t('common.appError.label') }}
      </p>
      <h1
        class="gesture-mark display-title mt-3 text-3xl font-bold text-[var(--text-primary)] sm:text-4xl"
      >
        {{ t('common.appError.title') }}
      </h1>
      <p class="mx-auto mt-3 max-w-md text-sm text-[var(--text-secondary)]">
        {{ t('common.appError.message') }}
      </p>

      <div class="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          class="pencil-control sketch-sm h-10 bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] focus-ring"
          data-handdrawn="control"
          data-error-retry
          @click="retry"
        >
          {{ t('common.appError.retry') }}
        </button>
        <a
          href="/"
          class="pencil-control sketch-sm inline-flex h-10 items-center justify-center border border-[var(--border-default)] bg-[var(--surface-solid)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] focus-ring"
          data-handdrawn="control"
        >
          {{ t('common.appError.home') }}
        </a>
      </div>
    </div>
  </main>
</template>
