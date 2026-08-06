<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import type { FarmPet } from '@/types/farm'

const props = defineProps<{
  pet: FarmPet
  acting: boolean
  readonly?: boolean
}>()

const emit = defineEmits<{ feedPet: [] }>()
const { t } = useI18n()

const petEmoji: Record<string, string> = {
  robot: '🤖',
  cat: '🐱',
  dragon: '🐲',
}

const energyStyle = computed(() => {
  const pct = props.pet.energy
  const color =
    pct > 50
      ? 'var(--status-success)'
      : pct > 20
        ? 'var(--status-warning)'
        : 'var(--status-danger)'
  return { width: `${pct}%`, background: color }
})
</script>

<template>
  <article
    class="pencil-surface rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-5 shadow-[var(--card-shadow)]"
    data-handdrawn="surface"
  >
    <h3 class="mb-4 text-sm font-semibold text-[var(--text-primary)]">
      🐾 {{ t('farm.pet.title') }}
    </h3>

    <div class="flex items-start gap-4">
      <!-- pet avatar -->
      <div
        class="flex size-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
        style="background: var(--accent-soft)"
      >
        {{ petEmoji[pet.type] ?? '🐾' }}
      </div>

      <div class="flex-1 space-y-2">
        <div class="flex items-center gap-2">
          <span class="font-bold text-[var(--text-primary)]">{{
            pet.name
          }}</span>
          <span
            class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
            style="background: var(--accent-soft); color: var(--accent-text)"
          >
            {{ t('farm.pet.level', { n: pet.level }) }}
          </span>
          <!-- low energy warning -->
          <span
            v-if="pet.energy <= 20"
            class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
            style="
              background: var(--status-danger-soft);
              color: var(--status-danger-text);
            "
          >
            {{ t('farm.pet.lowEnergy') }}
          </span>
        </div>

        <!-- energy bar -->
        <div>
          <p class="mb-1 text-xs text-[var(--text-tertiary)]">
            {{ t('farm.pet.energy', { n: pet.energy }) }}
          </p>
          <div
            class="pencil-progress h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]"
          >
            <div
              class="h-full rounded-full transition-all duration-500"
              :style="energyStyle"
            />
          </div>
        </div>

        <!-- skill -->
        <p class="text-xs text-[var(--text-secondary)]">
          <span class="font-medium text-[var(--text-primary)]"
            >{{ t('farm.pet.skill') }}：</span
          >{{ pet.skill }}
        </p>
      </div>
    </div>

    <div class="mt-4 flex justify-end">
      <ConsoleButton
        size="sm"
        :loading="acting"
        :disabled="readonly || pet.fed_today"
        @click="emit('feedPet')"
      >
        {{ pet.fed_today ? t('farm.pet.fed') : t('farm.pet.feed') }}
      </ConsoleButton>
    </div>
  </article>
</template>
