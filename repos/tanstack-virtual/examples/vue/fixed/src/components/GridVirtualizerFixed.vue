<template>
  <div
    ref="parentRef"
    class="List"
    style="height: 500px; width: 500px; overflow: auto"
  >
    <div
      :style="{
        height: `${totalSizeRows}px`,
        width: `${totalSizeColumns}px`,
        position: 'relative',
      }"
    >
      <template v-for="virtualRow in virtualRows" :key="virtualRow.index">
        <div
          v-for="virtualColumn in columnVirtualizer.getVirtualItems()"
          :key="virtualColumn.index"
          :class="
            virtualColumn.index % 2
              ? virtualRow.index % 2 === 0
                ? 'ListItemOdd'
                : 'ListItemEven'
              : virtualRow.index % 2
                ? 'ListItemOdd'
                : 'ListItemEven'
          "
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${virtualColumn.size}px`,
            height: `${virtualRow.size}px`,
            transform: `translateX(${virtualColumn.start}px) translateY(${virtualRow.start}px)`,
          }"
        >
          Cell {{ virtualRow.index }}, {{ virtualColumn.index }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'

const parentRef = ref<HTMLElement | null>(null)

const rowVirtualizer = useVirtualizer({
  count: 10000,
  getScrollElement: () => parentRef.value,
  estimateSize: () => 35,
  overscan: 5,
})

const columnVirtualizer = useVirtualizer({
  horizontal: true,
  count: 10000,
  getScrollElement: () => parentRef.value,
  estimateSize: () => 100,
  overscan: 5,
})

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())
const totalSizeRows = computed(() => rowVirtualizer.value.getTotalSize())

const totalSizeColumns = computed(() => columnVirtualizer.value.getTotalSize())
</script>
