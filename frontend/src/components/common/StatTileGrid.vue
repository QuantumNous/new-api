<script setup lang="ts">
export interface StatTile {
  label: string
  value: string
  sub?: string
}

withDefaults(
  defineProps<{
    tiles: StatTile[]
    columns?: 2 | 3 | 4
  }>(),
  { columns: 4 }
)

const columnClass = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-2 xl:grid-cols-4',
} as const
</script>

<template>
  <div class="grid gap-4" :class="columnClass[columns]">
    <div
      v-for="tile in tiles"
      :key="tile.label"
      class="min-w-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-4 py-3"
    >
      <p class="text-xs text-[var(--text-tertiary)]">{{ tile.label }}</p>
      <p
        class="display-number mt-1 truncate text-xl text-[var(--text-primary)]"
      >
        {{ tile.value }}
      </p>
      <p
        v-if="tile.sub"
        class="mt-0.5 truncate text-xs text-[var(--text-tertiary)]"
      >
        {{ tile.sub }}
      </p>
    </div>
  </div>
</template>
