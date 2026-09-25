<script lang="ts">
  import RowVirtualizerDynamic from './RowVirtualizerDynamic.svelte'
  import RowVirtualizerDynamicWindow from './RowVirtualizerDynamicWindow.svelte'
  import ColumnVirtualizerDynamic from './ColumnVirtualizerDynamic.svelte'
  import GridVirtualizerDynamic from './GridVirtualizerDynamic.svelte'

  const pathname = window.location.pathname
</script>

<main>
  <p>
    These components are using <strong>dynamic</strong> sizes. This means that each
    element's exact dimensions are unknown when rendered. An estimated dimension is
    used as the initial measurement, then this measurement is readjusted on the fly
    as each element is rendered.
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
  {#if pathname === '/'}
    <RowVirtualizerDynamic />
  {:else if pathname === '/window-list'}
    <RowVirtualizerDynamicWindow />
  {:else if pathname === '/columns'}
    <ColumnVirtualizerDynamic />
  {:else if pathname === '/grid'}
    <GridVirtualizerDynamic />
  {:else}
    <p>Not Found</p>
  {/if}
</main>
