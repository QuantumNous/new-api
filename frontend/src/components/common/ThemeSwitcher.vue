<template>
  <div
    v-if="props.mobile"
    class="theme-switcher-mobile"
    data-hero-canvas-boundary
  >
    <p class="theme-switcher-mobile__label">{{ t('nav.theme') }}</p>
    <div
      class="theme-switcher-mobile__segments"
      role="radiogroup"
      :aria-label="t('nav.theme')"
    >
      <button
        v-for="option in themeOptions"
        :key="option.value"
        type="button"
        role="radio"
        class="theme-switcher-mobile__option"
        :class="
          option.value === preference
            ? 'theme-switcher-mobile__option--selected'
            : ''
        "
        :aria-checked="option.value === preference"
        @click="choose(option.value)"
      >
        {{ t(option.labelKey) }}
      </button>
    </div>
  </div>

  <button
    v-else-if="variant === 'console'"
    type="button"
    class="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
    :aria-label="t('nav.themeDescription', { mode: currentLabel })"
    :title="currentLabel"
    @click="cycleCompact"
  >
    <svg
      v-if="preference === 'auto'"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18V3Z" fill="currentColor" stroke="none" />
    </svg>
    <svg
      v-else-if="preference === 'light'"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
      />
    </svg>
    <svg
      v-else
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
    </svg>
  </button>

  <div
    v-else
    ref="root"
    class="theme-switcher relative"
    data-hero-canvas-boundary
  >
    <button
      ref="trigger"
      type="button"
      class="theme-switcher__trigger"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-controls="menuId"
      :aria-label="t('nav.themeDescription', { mode: currentLabel })"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <svg
        v-if="preference === 'auto'"
        class="theme-switcher__icon"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <rect x="4" y="4" width="16" height="13" rx="2.5" />
        <path
          d="M8.5 20h7M12 17v3M9.5 10a2.5 2.5 0 0 1 5 0c0 1.6-1.2 1.8-1.2 3M12 14.8h.01"
        />
      </svg>
      <svg
        v-else-if="preference === 'light'"
        class="theme-switcher__icon"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3.7" />
        <path
          d="M12 2.5v2.1M12 19.4v2.1M21.5 12h-2.1M4.6 12H2.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5M18.7 18.7l-1.5-1.5M6.8 6.8 5.3 5.3"
        />
      </svg>
      <svg
        v-else
        class="theme-switcher__icon"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <path d="M20.2 15.4A8.3 8.3 0 0 1 8.6 3.8 8.3 8.3 0 1 0 20.2 15.4Z" />
      </svg>
      <span class="sr-only">{{
        t('nav.themeDescription', { mode: currentLabel })
      }}</span>
    </button>

    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1 scale-95"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0 -translate-y-1 scale-95"
    >
      <ul
        v-if="open"
        :id="menuId"
        ref="menu"
        role="menu"
        data-handdrawn="menu"
        class="theme-switcher__menu"
        :aria-label="t('nav.theme')"
        @keydown="onMenuKeydown"
        @focusout="onMenuFocusout"
      >
        <li v-for="option in themeOptions" :key="option.value" role="none">
          <button
            type="button"
            role="menuitemradio"
            class="theme-switcher__option"
            :class="
              option.value === preference
                ? 'theme-switcher__option--selected'
                : ''
            "
            :aria-checked="option.value === preference"
            @click="choose(option.value)"
          >
            <svg
              v-if="option.value === 'auto'"
              class="theme-switcher__option-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <rect x="4" y="4" width="16" height="13" rx="2.5" />
              <path
                d="M8.5 20h7M12 17v3M9.5 10a2.5 2.5 0 0 1 5 0c0 1.6-1.2 1.8-1.2 3M12 14.8h.01"
              />
            </svg>
            <svg
              v-else-if="option.value === 'light'"
              class="theme-switcher__option-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3.7" />
              <path
                d="M12 2.5v2.1M12 19.4v2.1M21.5 12h-2.1M4.6 12H2.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5M18.7 18.7l-1.5-1.5M6.8 6.8 5.3 5.3"
              />
            </svg>
            <svg
              v-else
              class="theme-switcher__option-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <path
                d="M20.2 15.4A8.3 8.3 0 0 1 8.6 3.8 8.3 8.3 0 1 0 20.2 15.4Z"
              />
            </svg>
            <span>{{ t(option.labelKey) }}</span>
            <svg
              v-if="option.value === preference"
              class="theme-switcher__check"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              aria-hidden="true"
            >
              <path d="m5 12 4.5 4.5L19 7" />
            </svg>
          </button>
        </li>
      </ul>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useTheme, type ThemePreference } from '@/composables/useTheme'

const { t } = useI18n()
const { preference, setThemePreference } = useTheme()
const props = withDefaults(
  defineProps<{ mobile?: boolean; variant?: 'landing' | 'console' }>(),
  {
    mobile: false,
    variant: 'landing',
  }
)
const variant = computed(() => props.variant ?? 'landing')

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const open = ref(false)
const menuId = `theme-switcher-${useId()}`

const themeOptions = [
  { value: 'auto', labelKey: 'nav.themeAuto' },
  { value: 'light', labelKey: 'nav.themeLight' },
  { value: 'dark', labelKey: 'nav.themeDark' },
] as const satisfies ReadonlyArray<{ value: ThemePreference; labelKey: string }>

