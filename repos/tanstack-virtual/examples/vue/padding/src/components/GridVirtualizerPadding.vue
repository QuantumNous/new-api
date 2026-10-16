<template>
  <button @click="show = !show">Toggle</button>
  <button @click="rowVirtualizer.scrollToIndex(halfWay)">
    Scroll to index {{ halfWay }}
  </button>
  <button @click="rowVirtualizer.scrollToIndex(rows.length - 1)">
    Scroll to index {{ rows.length - 1 }}
  </button>
  <br />
  <br />

  <div
    v-if="show"
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
const show = ref(true)

const halfWay = computed(() => Math.floor(props.rows.length / 2))

const parentRef = ref<HTMLElement | null>(null)

const rowVirtualizer = useVirtualizer({
  count: props.rows.length,
  getScrollElement: () => parentRef.value,
  estimateSize: () => 50,
  paddingStart: 200,
  paddingEnd: 200,
})

const columnVirtualizer = useVirtualizer({
  horizontal: true,
  count: props.columns.length,
  getScrollElement: () => parentRef.value,
  estimateSize: () => 50,
  paddingStart: 200,
  paddingEnd: 200,
})

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())
const totalSizeRows = computed(() => rowVirtualizer.value.getTotalSize())

const totalSizeColumns = computed(() => columnVirtualizer.value.getTotalSize())
</script>
