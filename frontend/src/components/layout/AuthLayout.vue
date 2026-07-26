<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import BrandMark from '@/components/console/BrandMark.vue'
import LanguageSelector from '@/components/common/LanguageSelector.vue'
import ThemeSwitcher from '@/components/common/ThemeSwitcher.vue'

const { t } = useI18n()
</script>

<template>
  <div class="grid min-h-screen lg:grid-cols-[minmax(380px,42%)_1fr]">
    <!-- Brand panel: the deep-green anchor stays dark in both themes,
         matching the footer rule (color report §5.4). -->
    <aside
      class="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex"
      style="background: var(--surface-footer)"
    >
      <div class="relative z-10 flex items-center gap-3">
        <BrandMark class="h-10 w-10 rounded-xl" />
        <span
          class="text-xl font-bold"
          style="color: var(--footer-text-primary)"
          >Ren2Hub</span
        >
      </div>

      <div class="relative z-10">
        <p
          class="text-xs font-semibold uppercase tracking-[0.22em]"
          style="color: var(--footer-accent)"
        >
          {{ t('auth.brandSlogan') }}
        </p>
        <h2
          class="display-title mt-4 text-4xl font-bold leading-snug"
          style="color: var(--footer-text-primary)"
        >
          {{ t('auth.signUpSubtitle') }}
        </h2>
        <p
          class="mt-4 max-w-sm text-sm leading-relaxed"
          style="color: var(--footer-text-tertiary)"
        >
          {{ t('auth.brandTagline') }}
        </p>
      </div>

      <div class="relative z-10 flex gap-2" aria-hidden="true">
        <span
          class="h-1.5 w-10 rounded-full"
          style="background: var(--footer-accent)"
        />
        <span
          class="h-1.5 w-10 rounded-full"
          style="background: var(--footer-border)"
        />
        <span
          class="h-1.5 w-10 rounded-full"
          style="background: var(--footer-border)"
        />
      </div>
    </aside>

    <!-- form pane -->
    <div
      class="texture-paper relative flex items-center justify-center px-4 py-10"
    >
      <div class="absolute right-5 top-5 flex items-center gap-1">
        <ThemeSwitcher variant="console" />
        <LanguageSelector variant="console" />
      </div>
      <div class="w-full max-w-md">
        <div class="mb-8 flex items-center gap-2.5 lg:hidden">
          <BrandMark class="h-9 w-9 rounded-lg" />
          <span class="text-lg font-bold text-[var(--text-primary)]"
            >Ren2Hub</span
          >
        </div>
        <slot />
      </div>
    </div>
  </div>
</template>
