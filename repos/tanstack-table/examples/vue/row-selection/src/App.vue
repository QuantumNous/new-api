<script setup lang="tsx">
import {
  FlexRender,
  getCoreRowModel,
  useVueTable,
  createColumnHelper,
  RowSelectionState,
} from '@tanstack/vue-table'
import { ref } from 'vue'

import IndeterminateCheckbox from './IndeterminateCheckbox.vue'
import { makeData, Person } from './makeData'

const columnHelper = createColumnHelper<Person>()

const columns = [
  {
    id: 'select',
    header: ({ table }: { table: any }) => {
      return (
        <IndeterminateCheckbox
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
        ></IndeterminateCheckbox>
      )
    },
    cell: ({ row }: { row: any }) => {
      return (
        <div className="px-1">
          <IndeterminateCheckbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
          ></IndeterminateCheckbox>
        </div>
      )
    },
  },
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
]

const data = ref(makeData(10))
const rowSelection = ref<RowSelectionState>({})

const rerender = () => {
  data.value = makeData(10)
}

const table = useVueTable({
  get data() {
    return data.value
  },
  columns,
  state: {
    get rowSelection() {
      return rowSelection.value
    },
  },
  enableRowSelection: true, //enable row selection for all rows
  // enableRowSelection: row => row.original.age > 18, // or enable row selection conditionally per row
  onRowSelectionChange: updateOrValue => {
    rowSelection.value =
      typeof updateOrValue === 'function'
        ? updateOrValue(rowSelection.value)
        : updateOrValue
  },
  getCoreRowModel: getCoreRowModel(),
})
</script>

<template>
  <div class="p-2">
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
        <tr>
          <td className="p-1">
            <IndeterminateCheckbox
              :checked="table.getIsAllPageRowsSelected()"
              :indeterminate="table.getIsSomePageRowsSelected()"
              :onChange="table.getToggleAllPageRowsSelectedHandler()"
            />
          </td>
          <td :colSpan="20">Page Rows {{ table.getRowModel().rows.length }}</td>
        </tr>
      </tfoot>
    </table>
    <div class="h-4" />
    <button @click="rerender" class="border p-2">Rerender</button>
  </div>
</template>

<style>
html {
  font-family: sans-serif;
  font-size: 14px;
}

table {
  border: 1px solid lightgray;
}

tbody {
  border-bottom: 1px solid lightgray;
}

th {
  border-bottom: 1px solid lightgray;
  border-right: 1px solid lightgray;
  padding: 2px 4px;
}

tfoot {
  color: gray;
}

tfoot th {
  font-weight: normal;
}
</style>
