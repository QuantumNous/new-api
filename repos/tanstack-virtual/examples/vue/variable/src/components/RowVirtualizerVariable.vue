<template>
  <div
    ref="parentRef"
    class="List"
    style="height: 200px; width: 400px; overflow: auto"
  >
    <div
      :style="{ height: `${totalSize}px`, width: '100%', position: 'relative' }"
    >
      <div
        v-for="virtualRow in virtualRows"
        :key="virtualRow.index"
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
        Row {{ virtualRow.index }}
      </div>
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
})

const parentRef = ref<HTMLElement | null>(null)

const rowVirtualizer = useVirtualizer({
  count: props.rows.length,
  getScrollElement: () => parentRef.value,
  estimateSize: (i) => props.rows[i],
  overscan: 5,
})

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())
const totalSize = computed(() => rowVirtualizer.value.getTotalSize())
</script>
