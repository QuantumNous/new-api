<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useInfiniteQuery } from '@tanstack/vue-query'

const fetchServerPage = async (
  limit: number,
  offset: number = 0,
): Promise<{ rows: string[]; nextOffset: number }> => {
  const rows = new Array(limit)
    .fill(0)
    .map((e, i) => `Async loaded row #${i + offset * limit}`)

  await new Promise((r) => setTimeout(r, 500))

  return { rows, nextOffset: offset + 1 }
}

const {
  status,
  data,
  error,
  isFetching,
  isFetchingNextPage,
  fetchNextPage,
  hasNextPage,
} = useInfiniteQuery({
  queryKey: ['projects'],
  queryFn: (ctx) => fetchServerPage(10, ctx.pageParam),
  getNextPageParam: (_lastGroup, groups) => groups.length,
})

const allRows = computed(() =>
  data.value ? data.value.pages.flatMap((d) => d.rows) : [],
)

const parentRef = ref<HTMLElement | null>(null)

const rowVirtualizerOptions = computed(() => {
  return {
    count: hasNextPage ? allRows.value.length + 1 : allRows.value.length,
    getScrollElement: () => parentRef.value,
    estimateSize: () => 100,
    overscan: 5,
  }
})

const rowVirtualizer = useVirtualizer(rowVirtualizerOptions)

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())

const totalSize = computed(() => rowVirtualizer.value.getTotalSize())

watchEffect(() => {
  const [lastItem] = [...virtualRows.value].reverse()

  if (!lastItem) {
    return
  }

  if (
    lastItem.index >= allRows.value.length - 1 &&
    hasNextPage.value &&
    !isFetchingNextPage.value
  ) {
    fetchNextPage()
  }
})
</script>

<template>
  <div>
    <p>
      This infinite scroll example uses Vue Query's useInfiniteScroll composable
      to fetch infinite data from a posts endpoint and then a rowVirtualizer is
      used along with a loader-row placed at the bottom of the list to trigger
      the next page to load.
    </p>

    <br />
    <br />
    <p v-if="status === 'loading'">Loading...</p>
    <p v-else-if="status === 'error'">Error: {{ (error as Error).message }}</p>
    <div
      v-else
      ref="parentRef"
      class="List"
      style="height: 500px; width: 100%; overflow: auto"
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
          :key="virtualRow.key"
          :class="virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`,
          }"
        >
          <template v-if="virtualRow.index > allRows.length - 1">
            {{ hasNextPage ? 'Loading more...' : 'Nothing more to load' }}
          </template>
          <template v-else>
            {{ allRows[virtualRow.index] }}
          </template>
        </div>
      </div>
    </div>
    <div v-if="isFetching && !isFetchingNextPage">Background Updating...</div>
  </div>
</template>
