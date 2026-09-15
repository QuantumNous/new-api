<template>
  <div ref="parentRef" style="overflow-y: auto; border: 1px solid #c8c8c8">
    <div
      :style="{
        height: `${totalSize}px`,
        position: 'relative',
      }"
    >
      <template v-for="virtualRow in virtualRows" :key="virtualRow.key">
        <div
          :data-index="virtualRow.index"
          ref="virtualItemEls"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `translateY(${
              virtualRow.start - rowVirtualizer.options.scrollMargin
            }px)`,
            display: 'flex',
          }"
        >
          <div :style="{ width: `${width[0]}px` }" />
          <div
            v-for="virtualColumn in virtualColumns"
            :key="virtualColumn.key"
            :style="{
              minHeight: virtualRow.index === 0 ? 50 : virtualRow.size,
              width: `${getColumnWidth(virtualColumn.index)}px`,
              borderBottom: '1px solid #c8c8c8',
              borderRight: '1px solid #c8c8c8',
              padding: '7px 12px',
            }"
          >
            <div v-if="virtualRow.index === 0">
              {{ columns[virtualColumn.index].name }}
            </div>
            <div v-else>
              {{ data[virtualRow.index][virtualColumn.index] }}
            </div>
          </div>
          <div :style="{ width: `${width[1]}px` }" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUpdated, ref, shallowRef } from 'vue'
import { useVirtualizer, useWindowVirtualizer } from '@tanstack/vue-virtual'
import { generateColumns, generateData } from './utils'

const columns = generateColumns(30)
const data = generateData(columns)

const parentRef = ref<HTMLElement | null>(null)

const parentOffsetRef = ref(0)

onMounted(() => {
  parentOffsetRef.value = parentRef.value?.offsetTop ?? 0
})

const rowVirtualizerOptions = computed(() => {
  return {
    count: data.length,
    estimateSize: () => 350,
    overscan: 5,
    scrollMargin: parentOffsetRef.value,
  }
})

const rowVirtualizer = useWindowVirtualizer(rowVirtualizerOptions)

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())

const totalSize = computed(() => rowVirtualizer.value.getTotalSize())

const getColumnWidth = (index: number) => columns[index].width

const columnVirtualizerOptions = computed(() => {
  return {
    horizontal: true,
    count: columns.length,
    getScrollElement: () => parentRef.value,
    estimateSize: getColumnWidth,
    overscan: 5,
  }
})

const columnVirtualizer = useVirtualizer(columnVirtualizerOptions)

const virtualColumns = computed(() => columnVirtualizer.value.getVirtualItems())

const width = computed(() => {
  return virtualColumns.value.length > 0
    ? [
        virtualColumns.value[0].start,
        columnVirtualizer.value.getTotalSize() -
          virtualColumns.value[virtualColumns.value.length - 1].end,
      ]
    : [0, 0]
})

const virtualItemEls = shallowRef([])

function measureAll() {
  rowVirtualizer.value.measureElement(null)
  virtualItemEls.value.forEach((el) => {
    if (el) rowVirtualizer.value.measureElement(el)
  })
}

onMounted(measureAll)
onUpdated(measureAll)
</script>
