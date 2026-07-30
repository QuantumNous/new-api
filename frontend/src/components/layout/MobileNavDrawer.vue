<template>
  <Teleport to="body">
    <Transition name="mobile-nav-drawer">
      <div
        v-if="open"
        id="mobile-navigation-drawer"
        class="mobile-nav-drawer fixed inset-0 z-[80] flex justify-end"
        data-hero-canvas-boundary
        data-handdrawn-scope="mobile-navigation"
        @keydown="onKeydown"
      >
        <button
          type="button"
          class="mobile-nav-drawer__backdrop absolute inset-0 cursor-default backdrop-blur-sm"
          style="background: var(--drawer-backdrop)"
          data-hero-canvas-boundary
          tabindex="-1"
          :aria-label="t('nav.closeMenu')"
          @click="close"
        />

        <aside
          ref="panel"
          class="mobile-nav-drawer__panel relative flex h-full w-[min(86vw,22rem)] flex-col border-l border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] shadow-[var(--overlay-shadow)] backdrop-blur-2xl"
          data-hero-canvas-boundary
          data-handdrawn="navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-navigation-title"
          tabindex="-1"
        >
          <div class="flex items-center justify-between gap-4">
            <div>
              <p
                class="max-w-48 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]"
              >
                {{ systemName }}
              </p>
              <h2
                id="mobile-navigation-title"
                class="mt-1 text-lg font-semibold text-[var(--text-primary)]"
              >
                {{ t('nav.menuTitle') }}
              </h2>
            </div>
            <button
              ref="closeButton"
              type="button"
              class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              :aria-label="t('nav.closeMenu')"
              @click="close"
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <nav class="mt-10" :aria-label="t('nav.navigation')">
            <ul class="space-y-2">
              <li v-for="item in showcaseAnchors" :key="item.href">
                <a
                  :href="item.href"
                  class="group flex min-h-14 items-center gap-3 rounded-2xl px-4 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                  @click="close"
                >
                  <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--accent)]"
                  >
                    <component
                      :is="item.icon"
                      :size="17"
                      :stroke-width="1.8"
                      aria-hidden="true"
                    />
                  </span>
                  <span class="text-sm font-semibold">{{
                    t(item.labelKey)
                  }}</span>
                  <svg
                    class="ml-auto text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </a>
              </li>
              <li>
                <div
                  class="flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 text-[var(--text-secondary)]"
                >
                  <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
                    :style="{
                      borderColor: statusSoft,
                      background: statusSoft,
                    }"
                  >
                    <StatusDot />
                  </span>
                  <span class="min-w-0">
                    <span class="block text-sm font-semibold">{{
                      t('nav.status')
                    }}</span>
                    <span
                      class="mt-0.5 block truncate text-xs text-[var(--text-tertiary)]"
                      >{{ statusLabel }}</span
                    >
                  </span>
                </div>
              </li>
              <li v-if="showDocs">
                <a
                  :href="docsLink"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="group flex min-h-14 items-center gap-3 rounded-2xl px-4 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                  @click="close"
                >
                  <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-tertiary)]"
                  >
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      aria-hidden="true"
                    >
                      <path d="M6.5 3.5h8l3 3v14h-11z" />
                      <path d="M14.5 3.5v4h4M8.5 12h6M8.5 15.5h6" />
                    </svg>
                  </span>
                  <span class="text-sm font-semibold">{{ t('nav.docs') }}</span>
                  <svg
                    class="ml-auto text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </a>
              </li>
              <li v-if="showPricing">
                <RouterLink
                  :to="{ name: 'models' }"
                  class="group flex min-h-14 items-center gap-3 rounded-2xl px-4 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                  @click="close"
                >
                  <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-tertiary)]"
                  >
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      aria-hidden="true"
                    >
                      <path
                        d="M4.5 7.5h15M7.5 3.5v4M16.5 3.5v4M6.5 11.5h4M13.5 11.5h4M6.5 15.5h4M13.5 15.5h4M5.5 5.5h13a1 1 0 011 1v12a1 1 0 01-1 1h-13a1 1 0 01-1-1v-12a1 1 0 011-1z"
                      />
                    </svg>
                  </span>
                  <span class="text-sm font-semibold">{{
                    t('nav.pricing')
                  }}</span>
                  <svg
                    class="ml-auto text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </RouterLink>
              </li>
            </ul>
          </nav>

          <div class="mt-auto border-t border-[var(--border-subtle)] pt-5">
            <ThemeSwitcher mobile />
            <p
              class="mt-4 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--text-tertiary)]"
            >
              Gateway / {{ statusCodeLabel }}
            </p>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Network, ShieldCheck, Sparkles } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import StatusDot from '@/components/common/StatusDot.vue'
