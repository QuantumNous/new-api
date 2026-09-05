<script setup lang="ts">
import {
  FlexRender,
  createColumnHelper,
  getCoreRowModel,
  getExpandedRowModel,
  useVueTable,
  type ExpandedState,
  type Row,
} from '@tanstack/vue-table'
import { Text, h, ref } from 'vue'
type Person = {
  firstName: string
  lastName: string
  age: number
  visits: number
  status: string
  progress: number
}
const defaultData: Person[] = [
  {
    firstName: 'tanner',
    lastName: 'linsley',
    age: 24,
    visits: 100,
    status: 'In Relationship',
    progress: 50,
  },
  {
    firstName: 'tandy',
    lastName: 'miller',
    age: 40,
    visits: 40,
    status: 'Single',
    progress: 80,
  },
  {
    firstName: 'joe',
    lastName: 'dirte',
    age: 45,
    visits: 20,
    status: 'Complicated',
    progress: 10,
  },
]
const columnHelper = createColumnHelper<Person>()
function renderExpanded(row: Row<Person>) {
  if (!row.getCanExpand()) {
    return h(Text, '🔵')
  }
  return h(
    'button',
    {
      onClick: row.getToggleExpandedHandler(),
      style: { cursor: 'pointer' },
    },
    row.getIsExpanded() ? '👇' : '👉'
  )
}
const columns = [
  columnHelper.group({
    header: 'Name',
    footer: props => props.column.id,
    columns: [
      columnHelper.display({
        id: 'expander',
        header: () => null,
        cell: ({ row }) => renderExpanded(row),
      }),
      columnHelper.accessor('firstName', {
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
const data = ref(defaultData)
const expanded = ref<ExpandedState>({})
const rerender = () => {
  data.value = defaultData
}
const table = useVueTable({
  get data() {
    return data.value
  },
  state: {
    get expanded() {
      return expanded.value
    },
  },
  columns,
  getRowCanExpand: () => true,
  getCoreRowModel: getCoreRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  onExpandedChange: updaterOrValue => {
    expanded.value =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(expanded.value)
        : updaterOrValue
  },
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
        <template v-for="row in table.getRowModel().rows" :key="row.id">
          <tr>
            <td v-for="cell in row.getVisibleCells()" :key="cell.id">
              <FlexRender
                :render="cell.column.columnDef.cell"
                :props="cell.getContext()"
              />
            </td>
          </tr>
          <tr v-if="row.getIsExpanded()">
            <td :colspan="row.getAllCells().length">
              <pre :style="{ fontSize: '10px' }">
                  <code>{{ JSON.stringify(row.original, null, 2) }}</code>
                </pre>
            </td>
          </tr>
        </template>
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
