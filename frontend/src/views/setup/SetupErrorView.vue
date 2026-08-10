<script setup lang="ts">
import { computed, ref } from 'vue'
import { AlertTriangle, RefreshCw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import BrandMark from '@/components/console/BrandMark.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import LanguageSelector from '@/components/common/LanguageSelector.vue'
import ThemeSwitcher from '@/components/common/ThemeSwitcher.vue'
import { BRAND_NAME } from '@/constants/branding'
import { useSetupStore } from '@/stores/setup'
import { sanitizeSetupRedirect } from '@/router'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const setup = useSetupStore()
const retrying = ref(false)
const redirect = computed(() => sanitizeSetupRedirect(route.query.redirect))

async function retry() {
  if (retrying.value) return
  retrying.value = true
  try {
    const status = await setup.retry()
    if (status.status) {
      await router.replace(redirect.value || { name: 'home' })
    } else {
      await router.replace({ name: 'setup' })
    }
  } catch {
    // Keep the global error page visible and actionable.
  } finally {
    retrying.value = false
  }
}
</script>

<template>
  <main
    class="setup-shell texture-paper draft-grid night-page-texture min-h-screen bg-[var(--page-background)] px-5 py-6 text-[var(--text-primary)] sm:px-8"
  >
    <header
      class="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4"
      data-handdrawn="navigation-top"
    >
      <div class="flex min-w-0 items-center gap-3">
        <!-- Local brand asset: the status endpoint is unreachable on this page. -->
        <BrandMark class="h-9 w-9 sketch-sm" />
        <span
          class="display-title truncate text-lg font-bold tracking-tight text-[var(--text-primary)]"
          >{{ BRAND_NAME }}</span
        >
      </div>
      <div class="flex items-center gap-2">
        <ThemeSwitcher variant="console" />
        <LanguageSelector variant="console" />
      </div>
    </header>
    <section
      class="mx-auto flex min-h-[calc(100svh-7rem)] w-full max-w-xl items-center justify-center py-12 text-center"
    >
      <div class="w-full">
        <div
          class="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--status-danger)] bg-[var(--status-danger-soft)] text-[var(--status-danger-text)]"
        >
          <AlertTriangle :size="28" aria-hidden="true" />
        </div>
        <p
          class="mt-5 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[var(--status-danger-text)]"
        >
          {{ t('setup.errorLabel') }}
        </p>
        <h1 class="display-title mt-3 text-3xl font-bold sm:text-4xl">
          {{ t('setup.errorTitle') }}
        </h1>
        <p
          class="mx-auto mt-4 max-w-md text-sm leading-6 text-[var(--text-secondary)]"
        >
          {{ t('setup.errorDescription') }}
        </p>
        <ConsoleButton
          class="mt-8"
          size="lg"
          :loading="retrying"
          @click="retry"
        >
          <RefreshCw :size="17" aria-hidden="true" />
          {{ t('setup.retry') }}
        </ConsoleButton>
      </div>
    </section>
  </main>
</template>
