<template>
  <div>
    <p>
      These components are using <strong>variable</strong> sizes. This means
      that each element has a unique, but knowable dimension at render time.
    </p>
    <br />
    <br />

    <h3>Rows</h3>
    <RowVirtualizerVariable :rows="rows" />
    <br />
    <br />
    <h3>Columns</h3>
    <ColumnVirtualizerVariable :columns="columns" />
    <br />
    <br />
    <h3>Grid</h3>
    <GridVirtualizerVariable :rows="rows" :columns="columns" />
    <br />
    <br />
    <h3>Masonry (vertical)</h3>
    <MasonryVerticalVirtualizerVariable :rows="rows" />
    <br />
    <br />
    <h3>Masonry (horizontal)</h3>
    <MasonryHorizontalVirtualizerVariable :columns="columns" />
  </div>
</template>

<script setup lang="ts">
import RowVirtualizerVariable from './components/RowVirtualizerVariable.vue'
import ColumnVirtualizerVariable from './components/ColumnVirtualizerVariable.vue'
import GridVirtualizerVariable from './components/GridVirtualizerVariable.vue'
import MasonryVerticalVirtualizerVariable from './components/MasonryVerticalVirtualizerVariable.vue'
import MasonryHorizontalVirtualizerVariable from './components/MasonryHorizontalVirtualizerVariable.vue'

const rows = new Array(10000)
  .fill(true)
  .map(() => 25 + Math.round(Math.random() * 100))

const columns = new Array(10000)
  .fill(true)
  .map(() => 75 + Math.round(Math.random() * 100))
</script>
