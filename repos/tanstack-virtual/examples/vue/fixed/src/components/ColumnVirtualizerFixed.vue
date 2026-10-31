<template>
  <div
    ref="parentRef"
    class="List"
    style="height: 200px; width: 400px; overflow: auto"
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
import { ref, computed } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'

const parentRef = ref<HTMLElement | null>(null)

const columnVirtualizer = useVirtualizer({
  horizontal: true,
  count: 10000,
  getScrollElement: () => parentRef.value,
  estimateSize: () => 100,
  overscan: 5,
})

const virtualColumns = computed(() => columnVirtualizer.value.getVirtualItems())

const totalSize = computed(() => columnVirtualizer.value.getTotalSize())
</script>
