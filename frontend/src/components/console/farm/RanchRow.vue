<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import type { RanchAnimal } from '@/types/farm'

defineProps<{
  animals: RanchAnimal[]
  acting: boolean
}>()

const emit = defineEmits<{
  feedAnimal: [id: number]
  collectAnimal: [id: number]
}>()

const { t } = useI18n()

const animalEmoji: Record<string, string> = {
  cow: '🐄',
  chicken: '🐔',
  sheep: '🐑',
}

function moodColor(mood: number): string {
  if (mood >= 70)
    return 'background:var(--status-success-soft);color:var(--status-success-text)'
  if (mood >= 40)
    return 'background:var(--status-warning-soft);color:var(--status-warning-text)'
  return 'background:var(--status-danger-soft);color:var(--status-danger-text)'
}
</script>

<template>
  <article
    class="pencil-surface rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-5 shadow-[var(--card-shadow)]"
    data-handdrawn="surface"
  >
    <h3 class="mb-4 text-sm font-semibold text-[var(--text-primary)]">
      🐄 {{ t('farm.ranch.title') }}
    </h3>
    <div class="space-y-3">
      <div
        v-for="animal in animals"
        :key="animal.id"
        class="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3"
      >
        <span class="text-2xl leading-none">{{
          animalEmoji[animal.type] ?? '🐾'
        }}</span>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-[var(--text-primary)]">{{
              animal.name
            }}</span>
            <span
              class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
              :style="moodColor(animal.mood)"
            >
              {{ t('farm.ranch.mood', { n: animal.mood }) }}
            </span>
          </div>
          <div
            class="pencil-progress mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-solid)]"
          >
            <div
              class="h-full rounded-full transition-all"
              :style="{
                width: `${animal.mood}%`,
                background:
                  animal.mood >= 70
                    ? 'var(--status-success)'
                    : animal.mood >= 40
                      ? 'var(--status-warning)'
                      : 'var(--status-danger)',
              }"
            />
          </div>
        </div>

        <div class="flex shrink-0 gap-2">
          <ConsoleButton
            variant="secondary"
            size="sm"
            :loading="acting"
            @click="emit('feedAnimal', animal.id)"
          >
            {{ t('farm.ranch.feed') }}
          </ConsoleButton>
          <ConsoleButton
            v-if="animal.yield_ready"
            size="sm"
            :loading="acting"
            @click="emit('collectAnimal', animal.id)"
          >
            {{ t('farm.ranch.collect') }}
          </ConsoleButton>
        </div>
      </div>
    </div>
  </article>
</template>
