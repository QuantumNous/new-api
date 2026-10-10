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
    ColumnOrderState,
    ColumnPinningState,
    OnChangeFn,
    TableOptions,
    VisibilityState,
  } from '@tanstack/svelte-table'
  import { makeData, type Person } from './makeData'
  import { faker } from '@faker-js/faker'
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

  const data = makeData(5000)

  let isSplit = false

  let columnOrder: ColumnOrderState = []
  let columnPinning: ColumnPinningState = {}
  let columnVisibility: VisibilityState = {}

  const setColumnOrder: OnChangeFn<ColumnOrderState> = updater => {
    if (updater instanceof Function) {
      columnOrder = updater(columnOrder)
    } else {
      columnOrder = updater
    }
    options.update(old => ({
      ...old,
      state: {
        ...old.state,
        columnOrder,
      },
    }))
  }

  const setColumnPinning: OnChangeFn<ColumnPinningState> = updater => {
    if (updater instanceof Function) {
      columnPinning = updater(columnPinning)
    } else {
      columnPinning = updater
    }
    options.update(old => ({
      ...old,
      state: {
        ...old.state,
        columnPinning,
      },
    }))
  }

  const setColumnVisibility: OnChangeFn<VisibilityState> = updater => {
    if (updater instanceof Function) {
      columnVisibility = updater(columnVisibility)
    } else {
      columnVisibility = updater
    }
    options.update(old => ({
      ...old,
      state: {
        ...old.state,
        columnVisibility,
      },
    }))
  }

  const options = writable<TableOptions<Person>>({
    data,
    columns,
    state: {
      columnOrder,
      columnPinning,
      columnVisibility,
    },
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: true,
  })

  const randomizeColumns = () => {
    $table.setColumnOrder(_updater =>
      faker.helpers.shuffle($table.getAllLeafColumns().map(d => d.id))
    )
  }

  const regenerate = () => {
    options.update(options => ({
      ...options,
      data: makeData(5000),
    }))
  }

  const table = createSvelteTable(options)
</script>

