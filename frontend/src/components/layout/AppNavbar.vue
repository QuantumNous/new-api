<template>
  <header
    class="app-navbar fixed inset-x-0 top-0 z-[70] transition-all duration-300"
    data-hero-canvas-boundary
    :data-scrolled="scrolled"
    :class="
      scrolled
        ? 'border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] backdrop-blur-xl shadow-[0_12px_36px_var(--shadow-color)]'
        : 'border-b border-transparent bg-transparent md:pt-5'
    "
  >
    <nav
      class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6 md:h-14 lg:px-8"
      :aria-label="t('nav.navigation')"
    >
      <div class="flex min-w-0 items-center gap-2.5 sm:gap-4">
        <RouterLink
          :to="{ name: 'home' }"
          class="home-brand flex min-h-11 min-w-11 items-center justify-center gap-2.5 transition-transform hover:scale-[1.02] sm:justify-start"
          :aria-label="`${systemName} ${t('nav.home')}`"
        >
          <img
            :src="logo"
            :alt="systemName"
            class="h-8 w-8 rounded-lg object-contain"
          />
          <span
            class="max-[359px]:hidden max-w-44 truncate whitespace-nowrap text-lg font-bold tracking-tight text-[var(--text-primary)]"
            >{{ systemName }}</span
          >
        </RouterLink>
        <span
          class="hidden h-5 w-px bg-[var(--border-subtle)] lg:block"
          aria-hidden="true"
        />
        <NotificationBadge />
      </div>

      <div class="flex shrink-0 items-center gap-2.5 md:gap-2">
        <span
          class="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-[var(--text-secondary)] md:inline-flex"
          :title="statusLabel"
        >
          <StatusDot />
          <span>{{ t('nav.status') }}</span>
        </span>
        <a
          v-if="showDocs"
          :href="docsLink"
          target="_blank"
          rel="noopener noreferrer"
          class="hidden rounded-full px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] md:inline-flex"
        >
          {{ t('nav.docs') }}
        </a>
        <RouterLink
          v-if="showPricing"
          :to="{ name: 'models' }"
          class="hidden rounded-full px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] md:inline-flex"
        >
          {{ t('nav.pricing') }}
        </RouterLink>
        <LanguageSelector />
        <ThemeSwitcher class="hidden md:block" />
        <RouterLink
          :to="isAuthenticated ? { name: 'dashboard' } : { name: 'sign-in' }"
          class="home-nav-cta inline-flex h-11 w-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--accent)] px-0 text-sm font-semibold text-[var(--accent-contrast)] transition-all hover:bg-[var(--accent-hover)] hover:shadow-[var(--button-shadow-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] min-[420px]:w-auto min-[420px]:px-3 md:h-auto md:w-auto md:px-4 md:py-1.5"
          :aria-label="isAuthenticated ? t('nav.console') : t('nav.login')"
        >
          <span class="sr-only min-[420px]:not-sr-only">{{
            isAuthenticated ? t('nav.console') : t('nav.login')
          }}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M4.5 5.5h15v13h-15zM8.5 10l3 2.5-3 2.5M13 15h3" />
          </svg>
        </RouterLink>
        <button
          ref="menuButton"
          type="button"
          class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] md:hidden"
          data-hero-canvas-boundary
          :aria-expanded="mobileMenuOpen"
          aria-controls="mobile-navigation-drawer"
          :aria-label="mobileMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <svg
            v-if="!mobileMenuOpen"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <svg
            v-else
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
          <span class="sr-only">{{
            mobileMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')
          }}</span>
        </button>
      </div>
    </nav>
    <MobileNavDrawer :open="mobileMenuOpen" @close="closeMobileMenu" />
  </header>
</template>

<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useScrolled } from '@/composables/useScrolled'
import NotificationBadge from './NotificationBadge.vue'
// Mobile-only, fully v-if="open"-gated: kept out of the entry chunk so it loads
// on first menu tap instead of gating the initial mount.
const MobileNavDrawer = defineAsyncComponent(
  () => import('./MobileNavDrawer.vue')
)
import LanguageSelector from '@/components/common/LanguageSelector.vue'
import StatusDot from '@/components/common/StatusDot.vue'
import ThemeSwitcher from '@/components/common/ThemeSwitcher.vue'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const appStore = useAppStore()
const { systemName, logo, docsLink, showDocs, showPricing, phase } =
  storeToRefs(appStore)
const { isAuthenticated } = storeToRefs(useAuthStore())
const { scrolled } = useScrolled(20)
const mobileMenuOpen = ref(false)
const menuButton = ref<HTMLButtonElement | null>(null)

const statusLabel = computed(() => {
  if (phase.value === 'ready') return t('nav.operational')
  if (phase.value === 'degraded') return t('nav.degraded')
  if (phase.value === 'error') return t('nav.unavailable')
  return t('nav.checking')
})

let scrollPosition = 0
let savedBodyStyles: Record<string, string> | null = null
let savedHtmlOverflow = ''

function lockPageScroll() {
  if (savedBodyStyles) return

  const body = document.body
  scrollPosition = window.scrollY
  savedBodyStyles = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
  }
  savedHtmlOverflow = document.documentElement.style.overflow

  body.style.position = 'fixed'
  body.style.top = `-${scrollPosition}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.width = '100%'
  body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
}

function unlockPageScroll() {
  if (!savedBodyStyles) return

  const body = document.body
  Object.assign(body.style, savedBodyStyles)
  document.documentElement.style.overflow = savedHtmlOverflow
  savedBodyStyles = null
  window.scrollTo(0, scrollPosition)
}

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

function closeAtDesktopWidth() {
  if (window.innerWidth >= 768) closeMobileMenu()
}

watch(mobileMenuOpen, (isOpen) => {
  if (isOpen) {
    lockPageScroll()
    return
  }

  unlockPageScroll()
  requestAnimationFrame(() => menuButton.value?.focus())
})

onMounted(() => {
  window.addEventListener('resize', closeAtDesktopWidth, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', closeAtDesktopWidth)
  unlockPageScroll()
})
</script>

<style scoped>
@media (max-width: 767px) {
  .app-navbar {
    padding-top: env(safe-area-inset-top);
  }
}
</style>
