<template>
  <div>
    <p>
      These components are using <strong>fixed</strong> sizes. This means that
      every element's dimensions are hard-coded to the same value and never
      change.
    </p>
    <br />
    <br />

    <h3>Rows</h3>
    <RowVirtualizerFixed />
    <br />
    <br />
    <h3>Columns</h3>
    <ColumnVirtualizerFixed />
    <br />
    <br />
    <h3>Grid</h3>
    <GridVirtualizerFixed />
  </div>
</template>

<script setup lang="ts">
import RowVirtualizerFixed from './components/RowVirtualizerFixed.vue'
import ColumnVirtualizerFixed from './components/ColumnVirtualizerFixed.vue'
import GridVirtualizerFixed from './components/GridVirtualizerFixed.vue'
</script>
