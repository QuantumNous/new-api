<script setup lang="ts">
import { onMounted } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import EmptyState from '@/components/common/EmptyState.vue'
import VendorRouteGroup from './VendorRouteGroup.vue'
import { useAutoRoute } from '@/composables/useAutoRoute'

const { t, locale } = useI18n()
const { loading, lastUpdated, vendorList, load } = useAutoRoute()

onMounted(() => void load())
</script>

<template>
  <div class="space-y-4">
    <!-- header card: explains the per-vendor optimum and hosts refresh -->
    <div
      class="relative overflow-hidden rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-4 py-3"
    >
      <div class="relative flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <p class="text-sm text-[var(--text-secondary)]">
            {{ t('dashboard.autoRoute.subtitle') }}
          </p>
          <p
            v-if="lastUpdated"
            class="mt-0.5 text-xs text-[var(--text-tertiary)]"
          >
            {{
              t('dashboard.autoRoute.updated', {
                time: lastUpdated.toLocaleTimeString(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })
            }}
          </p>
        </div>
        <button
          type="button"
          class="focus-ring flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--surface-solid)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          :disabled="loading"
          :title="t('dashboard.autoRoute.refresh')"
          :aria-label="t('dashboard.autoRoute.refresh')"
          @click="load"
        >
          <RefreshCw
            :size="13"
            :class="{ 'animate-spin': loading }"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>

    <!-- skeleton -->
    <div v-if="loading" class="space-y-4">
      <div
        v-for="i in 4"
        :key="i"
        class="h-20 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
      />
    </div>

    <!-- vendor groups, each ranking its own optimum -->
    <template v-else-if="vendorList.length">
      <VendorRouteGroup
        v-for="group in vendorList"
        :key="group.vendor"
        :vendor="group.vendor"
        :channels="group.channels"
      />
    </template>

    <EmptyState
      v-else
      :title="t('dashboard.autoRoute.emptyTitle')"
      :hint="t('dashboard.autoRoute.emptyHint')"
    />
  </div>
</template>