const currentLabel = computed(() => {
  const option = themeOptions.find(({ value }) => value === preference.value)
  return t(option?.labelKey ?? 'nav.themeAuto')
})

function cycleCompact() {
  const order: ThemePreference[] = ['auto', 'light', 'dark']
  const index = order.indexOf(preference.value)
  setThemePreference(order[(index + 1) % order.length])
}

function close(restoreFocus = false) {
  if (!open.value) return
  open.value = false
  if (restoreFocus) nextTick(() => trigger.value?.focus())
}

function focusOption(offset = 0) {
  const options = Array.from(
    menu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ??
      []
  )
  if (!options.length) return

  const selectedIndex = Math.max(
    0,
    themeOptions.findIndex(({ value }) => value === preference.value)
  )
  const targetIndex = (selectedIndex + offset + options.length) % options.length
  options[targetIndex]?.focus()
}

function openMenu(offset = 0) {
  open.value = true
  nextTick(() => focusOption(offset))
}

function toggle() {
  if (open.value) close()
  else openMenu()
}

function choose(value: ThemePreference) {
  setThemePreference(value)
  close(true)
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    openMenu()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    openMenu(-1)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    close(true)
  }
}

function onMenuKeydown(event: KeyboardEvent) {
  const options = Array.from(
    menu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ??
      []
  )
  const activeIndex = Math.max(
    0,
    options.indexOf(document.activeElement as HTMLButtonElement)
  )

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    options[(activeIndex + 1) % options.length]?.focus()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    options[(activeIndex - 1 + options.length) % options.length]?.focus()
  } else if (event.key === 'Home') {
    event.preventDefault()
    options[0]?.focus()
  } else if (event.key === 'End') {
    event.preventDefault()
    options[options.length - 1]?.focus()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    close(true)
  } else if (event.key === 'Tab') {
    close()
  }
}

function onMenuFocusout(event: FocusEvent) {
  const nextTarget = event.relatedTarget
  if (!(nextTarget instanceof Node) || !root.value?.contains(nextTarget))
    close()
}

onClickOutside(root, () => close())
</script>

<style scoped>
.theme-switcher {
  --theme-switcher-foreground: var(--text-secondary);
  --theme-switcher-foreground-hover: var(--text-primary);
  --theme-switcher-border: var(--border-subtle);
  --theme-switcher-surface: var(--surface-raised);
  --theme-switcher-surface-hover: var(--surface-muted);
  --theme-switcher-menu: var(--surface-overlay);
  --theme-switcher-option-hover: var(--surface-muted);
  --theme-switcher-selected: var(--accent-soft);
  --theme-switcher-accent: var(--accent);
  --theme-switcher-focus: var(--focus-ring);
}

.theme-switcher__trigger {
  display: inline-flex;
  height: 2.25rem;
  width: 2.25rem;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--theme-switcher-border);
  border-radius: 9999px;
  background: var(--theme-switcher-surface);
  color: var(--theme-switcher-foreground);
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    color 180ms ease,
    box-shadow 180ms ease;
}

.theme-switcher__trigger:hover {
  border-color: var(--theme-switcher-accent);
  background: var(--theme-switcher-surface-hover);
  color: var(--theme-switcher-foreground-hover);
}

.theme-switcher__trigger:focus-visible,
.theme-switcher__option:focus-visible {
  outline: 2px solid var(--theme-switcher-focus);
  outline-offset: 2px;
}

.theme-switcher__icon,
.theme-switcher__option-icon {
  flex: none;
}

.theme-switcher__menu {
  position: absolute;
  right: 0;
  z-index: 90;
  width: 12.5rem;
  margin-top: 0.5rem;
  padding: 0.25rem;
  overflow: hidden;
  border: 1px solid var(--theme-switcher-border);
  border-radius: 0.75rem;
  background: var(--theme-switcher-menu);
  box-shadow: var(--menu-shadow);
  backdrop-filter: blur(20px);
}

.theme-switcher__option {
  display: flex;
  min-height: 2.75rem;
  width: 100%;
  align-items: center;
  gap: 0.625rem;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  color: var(--theme-switcher-foreground);
  font-size: 0.875rem;
  line-height: 1.25rem;
  text-align: left;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}

.theme-switcher__option:hover {
  background: var(--theme-switcher-option-hover);
  color: var(--theme-switcher-foreground-hover);
}

.theme-switcher__option--selected {
  background: var(--theme-switcher-selected);
  color: var(--theme-switcher-foreground-hover);
}

.theme-switcher__check {
  margin-left: auto;
  color: var(--theme-switcher-accent);
}

.theme-switcher-mobile {
  display: grid;
  gap: 0.625rem;
}

.theme-switcher-mobile__label {
  margin: 0;
  color: var(--text-tertiary);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.theme-switcher-mobile__segments {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.75rem;
  background: var(--surface-muted);
}

.theme-switcher-mobile__option {
  min-width: 0;
  min-height: 2.75rem;
  border-radius: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 650;
  transition:
    background-color 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;
}

.theme-switcher-mobile__option:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.theme-switcher-mobile__option--selected {
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--border-strong);
}

.theme-switcher-mobile__option:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
</style>
