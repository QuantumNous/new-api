<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { formatQuota } from '@/utils/format'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const initial = computed(() =>
  (auth.user?.display_name || auth.user?.username || 'U')
    .slice(0, 1)
    .toUpperCase()
)

async function logout() {
  await auth.logout()
  open.value = false
  toast.info(t('common.logout'))
  router.push({ name: 'sign-in' })
}

function goto(routeName: string) {
  open.value = false
  router.push({ name: routeName })
}

function gotoRedeem() {
  open.value = false
  router.push({ name: 'wallet', query: { panel: 'redeem' } })
}

function onClickOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-shadow hover:ring-2 hover:ring-[var(--border-strong)] focus-ring"
      style="background: var(--accent-soft); color: var(--accent-text)"
      :aria-label="t('nav.profile')"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      {{ initial }}
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-12 z-40 w-56 overflow-hidden rounded-2xl border border-[var(--overlay-border)] bg-[var(--surface-overlay)] py-1.5 shadow-[var(--overlay-shadow)] animate-scale-in"
      data-handdrawn="menu"
    >
      <button
        type="button"
        class="flex w-full items-center justify-between rounded-lg px-4 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-muted)]"
        data-user-menu-item
        @click="goto('wallet')"
      >
        <span class="text-[var(--text-secondary)]">{{ t('nav.balance') }}</span>
        <span class="font-semibold text-[var(--text-primary)]">
          {{ formatQuota(auth.user?.quota ?? 0) }}
        </span>
      </button>
      <button
        type="button"
        class="block w-full rounded-lg px-4 py-2 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]"
        data-user-menu-item
        @click="goto('profile')"
      >
        {{ t('nav.profile') }}
      </button>
      <button
        type="button"
        class="block w-full rounded-lg px-4 py-2 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]"
        data-user-menu-item
        @click="goto('invite')"
      >
        {{ t('nav.rebate') }}
      </button>
      <button
        type="button"
        class="flex w-full items-center justify-between rounded-lg px-4 py-2 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]"
        data-user-menu-item
        @click="gotoRedeem"
      >
        {{ t('nav.redeem') }}
      </button>
      <div class="mx-3 my-1 h-px bg-[var(--border-subtle)]" />
      <button
        type="button"
        class="block w-full rounded-lg px-4 py-2 text-left text-sm transition-colors hover:bg-[var(--status-danger-soft)]"
        style="color: var(--status-danger-text)"
        data-user-menu-item
        @click="logout"
      >
        {{ t('common.logout') }}
      </button>
    </div>
  </div>
</template>
