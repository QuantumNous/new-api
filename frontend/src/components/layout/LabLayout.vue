<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { RouterView } from 'vue-router'
import { useI18n } from 'vue-i18n'

import ConsoleTopbar from '@/components/console/ConsoleTopbar.vue'
import LabNavStrip from '@/components/lab/LabNavStrip.vue'
import LabSidebar from '@/components/lab/LabSidebar.vue'
import '@/styles/console.css'

const { t } = useI18n()

const privateMode = useStorage<boolean>('ren2hub_lab_private', false)
const soundEnabled = useStorage<boolean>('ren2hub_lab_sound', true)
</script>

<template>
  <div class="flex h-screen overflow-hidden" data-handdrawn-scope="lab">
    <LabSidebar />

    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <!-- original topbar, unchanged -->
      <ConsoleTopbar />
      <LabNavStrip />

      <!-- page content (relative for floating toolbar) -->
      <div
        class="night-page-texture draft-grid relative min-w-0 flex-1 overflow-hidden"
      >
        <!-- floating toolbar: private mode + sound -->
        <div class="absolute right-4 top-3 z-30 flex items-center gap-1.5">
          <button
            type="button"
            class="pencil-control flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors focus-ring"
            data-handdrawn="control"
            :style="
              privateMode
                ? 'background:var(--accent-soft);color:var(--accent-text)'
                : 'color:var(--text-tertiary)'
            "
            :class="
              privateMode
                ? ''
                : 'hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]'
            "
            :aria-pressed="privateMode"
            :title="t('lab.toolbar.privateHint')"
            @click="privateMode = !privateMode"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {{ t('lab.toolbar.private') }}
          </button>

          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-ring"
            :class="
              soundEnabled
                ? 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)]'
            "
            :aria-pressed="soundEnabled"
            :title="
              t(soundEnabled ? 'lab.toolbar.soundOn' : 'lab.toolbar.soundOff')
            "
            @click="soundEnabled = !soundEnabled"
          >
            <svg
              v-if="soundEnabled"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
            </svg>
            <svg
              v-else
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          </button>
        </div>
        <RouterView v-slot="{ Component }">
          <Transition name="lab-page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab-page-enter-active {
  transition: all 0.22s ease;
}
.lab-page-leave-active {
  transition: all 0.14s ease;
}
.lab-page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.lab-page-leave-to {
  opacity: 0;
}
</style>
