<template>
  <div
    ref="parentRef"
    class="List"
    style="width: 400px; height: 100px; overflow: auto"
  >
    <div
      :style="{
        height: '100%',
        width: `${totalSize}px`,
        position: 'relative',
      }"
    >
      <div
        v-for="virtualColumn in virtualColumns"
        :key="virtualColumn.index"
        :class="virtualColumn.index % 2 ? 'ListItemOdd' : 'ListItemEven'"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${virtualColumn.size}px`,
          height: '100%',
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
  estimateSize: () => 50,
  paddingStart: 100,
  paddingEnd: 100,
})

const virtualColumns = computed(() => columnVirtualizer.value.getVirtualItems())

const totalSize = computed(() => columnVirtualizer.value.getTotalSize())
</script>
