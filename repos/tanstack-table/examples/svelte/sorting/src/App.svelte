<script lang="ts">
  import { writable } from 'svelte/store'
  import {
    createSvelteTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
  } from '@tanstack/svelte-table'
  import type {
    ColumnDef,
    OnChangeFn,
    SortingState,
    TableOptions,
  } from '@tanstack/svelte-table'
  import { makeData, type Person } from './makeData'
  import './index.css'

  const columns: ColumnDef<Person>[] = [
    {
      header: 'Name',
      footer: props => props.column.id,
      columns: [
        {
          accessorKey: 'firstName',
          cell: info => info.getValue(),
          footer: props => props.column.id,
        },
        {
          accessorFn: row => row.lastName,
          id: 'lastName',
          cell: info => info.getValue(),
          header: () => 'Last Name',
          footer: props => props.column.id,
        },
      ],
    },
    {
      header: 'Info',
      footer: props => props.column.id,
      columns: [
        {
          accessorKey: 'age',
          header: () => 'Age',
          footer: props => props.column.id,
        },
        {
          header: 'More Info',
          columns: [
            {
              accessorKey: 'visits',
              header: () => 'Visits',
              footer: props => props.column.id,
            },
            {
              accessorKey: 'status',
              header: 'Status',
              footer: props => props.column.id,
            },
            {
              accessorKey: 'progress',
              header: 'Profile Progress',
              footer: props => props.column.id,
            },
          ],
        },
      ],
    },
  ]

  const data = makeData(100_000)

  let sorting: SortingState = []

  const setSorting: OnChangeFn<SortingState> = updater => {
    if (updater instanceof Function) {
      sorting = updater(sorting)
    } else {
      sorting = updater
    }
    options.update(old => ({
      ...old,
      state: {
        ...old.state,
        sorting,
      },
    }))
  }

  const options = writable<TableOptions<Person>>({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: true,
  })

  const refreshData = () => {
    console.info('refresh')
    options.update(prev => ({
      ...prev,
      data: makeData(100_000),
    }))
  }

  const rerender = () => {
    options.update(options => ({
      ...options,
      data,
    }))
  }

  const table = createSvelteTable(options)
</script>

<div class="p-2">
  <div class="h-2" />
  <table>
    <thead>
      {#each $table.getHeaderGroups() as headerGroup}
        <tr>
          {#each headerGroup.headers as header}
            <th colSpan={header.colSpan}>
              {#if !header.isPlaceholder}
                <div
                  class:cursor-pointer={header.column.getCanSort()}
                  class:select-none={header.column.getCanSort()}
                  on:click={header.column.getToggleSortingHandler()}
                >
                  <svelte:component
                    this={flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  />
                  {#if header.column.getIsSorted().toString() === 'asc'}
                    🔼
                  {:else if header.column.getIsSorted().toString() === 'desc'}
                    🔽
                  {/if}
                </div>
              {/if}
            </th>
          {/each}
        </tr>
      {/each}
    </thead>
    <tbody>
      {#each $table.getRowModel().rows.slice(0, 10) as row}
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
    <tfoot>
      {#each $table.getFooterGroups() as footerGroup}
        <tr>
          {#each footerGroup.headers as header}
            <th colSpan={header.colSpan}>
              {#if !header.isPlaceholder}
                <svelte:component
                  this={flexRender(
                    header.column.columnDef.footer,
                    header.getContext()
                  )}
                />
              {/if}
            </th>
          {/each}
        </tr>
      {/each}
    </tfoot>
  </table>
  <div>{$table.getRowModel().rows.length} Rows</div>
  <div>
    <button on:click={() => rerender()}>Force Rerender</button>
  </div>
  <div>
    <button on:click={() => refreshData()}>Refresh Data</button>
  </div>
  <pre>{JSON.stringify($table.getState().sorting, null, 2)}</pre>
</div>
