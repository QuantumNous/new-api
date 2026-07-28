<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { passwordStrength } from '@/utils/format'

const props = defineProps<{
  password: string
}>()

const { t } = useI18n()

const strength = computed(() => passwordStrength(props.password))
const tone = computed(() => {
  if (strength.value === 1) return 'var(--status-danger)'
  if (strength.value === 2) return 'var(--status-warning)'
  return 'var(--accent)'
})
const label = computed(() => {
  const idx = Math.min(Math.max(strength.value - 1, 0), 2)
  return t(`auth.strength.${idx}`)
})
</script>

<template>
  <div v-if="password" class="flex items-center gap-3">
    <div class="flex flex-1 gap-1.5">
      <span
        v-for="i in 4"
        :key="i"
        class="h-1.5 flex-1 rounded-full transition-colors duration-300"
        :style="{
          background:
            i <= strength + 1 && strength > 0 ? tone : 'var(--border-subtle)',
        }"
      />
    </div>
    <span class="text-xs font-medium" :style="{ color: tone }">
      {{ label }}
    </span>
  </div>
</template>