<div class="p-2">
  <div class="inline-block border border-black shadow rounded">
    <div class="px-1 border-b border-black">
      <label>
        <input
          checked={$table.getIsAllColumnsVisible()}
          on:change={e => {
            console.info($table.getToggleAllColumnsVisibilityHandler()(e))
          }}
          type="checkbox"
        />{' '}
        Toggle All
      </label>
    </div>
    {#each $table.getAllLeafColumns() as column}
      <div class="px-1">
        <label>
          <input
            checked={column.getIsVisible()}
            on:change={column.getToggleVisibilityHandler()}
            type="checkbox"
          />{' '}
          {column.id}
        </label>
      </div>
    {/each}
  </div>
  <div class="h-4" />
  <div class="flex flex-wrap gap-2">
    <button on:click={() => regenerate()} class="border p-1">
      Regenerate
    </button>
    <button on:click={() => randomizeColumns()} class="border p-1">
      Shuffle Columns
    </button>
  </div>
  <div class="h-4" />
  <div>
    <label>
      <input
        type="checkbox"
        checked={isSplit}
        on:change={e => (isSplit = e.currentTarget.checked)}
      />{' '}
      Split Mode
    </label>
  </div>
  <div class={`flex ${isSplit ? 'gap-4' : ''}`}>
    {#if isSplit}
      <table class="border-2 border-black">
        <thead>
          {#each $table.getLeftHeaderGroups() as headerGroup}
            <tr>
              {#each headerGroup.headers as header}
                <th colSpan={header.colSpan}>
                  <div class="whitespace-nowrap">
                    {#if !header.isPlaceholder}
                      <svelte:component
                        this={flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      />
                    {/if}
                  </div>
                  {#if !header.isPlaceholder && header.column.getCanPin()}
                    <div class="flex gap-1 justify-center">
                      {#if header.column.getIsPinned() !== 'left'}
                        <button
                          class="border rounded px-2"
                          on:click={() => {
                            header.column.pin('left')
                          }}
                        >
                          {'<='}
                        </button>
                      {/if}
                      {#if header.column.getIsPinned()}
                        <button
                          class="border rounded px-2"
                          on:click={() => {
                            header.column.pin(false)
                          }}
                        >
                          X
                        </button>
                      {/if}
                      {#if header.column.getIsPinned() !== 'right'}
                        <button
                          class="border rounded px-2"
                          on:click={() => {
                            header.column.pin('right')
                          }}
                        >
                          {'=>'}
                        </button>
                      {/if}
                    </div>
                  {/if}
                </th>
              {/each}
            </tr>
          {/each}
        </thead>
        <tbody>
          {#each $table.getCoreRowModel().rows.slice(0, 20) as row}
            <tr>
              {#each row.getLeftVisibleCells() as cell}
                <td>
                  <svelte:component
                    this={flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  />
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    <table class="border-2 border-black">
      <thead>
        {#each isSplit ? $table.getCenterHeaderGroups() : $table.getHeaderGroups() as headerGroup}
          <tr>
            {#each headerGroup.headers as header}
              <th colSpan={header.colSpan}>
                <div class="whitespace-nowrap">
                  {#if !header.isPlaceholder}
                    <svelte:component
                      this={flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    />
                  {/if}
                </div>
                {#if !header.isPlaceholder && header.column.getCanPin()}
                  <div class="flex gap-1 justify-center">
                    {#if header.column.getIsPinned() !== 'left'}
                      <button
                        class="border rounded px-2"
                        on:click={() => {
                          header.column.pin('left')
                        }}
                      >
                        {'<='}
                      </button>
                    {/if}
                    {#if header.column.getIsPinned()}
                      <button
                        class="border rounded px-2"
                        on:click={() => {
                          header.column.pin(false)
                        }}
                      >
                        X
                      </button>
                    {/if}
                    {#if header.column.getIsPinned() !== 'right'}
                      <button
                        class="border rounded px-2"
                        on:click={() => {
                          header.column.pin('right')
                        }}
                      >
                        {'=>'}
                      </button>
                    {/if}
                  </div>
                {/if}
              </th>
            {/each}
          </tr>
        {/each}
      </thead>
      <tbody>
        {#each $table.getCoreRowModel().rows.slice(0, 20) as row}
          <tr>
            {#each isSplit ? row.getCenterVisibleCells() : row.getVisibleCells() as cell}
              <td>
                <svelte:component
                  this={flexRender(
                    cell.column.columnDef.cell,
                    cell.getContext()
                  )}
                />
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
    {#if isSplit}
      <table class="border-2 border-black">
        <thead>
          {#each $table.getRightHeaderGroups() as headerGroup}
            <tr>
              {#each headerGroup.headers as header}
                <th colSpan={header.colSpan}>
                  <div class="whitespace-nowrap">
                    {#if !header.isPlaceholder}
                      <svelte:component
                        this={flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      />
                    {/if}
                  </div>
                  {#if !header.isPlaceholder && header.column.getCanPin()}
                    <div class="flex gap-1 justify-center">
                      {#if header.column.getIsPinned() !== 'left'}
                        <button
                          class="border rounded px-2"
                          on:click={() => {
                            header.column.pin('left')
                          }}
                        >
                          {'<='}
                        </button>
                      {/if}
                      {#if header.column.getIsPinned()}
                        <button
                          class="border rounded px-2"
                          on:click={() => {
                            header.column.pin(false)
                          }}
                        >
                          X
                        </button>
                      {/if}
                      {#if header.column.getIsPinned() !== 'right'}
                        <button
                          class="border rounded px-2"
                          on:click={() => {
                            header.column.pin('right')
                          }}
                        >
                          {'=>'}
                        </button>
                      {/if}
                    </div>
                  {/if}
                </th>
              {/each}
            </tr>
          {/each}
        </thead>
        <tbody>
          {#each $table.getRowModel().rows.slice(0, 20) as row}
            <tr>
              {#each row.getRightVisibleCells() as cell}
                <td>
                  <svelte:component
                    this={flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  />
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
  <pre>{JSON.stringify($table.getState().columnPinning, null, 2)}</pre>
</div>
