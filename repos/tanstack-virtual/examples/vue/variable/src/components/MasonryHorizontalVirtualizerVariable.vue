<template>
  <div
    ref="parentRef"
    class="List"
    style="width: 500px; height: 400px; overflow: auto"
  >
    <div
      :style="{
        width: `${totalSize}px`,
        height: '100%',
        position: 'relative',
      }"
    >
      <div
        v-for="virtualColumn in virtualColumns"
        :key="virtualColumn.index"
        :class="virtualColumn.index % 2 ? 'ListItemOdd' : 'ListItemEven'"
        :style="{
          position: 'absolute',
          top: `${virtualColumn.lane * 25}%`,
          left: 0,
          height: '25%',
          width: `${columns[virtualColumn.index]}px`,
          transform: `translateX(${virtualColumn.start}px)`,
        }"
      >
        Column {{ virtualColumn.index }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, PropType } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'

const props = defineProps({
  columns: {
    type: Array as PropType<number[]>,
    default: () => [],
  },
})

const parentRef = ref<HTMLElement | null>(null)

const columnVirtualizer = useVirtualizer({
  horizontal: true,
  count: props.columns.length,
  getScrollElement: () => parentRef.value,
  estimateSize: (i) => props.columns[i],
  overscan: 5,
  lanes: 4,
})

const virtualColumns = computed(() => columnVirtualizer.value.getVirtualItems())

const totalSize = computed(() => columnVirtualizer.value.getTotalSize())
</script>
