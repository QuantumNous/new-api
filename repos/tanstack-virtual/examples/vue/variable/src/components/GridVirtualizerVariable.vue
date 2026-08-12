<template>
  <div
    ref="parentRef"
    class="List"
    style="height: 400px; width: 500px; overflow: auto"
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
          v-for="virtualColumn in virtualColumns"
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
            width: `${columns[virtualColumn.index]}px`,
            height: `${rows[virtualRow.index]}px`,
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
import { ref, computed, PropType } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'

const props = defineProps({
  rows: {
    type: Array as PropType<number[]>,
    default: () => [],
  },
  columns: {
    type: Array as PropType<number[]>,
    default: () => [],
  },
})

const parentRef = ref<HTMLElement | null>(null)

const rowVirtualizer = useVirtualizer({
  count: props.rows.length,
  getScrollElement: () => parentRef.value,
  estimateSize: (i) => props.rows[i],
  overscan: 5,
})

const columnVirtualizer = useVirtualizer({
  horizontal: true,
  count: props.columns.length,
  getScrollElement: () => parentRef.value,
  estimateSize: (i) => props.columns[i],
  overscan: 5,
})

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())
const totalSizeRows = computed(() => rowVirtualizer.value.getTotalSize())

const virtualColumns = computed(() => columnVirtualizer.value.getVirtualItems())
const totalSizeColumns = computed(() => columnVirtualizer.value.getTotalSize())
</script>
