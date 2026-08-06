<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import ConsoleSidebar from '@/components/console/ConsoleSidebar.vue'
import ConsoleNavStrip from '@/components/console/ConsoleNavStrip.vue'
import ConsoleTopbar from '@/components/console/ConsoleTopbar.vue'
import '@/styles/console.css'

const route = useRoute()
const maxWidth = computed(() =>
  route.meta.wide ? 'max-w-[1400px]' : 'max-w-[1200px]'
)
const noPageScroll = computed(() => Boolean(route.meta.noPageScroll))
const isPrototype = computed(() => Boolean(route.meta.prototype))

const isScrolling = ref(false)
let scrollTimer: ReturnType<typeof setTimeout> | null = null

function onScroll() {
  isScrolling.value = true
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    isScrolling.value = false
  }, 2300)
}

onBeforeUnmount(() => {
  if (scrollTimer) clearTimeout(scrollTimer)
})
</script>

<template>
  <div
    class="flex h-screen h-dvh overflow-hidden"
    data-handdrawn-scope="console"
  >
    <ConsoleSidebar />
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <ConsoleTopbar data-console-scroll-boundary />
      <div
        data-console-scroll-zone
        class="night-page-texture scroll-zone texture-paper draft-grid min-w-0 flex-1 overflow-y-auto"
        :class="{ scrolling: isScrolling, 'no-page-scroll': noPageScroll }"
        @scroll.passive="onScroll"
      >
        <ConsoleNavStrip />
        <div
          v-if="isPrototype"
          class="border-b border-[var(--status-warning)] bg-[var(--status-warning-soft)] px-4 py-2 text-center text-xs font-semibold text-[var(--status-warning-text)] sm:px-6 lg:px-8"
          role="status"
        >
          {{ $t('nav.prototypeMode') }} · {{ $t('nav.prototypeModeHint') }}
        </div>
        <main class="min-w-0 px-4 py-8 sm:px-6 lg:px-8">
          <div
            class="mx-auto transition-[max-width] duration-300"
            :class="maxWidth"
          >
            <RouterView v-slot="{ Component }">
              <Transition name="page" mode="out-in">
                <component :is="Component" />
              </Transition>
            </RouterView>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-enter-active {
  transition: all 0.22s ease;
}
.page-leave-active {
  transition: all 0.15s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
}
</style>
