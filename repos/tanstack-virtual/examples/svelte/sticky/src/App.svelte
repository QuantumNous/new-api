<script lang="ts">
  import { faker } from '@faker-js/faker'
  import { findIndex, groupBy } from 'lodash'
  import {
    createVirtualizer,
    defaultRangeExtractor,
    type Range,
  } from '@tanstack/svelte-virtual'

  const groupedNames = groupBy(
    Array.from({ length: 1000 })
      .map(() => faker.person.firstName())
      .sort(),
    (name: any) => name[0],
  )
  const groups = Object.keys(groupedNames)
  const rows = groups.reduce((acc, k) => [...acc, k, ...groupedNames[k]], [])
  const stickyIndexes = groups.map((gn) =>
    findIndex(rows, (n: any) => n === gn),
  )

  let virtualListEl: HTMLDivElement
  let activeStickyIndex: number = 0

  $: virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rows.length,
    getScrollElement: () => virtualListEl,
    estimateSize: () => 50,
    overscan: 5,
  })

  $: {
    function rangeExtractor(range: Range): number[] {
      activeStickyIndex = [...stickyIndexes]
        .reverse()
        .find((index) => range.startIndex >= index)

      const next = new Set([activeStickyIndex, ...defaultRangeExtractor(range)])

      return [...next].sort((a, b) => a - b)
    }
    $virtualizer.setOptions({ rangeExtractor })
  }

  function isSticky(index: number) {
    return stickyIndexes.includes(index)
  }
  $: isActiveSticky = (index: number) => activeStickyIndex === index
</script>

<main>
  <div class="list scroll-container" bind:this={virtualListEl}>
    <div
      style="position: relative; height: {$virtualizer.getTotalSize()}px; width: 100%;"
    >
      {#each $virtualizer.getVirtualItems() as row (row.index)}
        <div
          class:sticky={isSticky(row.index)}
          class:active={isActiveSticky(row.index)}
          style={`top: 0; left: 0; width: 100%; height: ${row.size}px; ${
            !isActiveSticky(row.index)
              ? `position: absolute; transform: translateY(${row.start}px);`
              : ''
          }`}
        >
          {rows[row.index]}
        </div>
      {/each}
    </div>
  </div>
</main>

<style>
  .scroll-container {
    height: 200px;
    width: 400px;
    overflow: auto;
  }
  .sticky {
    position: absolute;
    background: #fff;
    border-bottom: 1px solid #ddd;
    z-index: 1;
  }
  .sticky.active {
    position: sticky;
  }
</style>
