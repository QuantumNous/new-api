<template>
  <div>
    <div
      ref="parentRef"
      class="List"
      style="height: 300px; width: 400px; overflow: auto"
    >
      <div
        :style="{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative',
        }"
      >
        <div
          v-for="virtualRow in virtualRows"
          :key="virtualRow.index"
          :class="['ListItem', { Sticky: isSticky(virtualRow.index) }]"
          :style="{
            ...(isSticky(virtualRow.index)
              ? {
                  background: '#fff',
                  borderBottom: '1px solid #ddd',
                  zIndex: 1,
                }
              : {}),
            ...(isActiveSticky(virtualRow.index)
              ? { position: 'sticky' }
              : {
                  position: 'absolute',
                  transform: `translateY(${virtualRow.start}px)`,
                }),
            top: 0,
            left: 0,
            width: '100%',
            height: `${virtualRow.size}px`,
          }"
        >
          {{ rows[virtualRow.index] }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { faker } from '@faker-js/faker'
import { findIndex, groupBy } from 'lodash'
import { useVirtualizer, defaultRangeExtractor } from '@tanstack/vue-virtual'

const groupedNames = groupBy(
  Array.from({ length: 1000 })
    .map(() => faker.person.firstName())
    .sort(),
  (name: string[]) => name[0],
)
const groups = Object.keys(groupedNames)

const rows = groups.reduce<string[]>(
  (acc, k) => [...acc, k, ...groupedNames[k]],
  [],
)

const parentRef = ref<HTMLElement | null>(null)

const activeStickyIndexRef = ref(0)

const stickyIndexes = computed(() =>
  groups.map((gn) => findIndex(rows, (n: string) => n === gn)),
)

const isSticky = (index: number) => stickyIndexes.value.includes(index)

const isActiveSticky = (index: number) => activeStickyIndexRef.value === index

const rowVirtualizer = useVirtualizer({
  count: rows.length,
  estimateSize: () => 50,
  getScrollElement: () => parentRef.value,
  rangeExtractor: (range) => {
    activeStickyIndexRef.value = [...stickyIndexes.value]
      .reverse()
      .find((index) => range.startIndex >= index)

    const next = new Set([
      activeStickyIndexRef.value,
      ...defaultRangeExtractor(range),
    ])

    return [...next].sort((a, b) => a - b)
  },
})

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())

const totalSize = computed(() => rowVirtualizer.value.getTotalSize())
</script>
