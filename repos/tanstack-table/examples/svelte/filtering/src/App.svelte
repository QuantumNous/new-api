<script lang="ts">
  import './index.css'
  import { writable } from 'svelte/store'

  import './index.css'

  import {
    createSvelteTable,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
  } from '@tanstack/svelte-table'

  import type {
    ColumnDef,
    TableOptions,
    FilterFn,
  } from '@tanstack/svelte-table'

  import { rankItem } from '@tanstack/match-sorter-utils'

  import { makeData, type Person } from './makeData'

  let globalFilter = ''

  const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
    // Rank the item
    const itemRank = rankItem(row.getValue(columnId), value)

    // Store the itemRank info
    addMeta({ itemRank })

    // Return if the item should be filtered in/out
    return itemRank.passed
  }

  let columns: ColumnDef<Person>[] = [
    {
      accessorFn: row => `${row.firstName} ${row.lastName}`,
      id: 'fullName',
      header: 'Name',
      cell: info => info.getValue(),
      footer: props => props.column.id,
      filterFn: 'fuzzy',
    },
  ]

  const options = writable<TableOptions<any>>({
    data: makeData(25),
    columns,
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    enableMultiRowSelection: true,
    getPaginationRowModel: getPaginationRowModel(),
    getCoreRowModel: getCoreRowModel(),
    globalFilterFn: fuzzyFilter,
    getFilteredRowModel: getFilteredRowModel(),
  })

  const table = createSvelteTable(options)

  const handleKeyUp = (e: any) => {
    $table.setGlobalFilter(String(e?.target?.value))
  }
</script>

<input
  type="text"
  placeholder="Global filter"
  class="border w-full p-1"
  bind:value={globalFilter}
  on:keyup={handleKeyUp}
/>
<div class="h-2" />
<table class="w-full">
  <thead>
    {#each $table.getHeaderGroups() as headerGroup}
      <tr>
        {#each headerGroup.headers as header, idx}
          <th scope="col">
            {#if !header.isPlaceholder}
              <svelte:component
                this={flexRender(
                  header.column.columnDef.header,
                  header.getContext()
                )}
              />
            {/if}
          </th>
        {/each}
      </tr>
    {/each}
  </thead>
  <tbody>
    {#each $table.getRowModel().rows as row}
      <tr>
        {#each row.getVisibleCells() as cell}
          <td>
            <svelte:component
              this={flexRender(cell.column.columnDef.cell, cell.getContext())}
            />
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>
<div class="h-2" />
<pre>"globalFilter": "{$table.getState().globalFilter}"</pre>
