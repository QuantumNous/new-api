<script setup lang="ts">
import {
  type ColumnOrderState,
  FlexRender,
  getCoreRowModel,
  useVueTable,
  type Column,
  createColumnHelper,
} from '@tanstack/vue-table'

import { makeData, type Person } from './makeData'
import { ref } from 'vue'
import { faker } from '@faker-js/faker'

const columnHelper = createColumnHelper<Person>()

const data = ref(makeData(20))
const columns = ref([
  columnHelper.group({
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

const rerender = () => (data.value = makeData(20))

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
  },

  onColumnOrderChange: order => {
    columnOrder.value =
      order instanceof Function ? order(columnOrder.value) : order
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
    <div class="inline-block border border-black shadow rounded">
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
      <button @click="rerender" class="border p-1">Regenerate</button>
      <button @click="randomizeColumns" class="border p-1">
        Shuffle Columns
      </button>
    </div>
    <div class="h-4" />

    <table>
      <thead>
        <tr
          v-for="headerGroup in table.getHeaderGroups()"
          :key="headerGroup.id"
        >
          <th
            v-for="header in headerGroup.headers"
            :key="header.id"
            :colSpan="header.colSpan"
          >
            <FlexRender
              v-if="!header.isPlaceholder"
              :render="header.column.columnDef.header"
              :props="header.getContext()"
            />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in table.getRowModel().rows" :key="row.id">
          <td v-for="cell in row.getVisibleCells()" :key="cell.id">
            <FlexRender
              :render="cell.column.columnDef.cell"
              :props="cell.getContext()"
            />
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr
          v-for="footerGroup in table.getFooterGroups()"
          :key="footerGroup.id"
        >
          <th
            v-for="header in footerGroup.headers"
            :key="header.id"
            :colSpan="header.colSpan"
          >
            <FlexRender
              v-if="!header.isPlaceholder"
              :render="header.column.columnDef.footer"
              :props="header.getContext()"
            />
          </th>
        </tr>
      </tfoot>
    </table>
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
