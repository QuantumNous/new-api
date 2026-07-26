<script setup lang="ts">
import BrandMark from '@/components/console/BrandMark.vue'
import AuthBrandPanel from '@/components/auth/AuthBrandPanel.vue'
import LanguageSelector from '@/components/common/LanguageSelector.vue'
import ThemeSwitcher from '@/components/common/ThemeSwitcher.vue'
</script>

<template>
  <div class="grid min-h-screen lg:grid-cols-[minmax(380px,42%)_1fr]">
    <!-- Brand panel: key-constellation scene, deep in both themes
         (footer rule, color report §5.4). -->
    <AuthBrandPanel />

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
