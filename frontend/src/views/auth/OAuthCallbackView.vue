<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

const route = useRoute()
const { t } = useI18n()
const status = ref(t('auth.oauthCompleting'))
let resultListener: ((event: MessageEvent<unknown>) => void) | null = null
let closeTimer: ReturnType<typeof window.setTimeout> | null = null

function stopResultListener(): void {
  if (!resultListener) return
  window.removeEventListener('message', resultListener)
  resultListener = null
}

function scheduleClose(delay: number): void {
  if (closeTimer !== null) window.clearTimeout(closeTimer)
  closeTimer = window.setTimeout(() => {
    closeTimer = null
    window.close()
  }, delay)
}

onMounted(() => {
  const provider = String(route.params.provider || '')
  const query = route.query
  const state = typeof query.state === 'string' ? query.state : ''
  const opener = window.opener
  if (!provider || !state || !opener || opener.closed) {
    status.value = t('auth.oauthUnavailable')
    return
  }

  opener.postMessage(
    {
      type: 'ren2hub:oauth-bind-callback',
      provider,
      state,
      code: typeof query.code === 'string' ? query.code : undefined,
      error: typeof query.error === 'string' ? query.error : undefined,
      error_description:
        typeof query.error_description === 'string'
          ? query.error_description
          : undefined,
    },
    window.location.origin
  )

  resultListener = (event: MessageEvent<unknown>) => {
    if (event.origin !== window.location.origin || event.source !== opener)
      return
    const result = event.data as {
      type?: string
      provider?: string
      state?: string
      success?: boolean
      message?: string
    } | null
    if (
      !result ||
      result.type !== 'ren2hub:oauth-bind-result' ||
      result.provider !== provider ||
      result.state !== state
    )
      return
    stopResultListener()
    status.value = result.success
      ? t('auth.oauthLinked')
      : result.message || t('auth.oauthFailed')
    scheduleClose(result.success ? 250 : 1500)
  }
  window.addEventListener('message', resultListener)
  scheduleClose(15_000)
})

onBeforeUnmount(() => {
  stopResultListener()
  if (closeTimer !== null) window.clearTimeout(closeTimer)
})
</script>

<template>
  <main class="oauth-callback">
    <p>{{ status }}</p>
  </main>
</template>

<style scoped>
.oauth-callback {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 2rem;
  color: var(--text-primary, #111827);
  background: var(--surface-page, #f8fafc);
  font:
    500 0.95rem/1.5 system-ui,
    sans-serif;
}
</style>
