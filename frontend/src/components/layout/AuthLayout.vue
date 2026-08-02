<script setup lang="ts">
// 编辑式认证布局（随想式）：整页同一纸底（texture-paper），顶部一条极简
// 品牌栏，左侧编辑排版叙事（AuthEditorialPanel），右侧悬浮表单卡。
// 双主题依旧全令牌驱动 —— 日间暖纸、夜间炭蓝，无恒深面板。
// 站名从 useAppStore.systemName 读取，与控制台侧边栏/Topbar 保持一致。
import { useI18n } from 'vue-i18n'

import AuthEditorialPanel from '@/components/auth/AuthEditorialPanel.vue'
import BrandMark from '@/components/console/BrandMark.vue'
import LanguageSelector from '@/components/common/LanguageSelector.vue'
import ThemeSwitcher from '@/components/common/ThemeSwitcher.vue'
import { useAppStore } from '@/stores'

const { t } = useI18n()
const app = useAppStore()
</script>

<template>
  <div
    class="night-page-texture texture-paper draft-grid flex min-h-screen flex-col bg-[var(--page-background)]"
    data-handdrawn-scope="auth"
  >
    <!-- 顶部品牌栏 -->
    <header
      class="relative z-20 flex h-16 shrink-0 items-center justify-between px-5 sm:px-8 xl:px-12"
    >
      <RouterLink
        :to="{ name: 'home' }"
        class="flex items-center gap-2.5 focus-ring rounded-lg"
        :aria-label="app.systemName"
      >
        <BrandMark class="h-8 w-8 rounded-lg" />
        <span
          class="display-title text-lg font-bold tracking-tight text-[var(--text-primary)]"
          >{{ app.systemName }}</span
        >
      </RouterLink>
      <div class="flex items-center gap-1 sm:gap-2">
        <ThemeSwitcher variant="console" />
        <LanguageSelector variant="console" />
        <RouterLink
          :to="{ name: 'home' }"
          class="ml-1 hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] focus-ring sm:flex"
        >
          ← {{ t('auth.backHome') }}
        </RouterLink>
      </div>
    </header>

    <!-- 主体：左叙事 + 右表单卡 -->
    <div
      class="mx-auto grid w-full max-w-[1440px] flex-1 lg:grid-cols-[1fr_minmax(420px,480px)] lg:gap-10 lg:px-8 xl:gap-16 xl:px-12"
    >
      <AuthEditorialPanel />

      <!-- 表单卡：纸面上的悬浮实体卡 -->
      <div class="flex items-center justify-center px-4 py-8 lg:py-12">
        <div
          class="auth-card pencil-surface-strong w-full max-w-md border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-7 py-9 sm:px-9"
          data-handdrawn="surface-strong"
        >
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Sketch radius + elevation come from the theme fork: hand-drawn card by day,
   Material card by night. */
.auth-card {
  border-radius: var(--sketch-border-radius-lg);
  box-shadow: var(--elevation-3);
}
</style>
