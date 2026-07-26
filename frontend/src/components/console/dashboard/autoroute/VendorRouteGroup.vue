<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import ConsoleCard from '@/components/common/ConsoleCard.vue'
import VendorLogo from '@/components/console/models/VendorLogo.vue'
import ChannelScoreRow from './ChannelScoreRow.vue'
import type { ScoredChannel } from '@/composables/useAutoRoute'
import { scoreBand } from '@/utils/routeScore'

const props = defineProps<{
  vendor: string
  channels: ScoredChannel[]
}>()

const { t } = useI18n()
const expanded = ref(true)

const bestScore = computed(() => props.channels[0]?.score ?? 0)
const bestBand = computed(() => scoreBand(bestScore.value))
</script>

<template>
  <ConsoleCard>
    <!-- group header -->
    <button
      type="button"
      class="focus-ring flex w-full items-center gap-3 rounded-lg"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <VendorLogo :vendor="vendor" :size="28" />
      <span
        class="flex-1 truncate text-left text-sm font-semibold text-[var(--text-primary)]"
      >
        {{ vendor }}
      </span>
      <span
        class="rounded-lg bg-[var(--surface-muted)] px-2 py-0.5 text-xs tabular-nums text-[var(--text-tertiary)]"
        :title="
          t('dashboard.autoRoute.channelCount', { count: channels.length })
        "
      >
        × {{ channels.length }}
      </span>
      <span
        class="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums"
        :style="{
          background: `var(--status-${bestBand}-soft)`,
          color: `var(--status-${bestBand}-text)`,
        }"
        :title="t('dashboard.autoRoute.topScore')"
      >
        <span
          class="h-1.5 w-1.5 rounded-full"
          :style="{ background: `var(--status-${bestBand})` }"
        />
        {{ bestScore }}
      </span>
      <ChevronDown
        :size="16"
        class="shrink-0 text-[var(--text-tertiary)] transition-transform"
        :class="{ 'rotate-180': expanded }"
        aria-hidden="true"
      />
    </button>

    <!-- channel rows, ranked within this vendor only -->
    <div v-if="expanded" class="mt-2 divide-y divide-[var(--border-subtle)]">
      <ChannelScoreRow
        v-for="(ch, i) in channels"
        :key="ch.id"
        :channel="ch"
        :rank="i + 1"
      />
    </div>
  </ConsoleCard>
</template>
