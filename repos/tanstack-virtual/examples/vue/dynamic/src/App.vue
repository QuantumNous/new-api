<template>
  <div>
    <p>
      These components are using <strong>dynamic</strong> sizes. This means that
      each element's exact dimensions are unknown when rendered. An estimated
      dimension is used as the initial measurement, then this measurement is
      readjusted on the fly as each element is rendered.
    </p>
    <nav>
      <ul>
        <li>
          <a href="/">List</a>
        </li>
        <li>
          <a href="/window-list">List - window as scroller</a>
        </li>
        <li>
          <a href="/columns">Column</a>
        </li>
        <li>
          <a href="/grid">Grid</a>
        </li>
      </ul>
    </nav>
    <RowVirtualizerDynamic v-if="pathname === '/'" />
    <RowVirtualizerDynamicWindow v-else-if="pathname === '/window-list'" />
    <ColumnVirtualizerDynamic v-else-if="pathname === '/columns'" />
    <GridVirtualizerDynamic v-else-if="pathname === '/grid'" />
    <div v-else>Not found</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import RowVirtualizerDynamic from './components/RowVirtualizerDynamic.vue'
import RowVirtualizerDynamicWindow from './components/RowVirtualizerDynamicWindow.vue'
import ColumnVirtualizerDynamic from './components/ColumnVirtualizerDynamic.vue'
import GridVirtualizerDynamic from './components/GridVirtualizerDynamic.vue'

const pathname = computed(() => window.location.pathname)
</script>
