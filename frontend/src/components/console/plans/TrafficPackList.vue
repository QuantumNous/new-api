<script setup lang="ts">
import { Infinity as InfinityIcon } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleCard from '@/components/common/ConsoleCard.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import { planAccentColor } from '@/constants/adminPlans'
import type { TrafficEntitlement } from '@/types/console'
import { formatDate, formatNumber } from '@/utils/format'

const props = defineProps<{ packs: TrafficEntitlement[] }>()

const { t } = useI18n()

const EXPIRING_SOON_DAYS = 7

interface PackRow {
  pack: TrafficEntitlement
  usedPercent: number
  daysLeft: number | null
  expiringSoon: boolean
  expired: boolean
  accent: string
}

/**
 * Grants are held individually because each expires on its own schedule, so the
 * derived expiry state is computed per row rather than once for the list.
 */
const rows = computed<PackRow[]>(() =>
  props.packs.map((pack) => {
    const forever = pack.expire_time === -1
    const daysLeft = forever
      ? null
      : Math.max(0, Math.ceil((pack.expire_time - Date.now() / 1000) / 86_400))
    const usedPercent =
      pack.total_quota > 0
        ? Math.min(
            100,
            Math.max(
              0,
              ((pack.total_quota - pack.remain_quota) / pack.total_quota) * 100
            )
          )
        : 0
    return {
      pack,
      usedPercent,
      daysLeft,
      expiringSoon:
        daysLeft !== null && daysLeft > 0 && daysLeft <= EXPIRING_SOON_DAYS,
      expired: daysLeft === 0,
      accent: planAccentColor(pack.accent),
    }
  })
)

const totalRemaining = computed(() =>
  props.packs.reduce((sum, pack) => sum + pack.remain_quota, 0)
)

function meterColor(percent: number): string {
  if (percent >= 100) return 'var(--status-danger)'
  if (percent >= 80) return 'var(--status-warning)'
  return 'var(--signal)'
}
</script>

<template>
  <ConsoleCard :title="t('plans.myTrafficPacks')" :padded="packs.length === 0">
    <template #action>
      <span
        v-if="packs.length > 0"
        class="font-mono text-xs tabular-nums text-[var(--text-secondary)]"
      >
        {{ t('plans.packsTotal', { value: formatNumber(totalRemaining) }) }}
      </span>
    </template>

    <p
      v-if="packs.length === 0"
      class="py-1 text-sm text-[var(--text-tertiary)]"
    >
      {{ t('plans.noTrafficPacks') }}
    </p>

    <div v-else data-handdrawn="ledger-rows">
      <div
        v-for="row in rows"
        :key="row.pack.id"
        class="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            class="h-8 w-1 shrink-0 rounded-full"
            :style="{ background: row.accent }"
            aria-hidden="true"
          />
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p
                class="truncate text-sm font-semibold text-[var(--text-primary)]"
              >
                {{ row.pack.name }}
              </p>
              <StatusChip v-if="row.expired" tone="danger" class="text-[10px]">
                {{ t('plans.expired') }}
              </StatusChip>
              <StatusChip
                v-else-if="row.expiringSoon"
                tone="warning"
                class="text-[10px]"
              >
                {{ t('plans.daysLeft', { n: row.daysLeft }) }}
              </StatusChip>
            </div>
            <p
              class="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]"
            >
              <template v-if="row.pack.expire_time === -1">
                <InfinityIcon :size="12" aria-hidden="true" />
                {{ t('plans.forever') }}
              </template>
              <template v-else>
                {{
                  t('plans.packExpiresAt', {
                    date: formatDate(row.pack.expire_time),
                  })
                }}
              </template>
            </p>
          </div>
        </div>

        <div class="min-w-0 sm:w-56">
          <div
            class="flex items-center justify-between gap-2 font-mono text-xs tabular-nums"
          >
            <span class="text-[var(--text-primary)]">
              {{ formatNumber(row.pack.remain_quota) }}
            </span>
            <span class="text-[10px] text-[var(--text-tertiary)]">
              / {{ formatNumber(row.pack.total_quota) }}
            </span>
          </div>
          <div
            class="pencil-progress mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
            role="progressbar"
            :aria-valuenow="Math.round(row.usedPercent)"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`${row.pack.name} ${t('plans.usage')}`"
          >
            <div
              class="h-full rounded-full transition-[width] duration-500"
              :style="{
                width: `${row.usedPercent}%`,
                background: meterColor(row.usedPercent),
              }"
            />
          </div>
        </div>
      </div>
    </div>
  </ConsoleCard>
</template>
