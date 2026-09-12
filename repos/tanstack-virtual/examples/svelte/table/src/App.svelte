<script lang="ts">
  import {
    createSvelteTable,
    getCoreRowModel,
    getSortedRowModel,
    type ColumnDef,
    type SortingState,
    type Updater,
    flexRender,
    type TableOptions,
  } from '@tanstack/svelte-table'
  import { createVirtualizer } from '@tanstack/svelte-virtual'
  import { makeData, type Person } from './makeData'
  import { writable } from 'svelte/store'

  let virtualListEl: HTMLDivElement
  let sorting: SortingState = []

  function setSorting(updater: Updater<SortingState>) {
    if (updater instanceof Function) sorting = updater(sorting)
    else sorting = updater

    tableOptions.update((opts) => ({
      ...opts,
      state: {
        ...opts.state,
        sorting,
      },
    }))
  }

  const columns: ColumnDef<Person>[] = [
    {
      accessorKey: 'id',
      header: 'ID',
      size: 60,
    },
    {
      accessorKey: 'firstName',
      header: 'First Name',
      cell: (info) => info.getValue(),
    },
    {
      accessorFn: (row) => row.lastName,
      id: 'lastName',
      header: 'Last Name',
      cell: (info) => info.getValue(),
    },
    {
      accessorKey: 'age',
      header: 'Age',
      size: 50,
    },
    {
      accessorKey: 'visits',
      header: 'Visits',
      size: 50,
    },
    {
      accessorKey: 'status',
      header: 'Status',
    },
    {
      accessorKey: 'progress',
      header: 'Profile Progress',
      size: 80,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created At',
      cell: (info) => info.getValue<Date>().toLocaleString(),
    },
  ]

  const tableOptions = writable<TableOptions<Person>>({
    data: makeData(50_000),
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: true,
  })

  const table = createSvelteTable(tableOptions)

  $: rows = $table.getRowModel().rows

  $: virtualizer = createVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rows.length,
    getScrollElement: () => virtualListEl,
    estimateSize: () => 34,
    overscan: 20,
  })
</script>

<main>
  <p>
    For tables, the basis for the offset of the translate css function is from
    the row's initial position itself. Because of this, we need to calculate the
    translateY pixel count differently and base it off the index.
  </p>

  <div class="list scroll-container" bind:this={virtualListEl}>
    <div style="position: relative; height: {$virtualizer.getTotalSize()}px;">
      <table>
        <thead>
          {#each $table.getHeaderGroups() as headerGroup (headerGroup.id)}
            <tr>
              {#each headerGroup.headers as header (header.id)}
                <th
                  colspan={header.colSpan}
                  style="width: {header.getSize()}px;"
                >
                  {#if !header.isPlaceholder}
                    <button
                      class:sortable-header={header.column.getCanSort()}
                      disabled={!header.column.getCanSort()}
                      on:click={header.column.getToggleSortingHandler()}
                    >
                      <svelte:component
                        this={flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      />
                      {#if header.column.getIsSorted()}
                        {header.column.getIsSorted() === 'desc' ? ' 🔽' : ' 🔼'}
                      {/if}
                    </button>
                  {/if}
                </th>
              {/each}
            </tr>
          {/each}
        </thead>
        <tbody>
          {#each $virtualizer.getVirtualItems() as row, idx (row.index)}
            <tr
              style="height: {row.size}px; transform: translateY({row.start -
                idx * row.size}px);"
            >
              {#each rows[row.index].getVisibleCells() as cell (cell.id)}
                <td>
                  <svelte:component
                    this={flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    )}
                  />
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</main>

<style>
  button {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    outline: inherit;
  }

  .scroll-container {
    height: 600px;
    width: 100%;
    overflow: auto;
  }
  .sortable-header {
    cursor: pointer;
    user-select: none;
  }
</style>
