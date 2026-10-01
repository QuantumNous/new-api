<script lang="ts">
  import RowVirtualizerFixed from './RowVirtualizerFixed.svelte'
  import ColumnVirtualizerFixed from './ColumnVirtualizerFixed.svelte'
  import GridVirtualizerFixed from './GridVirtualizerFixed.svelte'
</script>

<main>
  <p>
    These components are using <strong>fixed</strong> sizes. This means that every
    element's dimensions are hard-coded to the same value and never change.
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
</main>
