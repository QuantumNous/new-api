<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const open = ref(false)

function toggle() {
  open.value = !open.value
}

function selectOption(option: ContactOption) {
  if (!option.href) {
    option.action?.()
  }

  open.value = false
}

interface ContactOption {
  key: string
  label: string
  href?: string
  bg: string
  fg: string
  action?: () => void
}

const options = computed<ContactOption[]>(() => [
  {
    key: 'telegram',
    label: 'Telegram',
    href: 'https://t.me/ren2hub',
    bg: '#229ED9',
    fg: '#ffffff',
  },
  {
    key: 'qq',
    label: t('contact.qqGroup'),
    href: 'https://qm.qq.com/ren2hub',
    bg: 'var(--surface-overlay)',
    fg: '#1AACEF',
  },
  {
    key: 'chat',
    label: t('contact.aiSupport'),
    bg: 'var(--signal-strong)',
    fg: '#ffffff',
  },
])
</script>

<template>
  <!-- Backdrop: click outside to close -->
  <div
    v-if="open"
    class="fixed inset-0 z-40"
    aria-hidden="true"
    @click="open = false"
  />

  <div
    class="contact-float-ball fixed bottom-7 right-7 z-50 flex flex-col items-center gap-3"
  >
    <!-- Contact options — animate in above the main button -->
    <Transition name="fab-stack">
      <div v-if="open" class="flex flex-col items-center gap-3">
        <div
          v-for="(opt, i) in options"
          :key="opt.key"
          class="fab-option group relative flex items-center"
          :style="{ '--delay': `${(options.length - 1 - i) * 55}ms` }"
        >
          <!-- Tooltip label (appears to the left on hover) -->
          <span
            class="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold opacity-0 shadow-[var(--card-shadow)] transition-opacity duration-150 group-hover:opacity-100"
            style="
              background: var(--surface-overlay);
              color: var(--text-primary);
            "
          >
            {{ opt.label }}
          </span>

          <!-- Option button -->
          <component
            :is="opt.href ? 'a' : 'button'"
            v-bind="
              opt.href
                ? {
                    href: opt.href,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  }
                : { type: 'button' }
            "
            class="flex h-12 w-12 items-center justify-center rounded-full shadow-[var(--card-shadow)] outline-none ring-2 ring-transparent transition-transform duration-150 hover:scale-110 focus-visible:ring-[var(--accent)]"
            :style="{
              background: opt.bg,
              color: opt.fg,
              border: opt.bg.startsWith('var')
                ? '1px solid var(--border-subtle)'
                : 'none',
            }"
            :aria-label="opt.label"
            @click="selectOption(opt)"
          >
            <!-- Telegram icon -->
            <svg
              v-if="opt.key === 'telegram'"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="m22 2-7 20-4-9-9-4 20-7z" />
              <path d="M22 2 11 13" />
            </svg>

            <!-- QQ icon (simplified penguin) -->
            <svg
              v-else-if="opt.key === 'qq'"
              width="22"
              height="22"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <!-- body/head -->
              <ellipse cx="24" cy="22" rx="13" ry="15" fill="#1AACEF" />
              <!-- belly -->
              <ellipse cx="24" cy="26" rx="8" ry="9" fill="#fff" />
              <!-- left eye white -->
              <ellipse cx="18.5" cy="18" rx="3.5" ry="4" fill="#fff" />
              <!-- right eye white -->
              <ellipse cx="29.5" cy="18" rx="3.5" ry="4" fill="#fff" />
              <!-- left pupil -->
              <circle cx="19.5" cy="19" r="2" fill="#111" />
              <!-- right pupil -->
              <circle cx="30.5" cy="19" r="2" fill="#111" />
              <!-- beak -->
              <path
                d="M21 25.5 q3 3 6 0"
                stroke="#F90"
                stroke-width="2.5"
                fill="none"
                stroke-linecap="round"
              />
              <!-- left foot -->
              <ellipse
                cx="17"
                cy="38"
                rx="5"
                ry="2.5"
                fill="#F90"
                transform="rotate(-15 17 38)"
              />
              <!-- right foot -->
              <ellipse
                cx="31"
                cy="38"
                rx="5"
                ry="2.5"
                fill="#F90"
                transform="rotate(15 31 38)"
              />
            </svg>

            <!-- Chat / customer service icon -->
            <svg
              v-else-if="opt.key === 'chat'"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              />
            </svg>
          </component>
        </div>
      </div>
    </Transition>

    <!-- Main FAB trigger button -->
    <button
      type="button"
      class="flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_24px_var(--shadow-color)] outline-none ring-2 ring-transparent transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:ring-[var(--accent)]"
      style="background: var(--accent); color: var(--accent-contrast)"
      :aria-label="open ? t('contact.close') : t('contact.open')"
      :aria-expanded="open"
      @click="toggle"
    >
      <!-- Headset icon → Close icon via CSS rotation -->
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="transition-transform duration-300"
        :class="open ? 'rotate-[135deg]' : 'rotate-0'"
      >
        <!-- Headset when closed -->
        <template v-if="!open">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
          <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
        </template>
        <!-- Plus/close when open (rotated 135° → ×) -->
        <template v-else>
          <path d="M12 5v14M5 12h14" />
        </template>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.contact-float-ball {
  width: max-content;
}

@media (max-width: 480px) {
  /* Keep the dashboard's recent-call rows readable on narrow screens. The
     control remains available at the end of the page instead of covering data. */
  .contact-float-ball {
    position: static;
    margin: 1rem 0 0 auto;
  }
}

/* Stack enters from below, exits downward */
.fab-stack-enter-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.fab-stack-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}
.fab-stack-enter-from,
.fab-stack-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.92);
}

/* Per-option staggered entrance */
.fab-option {
  animation: fab-rise 0.22s ease both;
  animation-delay: var(--delay, 0ms);
}
@keyframes fab-rise {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.88);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
