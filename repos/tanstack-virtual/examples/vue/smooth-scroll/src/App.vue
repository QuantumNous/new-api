<template>
  <div>
    <p>
      This smooth scroll example uses the <code>`scrollToFn`</code> to implement
      a custom scrolling function for the methods like
      <code>`scrollToIndex`</code> and <code>`scrollToOffset`</code>
    </p>

    <br />
    <br />

    <div>
      <button
        @click="
          (rowVirtualizer.scrollToIndex(randomIndex),
          (randomIndex = generateRandomIndex()))
        "
      >
        Scroll To Random Index ({{ randomIndex }})
      </button>
    </div>

    <br />
    <br />

    <div
      ref="parentRef"
      class="List"
      :style="{
        height: `200px`,
        width: `400px`,
        overflow: 'auto',
      }"
    >
      <div
        :style="{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative',
        }"
      >
        <div
          v-for="virtualRow in virtualRows"
          :key="virtualRow.key"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  elementScroll,
  useVirtualizer,
  VirtualizerOptions,
} from '@tanstack/vue-virtual'

const easeInOutQuint = (t: number) => {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t
}

const generateRandomIndex = () => Math.floor(Math.random() * 10000)

const randomIndex = ref(generateRandomIndex())

const parentRef = ref<HTMLElement | null>(null)
const scrollingRef = ref<number>()

const scrollToFn: VirtualizerOptions<any, any>['scrollToFn'] = (
  offset,
  canSmooth,
  instance,
) => {
  const duration = 1000
  const start = parentRef.value?.scrollTop || 0
  const startTime = (scrollingRef.value = Date.now())

  const run = () => {
    if (scrollingRef.value !== startTime) return
    const now = Date.now()
    const elapsed = now - startTime
    const progress = easeInOutQuint(Math.min(elapsed / duration, 1))
    const interpolated = start + (offset - start) * progress

    if (elapsed < duration) {
      elementScroll(interpolated, canSmooth, instance)
      requestAnimationFrame(run)
    } else {
      elementScroll(interpolated, canSmooth, instance)
    }
  }

  requestAnimationFrame(run)
}

const rowVirtualizerOptions = computed(() => {
  return {
    count: 10000,
    getScrollElement: () => parentRef.value,
    estimateSize: () => 35,
    overscan: 5,
    scrollToFn,
  }
})

const rowVirtualizer = useVirtualizer(rowVirtualizerOptions)

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())

const totalSize = computed(() => rowVirtualizer.value.getTotalSize())
</script>