import ThemeSwitcher from '@/components/common/ThemeSwitcher.vue'
import { useAppStore } from '@/stores'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const { systemName, docsLink, showDocs, showPricing, phase } =
  storeToRefs(useAppStore())
const panel = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)

const statusLabel = computed(() => {
  if (phase.value === 'ready') return t('nav.operational')
  if (phase.value === 'degraded') return t('nav.degraded')
  if (phase.value === 'error') return t('nav.unavailable')
  return t('nav.checking')
})
const statusSoft = computed(() => {
  if (phase.value === 'ready') return 'var(--status-success-soft)'
  if (phase.value === 'degraded') return 'var(--status-warning-soft)'
  if (phase.value === 'error') return 'var(--status-danger-soft)'
  return 'var(--surface-muted)'
})
const statusCodeLabel = computed(() => {
  if (phase.value === 'ready') return t('nav.telemetry.ready')
  if (phase.value === 'degraded') return t('nav.telemetry.degraded')
  if (phase.value === 'error') return t('nav.telemetry.unavailable')
  return t('nav.telemetry.checking')
})

const showcaseAnchors = [
  {
    href: '#market-route',
    labelKey: 'nav.marketRoute',
    icon: Network,
  },
  {
    href: '#activities',
    labelKey: 'nav.activities',
    icon: Sparkles,
  },
  {
    href: '#assurance',
    labelKey: 'nav.assurance',
    icon: ShieldCheck,
  },
] as const

function close() {
  emit('close')
}

function getFocusableElements(): HTMLElement[] {
  const panelElement = panel.value
  if (!panelElement) return []

  return Array.from(
    panelElement.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(
    (element) =>
      !element.hasAttribute('disabled') && element.getClientRects().length > 0
  )
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }

  if (event.key !== 'Tab') return

  const focusable = getFocusableElements()
  if (!focusable.length) {
    event.preventDefault()
    panel.value?.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const current = document.activeElement

  if (
    event.shiftKey &&
    (current === first || !panel.value?.contains(current))
  ) {
    event.preventDefault()
    last.focus()
  } else if (
    !event.shiftKey &&
    (current === last || !panel.value?.contains(current))
  ) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    nextTick(() => closeButton.value?.focus())
  },
  { immediate: true }
)
</script>

<style scoped>
.mobile-nav-drawer-enter-active .mobile-nav-drawer__backdrop,
.mobile-nav-drawer-leave-active .mobile-nav-drawer__backdrop {
  transition: opacity 220ms ease;
}

.mobile-nav-drawer-enter-active .mobile-nav-drawer__panel,
.mobile-nav-drawer-leave-active .mobile-nav-drawer__panel {
  transition: transform 300ms cubic-bezier(0.22, 0.72, 0.25, 1);
}

.mobile-nav-drawer-enter-from .mobile-nav-drawer__backdrop,
.mobile-nav-drawer-leave-to .mobile-nav-drawer__backdrop {
  opacity: 0;
}

.mobile-nav-drawer-enter-from .mobile-nav-drawer__panel,
.mobile-nav-drawer-leave-to .mobile-nav-drawer__panel {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .mobile-nav-drawer-enter-active .mobile-nav-drawer__backdrop,
  .mobile-nav-drawer-leave-active .mobile-nav-drawer__backdrop,
  .mobile-nav-drawer-enter-active .mobile-nav-drawer__panel,
  .mobile-nav-drawer-leave-active .mobile-nav-drawer__panel {
    transition-duration: 1ms;
  }
}
</style>
