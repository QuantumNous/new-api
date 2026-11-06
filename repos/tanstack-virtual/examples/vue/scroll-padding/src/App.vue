<template>
  <div>
    <div>
      <button @click="rowVirtualizer.scrollToIndex(40)">
        Scroll to index 40
      </button>
      <button @click="rowVirtualizer.scrollToIndex(20)">
        Then scroll to index 20
      </button>
    </div>

    <br />
    <br />

    <div
      ref="parentRef"
      class="List"
      style="height: 200px; width: 400px; overflow: auto"
    >
      <table :style="{ height: `${totalSize}px`, width: '100%' }">
        <thead ref="theadRef">
          <tr>
            <th>Index</th>
            <th>Key</th>
          </tr>
        </thead>
        <tbody>
          <tr
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
            <td>#{{ virtualRow.index }}</td>
            <td>{{ virtualRow.key }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useVirtualizer } from '@tanstack/vue-virtual'

const parentRef = ref<HTMLElement | null>(null)

const theadRef = ref<HTMLElement | null>(null)

const { height } = useElementSize(theadRef)

const rowVirtualizerOptions = computed(() => {
  return {
    count: 10000,
    getScrollElement: () => parentRef.value,
    estimateSize: () => 35,
    overscan: 5,
    paddingStart: height.value ?? 0,
    scrollPaddingStart: height.value ?? 0,
  }
})

const rowVirtualizer = useVirtualizer(rowVirtualizerOptions)

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())

const totalSize = computed(() => rowVirtualizer.value.getTotalSize())
</script>
