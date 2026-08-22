<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ siteKey: string }>()
const emit = defineEmits<{
  verified: [token: string]
  unavailable: []
}>()

const { t } = useI18n()
const container = ref<HTMLElement | null>(null)
const unavailable = ref(false)
let widgetId: string | null = null
let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-ren2hub-turnstile]'
    )
    const script = existing ?? document.createElement('script')
    const onLoad = () =>
      window.turnstile ? resolve() : reject(new Error('Turnstile unavailable'))
    const onError = () => reject(new Error('Turnstile failed to load'))

    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
    if (!existing) {
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.dataset.ren2hubTurnstile = 'true'
      document.head.append(script)
    }
  })
  return scriptPromise
}

async function render() {
  if (!props.siteKey || widgetId || unavailable.value) return
  await nextTick()
  if (!container.value) return
  try {
    await loadScript()
    if (!window.turnstile || !container.value)
      throw new Error('Turnstile unavailable')
    widgetId = window.turnstile.render(container.value, {
      sitekey: props.siteKey,
      theme: document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light',
      callback: (token) => emit('verified', token),
      'expired-callback': () => emit('verified', ''),
      'error-callback': () => {
        emit('verified', '')
        unavailable.value = true
        emit('unavailable')
      },
    })
  } catch {
    unavailable.value = true
    emit('unavailable')
  }
}

function reset() {
  if (widgetId) window.turnstile?.reset(widgetId)
  emit('verified', '')
}

function remove() {
  if (widgetId) window.turnstile?.remove(widgetId)
  widgetId = null
}

watch(
  () => props.siteKey,
  () => {
    remove()
    unavailable.value = false
    void render()
  },
  { immediate: true }
)

onBeforeUnmount(remove)
defineExpose({ reset })
</script>

<template>
  <div class="space-y-2">
    <div ref="container" aria-label="Turnstile verification" />
    <p v-if="unavailable" class="text-xs text-[var(--status-danger-text)]">
      {{ t('common.turnstileUnavailable') }}
    </p>
  </div>
</template>
