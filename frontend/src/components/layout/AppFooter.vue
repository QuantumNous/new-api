<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <footer
    class="border-t border-[var(--footer-border)] bg-[var(--surface-footer)] px-4 py-6 text-center text-xs leading-6 text-[var(--footer-text-tertiary)] sm:px-6"
  >
    <p>
      {{ t('footer.copyright') }}
      <span class="mx-1 text-[var(--footer-border)]" aria-hidden="true">·</span>
      {{ t('footer.designBy') }}
      <strong class="font-semibold text-[var(--footer-text-primary)]">
        DayFliggy
      </strong>
      {{ t('footer.updated') }}
    </p>
  </footer>
</template>
