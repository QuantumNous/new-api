<script setup lang="ts">
import {
  createColumnHelper,
  FlexRender,
  getCoreRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import type {
  Column,
  ColumnOrderState,
  ColumnPinningState,
} from '@tanstack/vue-table'

import { makeData, type Person } from './makeData'
import { ref } from 'vue'
import { faker } from '@faker-js/faker'

const data = ref(makeData(5000))

const columnHelper = createColumnHelper<Person>()

const columns = ref([
  columnHelper.group({
    // id: 'Name',
    header: 'Name',
    footer: props => props.column.id,
    columns: [
      columnHelper.accessor('firstName', {
        cell: info => info.getValue(),
        footer: props => props.column.id,
      }),
      columnHelper.accessor(row => row.lastName, {
        id: 'lastName',
        cell: info => info.getValue(),
        header: () => 'Last Name',
        footer: props => props.column.id,
      }),
    ],
  }),
  columnHelper.group({
    header: 'Info',
    footer: props => props.column.id,
    columns: [
      columnHelper.accessor('age', {
        header: () => 'Age',
        footer: props => props.column.id,
      }),
      columnHelper.group({
        header: 'More Info',
        columns: [
          columnHelper.accessor('visits', {
            header: () => 'Visits',
            footer: props => props.column.id,
          }),
          columnHelper.accessor('status', {
            header: 'Status',
            footer: props => props.column.id,
          }),
          columnHelper.accessor('progress', {
            header: 'Profile Progress',
            footer: props => props.column.id,
          }),
        ],
      }),
    ],
  }),
])

const columnVisibility = ref({})
const columnOrder = ref<ColumnOrderState>([])

const columnPinning = ref<ColumnPinningState>({})
const isSplit = ref(false)

const rerender = () => (data.value = makeData(5000))

const table = useVueTable({
  get data() {
    return data.value
  },
  get columns() {
    return columns.value
  },
  state: {
    get columnVisibility() {
      return columnVisibility.value
    },
    get columnOrder() {
      return columnOrder.value
    },
    get columnPinning() {
      return columnPinning.value
    },
  },

  onColumnOrderChange: order => {
    columnOrder.value =
      order instanceof Function ? order(columnOrder.value) : order
  },
  onColumnPinningChange: pinning => {
    columnPinning.value =
      pinning instanceof Function ? pinning(columnPinning.value) : pinning
  },
  getCoreRowModel: getCoreRowModel(),
  debugTable: true,
  debugHeaders: true,
  debugColumns: true,
})

const randomizeColumns = () => {
  table.setColumnOrder(
    faker.helpers.shuffle(table.getAllLeafColumns().map(d => d.id))
  )
}

function toggleColumnVisibility(column: Column<any, any>) {
  columnVisibility.value = {
    ...columnVisibility.value,
    [column.id]: !column.getIsVisible(),
  }
}

function toggleAllColumnsVisibility() {
  table.getAllLeafColumns().forEach(column => {
    toggleColumnVisibility(column)
  })
}
</script>

<template>
  <div class="p-2">
    <div class="inline-block border border-black rounded shadow">
      <div class="px-1 border-b border-black">
        <label>
          <input
            type="checkbox"
            :checked="table.getIsAllColumnsVisible()"
            @input="toggleAllColumnsVisibility"
          />
          Toggle All
        </label>
      </div>
      <div
        v-for="column in table.getAllLeafColumns()"
        :key="column.id"
        class="px-1"
      >
        <label>
          <input
            type="checkbox"
            :checked="column.getIsVisible()"
            @input="toggleColumnVisibility(column)"
          />
          {{ column.id }}
        </label>
      </div>
    </div>
    <div class="h-4" />
    <div class="flex flex-wrap gap-2">
      <button @click="rerender" class="p-1 border">Regenerate</button>
      <button @click="randomizeColumns" class="p-1 border">
        Shuffle Columns
      </button>
    </div>
    <div class="h-4" />
    <div>
      <label>
        <input type="checkbox" v-model="isSplit" />
        Split Mode
      </label>
    </div>
    <div class="h-4" />
    <div :class="`flex ${isSplit ? 'gap-4' : ''}`">
      <!-- left -->
      <table v-if="isSplit" class="border-2 border-black table-left">
        <thead>
          <tr
            v-for="headerGroup in table.getLeftHeaderGroups()"
            :key="headerGroup.id"
          >
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              :colSpan="header.colSpan"
            >
              <div class="whitespace-nowrap">
                <FlexRender
                  v-if="!header.isPlaceholder"
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
              </div>
              <div
                v-if="!header.isPlaceholder && header.column.getCanPin()"
                class="flex justify-center gap-1"
              >
                <button
                  v-if="header.column.getIsPinned() !== 'left'"
                  @click="header.column.pin('left')"
                  class="px-2 border rounded"
                >
                  {{ '<=' }}
                </button>
                <button
                  v-if="header.column.getIsPinned()"
                  @click="header.column.pin(false)"
                  class="px-2 border rounded"
                >
                  X
                </button>
                <button
                  v-if="header.column.getIsPinned() !== 'right'"
                  @click="header.column.pin('right')"
                  class="px-2 border rounded"
                >
                  {{ '=>' }}
                </button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in table.getRowModel().rows.slice(0, 20)"
            :key="row.id"
          >
            <td v-for="cell in row.getLeftVisibleCells()" :key="cell.id">
              <FlexRender
                :render="cell.column.columnDef.cell"
                :props="cell.getContext()"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <!-- center -->
      <table class="border-2 border-black table-center">
        <thead>
          <tr
            v-for="headerGroup in isSplit
              ? table.getCenterHeaderGroups()
              : table.getHeaderGroups()"
            :key="headerGroup.id"
          >
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              :colSpan="header.colSpan"
            >
              <div class="whitespace-nowrap">
                <FlexRender
                  v-if="!header.isPlaceholder"
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
              </div>
              <div
                v-if="!header.isPlaceholder && header.column.getCanPin()"
                class="flex justify-center gap-1"
              >
                <button
                  v-if="header.column.getIsPinned() !== 'left'"
                  @click="header.column.pin('left')"
                  class="px-2 border rounded"
                >
                  {{ '<=' }}
                </button>
                <button
                  v-if="header.column.getIsPinned()"
                  @click="header.column.pin(false)"
                  class="px-2 border rounded"
                >
                  X
                </button>
                <button
                  v-if="header.column.getIsPinned() !== 'right'"
                  @click="header.column.pin('right')"
                  class="px-2 border rounded"
                >
                  {{ '=>' }}
                </button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in table.getRowModel().rows.slice(0, 20)"
            :key="row.id"
          >
            <td
              v-for="cell in isSplit
                ? row.getCenterVisibleCells()
                : row.getVisibleCells()"
              :key="cell.id"
            >
              <FlexRender
                :render="cell.column.columnDef.cell"
                :props="cell.getContext()"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <!-- right -->
      <table v-if="isSplit" class="border-2 border-black table-right">
        <thead>
          <tr
            v-for="headerGroup in table.getRightHeaderGroups()"
            :key="headerGroup.id"
          >
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              :colSpan="header.colSpan"
            >
              <div class="whitespace-nowrap">
                <FlexRender
                  v-if="!header.isPlaceholder"
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
              </div>
              <div
                v-if="!header.isPlaceholder && header.column.getCanPin()"
                class="flex justify-center gap-1"
              >
                <button
                  v-if="header.column.getIsPinned() !== 'left'"
                  @click="header.column.pin('left')"
                  class="px-2 border rounded"
                >
                  {{ '<=' }}
                </button>
                <button
                  v-if="header.column.getIsPinned()"
                  @click="header.column.pin(false)"
                  class="px-2 border rounded"
                >
                  X
                </button>
                <button
                  v-if="header.column.getIsPinned() !== 'right'"
                  @click="header.column.pin('right')"
                  class="px-2 border rounded"
                >
                  {{ '=>' }}
                </button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in table.getRowModel().rows.slice(0, 20)"
            :key="row.id"
          >
            <td v-for="cell in row.getRightVisibleCells()" :key="cell.id">
              <FlexRender
                :render="cell.column.columnDef.cell"
                :props="cell.getContext()"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <pre>{{ JSON.stringify(table.getState().columnOrder, null, 2) }}</pre>
  </div>
</template>

<style>
html,
body {
  padding: 4px;
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
}

table {
  border: 1px solid lightgray;
  border-collapse: collapse;
}

tbody {
  border-bottom: 1px solid lightgray;
}

th,
td {
  border-bottom: 1px solid lightgray;
  border-right: 1px solid lightgray;
  padding: 2px 4px;
}

th {
  padding: 8px;
}

tfoot {
  color: gray;
}

tfoot th {
  font-weight: normal;
}
</style>
