<script setup lang="ts">
import { onMounted } from 'vue'
import { useClipboard } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import PageBreadcrumb from '@/components/console/PageBreadcrumb.vue'
import { useModelMarket } from '@/composables/useModelMarket'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const toast = useToast()
const { copy } = useClipboard()
const { loading, keyword, filtered, resultCount, hasResults, load } =
  useModelMarket()

async function copyName(name: string) {
  await copy(name)
  toast.success(t('models.copied', { name }))
}

onMounted(load)
</script>

<template>
  <div>
    <PageBreadcrumb
      :crumbs="[t('models.breadcrumb.0'), t('models.breadcrumb.1')]"
    />

    <ConsoleCard :padded="false">
      <div class="p-4">
        <SearchInput
          v-model="keyword"
          :placeholder="t('models.searchPlaceholder')"
          :aria-label="t('models.searchPlaceholder')"
          name="model-search"
          class="w-full sm:w-80"
        />
      </div>
    </ConsoleCard>

    <p class="mb-4 mt-5 text-sm text-[var(--text-tertiary)]">
      {{ t('models.resultCount', { count: resultCount }) }}
    </p>

    <div v-if="loading" class="space-y-2" aria-busy="true">
      <div
        v-for="index in 8"
        :key="index"
        class="h-14 animate-pulse rounded-lg bg-[var(--surface-muted)]"
      />
    </div>

    <ConsoleCard v-else-if="!hasResults">
      <EmptyState
        :title="t('models.emptyTitle')"
        :hint="t('models.emptyHint')"
        illustration="empty-models"
      />
    </ConsoleCard>

    <ConsoleCard v-else :padded="false">
      <ul class="divide-y divide-[var(--border-subtle)]">
        <li
          v-for="model in filtered"
          :key="model"
          class="flex min-h-14 items-center justify-between gap-3 px-4 py-3"
        >
          <span
            class="min-w-0 truncate font-mono text-sm text-[var(--text-primary)]"
          >
            {{ model }}
          </span>
          <ConsoleButton
            variant="ghost"
            size="sm"
            :aria-label="`${t('common.copy')} ${model}`"
            @click="copyName(model)"
          >
            {{ t('common.copy') }}
          </ConsoleButton>
        </li>
      </ul>
    </ConsoleCard>
  </div>
</template>
