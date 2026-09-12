<template>
  <div ref="parentRef" class="List">
    <div
      :style="{
        height: `${totalSize}px`,
        width: '100%',
        position: 'relative',
      }"
    >
      <div
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${
            virtualRows[0]?.start - rowVirtualizer.options.scrollMargin ?? 0
          }px)`,
        }"
      >
        <div
          v-for="virtualRow in virtualRows"
          :key="virtualRow.key"
          :data-index="virtualRow.index"
          ref="virtualItemEls"
          :class="virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'"
        >
          <div style="padding: 10px 0">
            <div>Row {{ virtualRow.index }}</div>
            <div>{{ sentences[virtualRow.index] }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUpdated, ref, shallowRef } from 'vue'
import { useWindowVirtualizer } from '@tanstack/vue-virtual'
import { generateSentences } from './utils'

const sentences = generateSentences()

const parentRef = ref<HTMLElement | null>(null)

const parentOffsetRef = ref(0)

onMounted(() => {
  parentOffsetRef.value = parentRef.value?.offsetTop ?? 0
})

const rowVirtualizerOptions = computed(() => {
  return {
    count: sentences.length,
    estimateSize: () => 45,
    scrollMargin: parentOffsetRef.value,
  }
})

const rowVirtualizer = useWindowVirtualizer(rowVirtualizerOptions)

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())

const totalSize = computed(() => rowVirtualizer.value.getTotalSize())

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
