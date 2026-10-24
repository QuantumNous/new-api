<template>
  <div>
    <p>
      Examples with additional <strong>padding</strong> applied to the start and
      the end of the scrolling area.
    </p>
    <br />
    <br />

    <h3>Rows</h3>
    <RowVirtualizerPadding :rows="rows" />
    <br />
    <br />
    <h3>Columns</h3>
    <ColumnVirtualizerPadding :columns="columns" />
    <br />
    <br />
    <h3>Grid</h3>
    <GridVirtualizerPadding :rows="rows" :columns="columns" />
  </div>
</template>

<script setup lang="ts">
const rows = new Array(10000)
  .fill(true)
  .map(() => 25 + Math.round(Math.random() * 100))

const columns = new Array(10000)
  .fill(true)
  .map(() => 75 + Math.round(Math.random() * 100))

import RowVirtualizerPadding from './components/RowVirtualizerPadding.vue'
import ColumnVirtualizerPadding from './components/ColumnVirtualizerPadding.vue'
import GridVirtualizerPadding from './components/GridVirtualizerPadding.vue'
</script>
