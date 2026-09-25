<script setup lang="ts">
import './index.css'
import { computed, ref, h } from 'vue'
import {
  type ColumnDef,
  FlexRender,
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/vue-table'
import { useVirtualizer } from '@tanstack/vue-virtual'

import { makeData, type Person } from './makeData'

const search = ref('')

const data = ref<Person[]>(makeData(50_000))

const filteredData = computed<Person[]>(() => {
  const searchValue = search.value.toLowerCase()

  // If no search value is present, return all data
  if (!searchValue) return data.value

  return data.value.filter(row => {
    return Object.values(row).some(value => {
      if (value instanceof Date) {
        return value.toLocaleString().toLowerCase().includes(searchValue)
      }
      // Stringify the value and check if it contains the search term
      return `${value}`.toLowerCase().includes(searchValue)
    })
  })
})

let searchTimeout: NodeJS.Timeout
function handleDebounceSearch(ev: Event) {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  searchTimeout = setTimeout(() => {
    search.value = (ev?.target as HTMLInputElement)?.value ?? ''
  }, 300)
}

const columns = computed<ColumnDef<Person>[]>(() => [
  {
    accessorKey: 'id',
    header: 'ID',
  },
  {
    accessorKey: 'firstName',
    cell: info => info.getValue(),
  },
  {
    accessorFn: row => row.lastName,
    id: 'lastName',
    cell: info => info.getValue(),
    header: () => h('span', 'Last Name'),
  },
  {
    accessorKey: 'age',
    header: () => 'Age',
  },
  {
    accessorKey: 'visits',
    header: () => h('span', 'Visits'),
  },
  {
    accessorKey: 'status',
    header: 'Status',
  },
  {
    accessorKey: 'progress',
    header: 'Profile Progress',
  },
  {
    accessorKey: 'createdAt',
    header: 'Created At',
    cell: info => info.getValue<Date>().toLocaleString(),
  },
])

const table = useVueTable({
  get data() {
    return filteredData.value
  },
  columns: columns.value,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  debugTable: false,
})

const rows = computed(() => table.getRowModel().rows)

//The virtualizer needs to know the scrollable container element
const tableContainerRef = ref<HTMLDivElement | null>(null)

const rowVirtualizerOptions = computed(() => {
  return {
    count: rows.value.length,
    estimateSize: () => 33, //estimate row height for accurate scrollbar dragging
    getScrollElement: () => tableContainerRef.value,
    overscan: 5,
  }
})

const rowVirtualizer = useVirtualizer(rowVirtualizerOptions)

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())
const totalSize = computed(() => rowVirtualizer.value.getTotalSize())

function measureElement(el?: Element) {
  if (!el) {
    return
  }

  rowVirtualizer.value.measureElement(el)

  return undefined
}
</script>

<template>
  <div>
    <p class="text-center">
      For tables, the basis for the offset of the translate css function is from
      the row's initial position itself. Because of this, we need to calculate
      the translateY pixel count different and base it off the the index.
    </p>
    <h1 class="text-3xl font-bold text-center">Virtualized Rows</h1>
    <div style="margin: 0 auto; width: min-content">
      <input
        :modelValue="search"
        @input="handleDebounceSearch"
        placeholder="Search"
        class="p-2"
      />
      {{ rows.length.toLocaleString() }} results
    </div>
  </div>
  <div
    class="container"
    ref="tableContainerRef"
    :style="{
      overflow: 'auto', //our scrollable table container
      position: 'relative', //needed for sticky header
      height: '800px', //should be a fixed height
    }"
  >
    <div :style="{ height: `${totalSize}px` }">
      <!-- Even though we're still using sematic table tags, we must use CSS grid and flexbox for dynamic row heights -->
      <table :style="{ display: 'grid' }">
        <thead
          :style="{
            display: 'grid',
            position: 'sticky',
            top: 0,
            zIndex: 1,
          }"
        >
          <tr
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
            :style="{ display: 'flex', width: '100%' }"
          >
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              :colspan="header.colSpan"
              :style="{ width: `${header.getSize()}px` }"
            >
              <div
                v-if="!header.isPlaceholder"
                :class="{
                  'cursor-pointer select-none': header.column.getCanSort(),
                }"
                @click="e => header.column.getToggleSortingHandler()?.(e)"
              >
                <FlexRender
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
                <span v-if="header.column.getIsSorted() === 'asc'"> 🔼</span>
                <span v-if="header.column.getIsSorted() === 'desc'"> 🔽</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody
          :style="{
            display: 'grid',
            height: `${totalSize}px`, //tells scrollbar how big the table is
            position: 'relative', //needed for absolute positioning of rows
          }"
        >
          <tr
            v-for="vRow in virtualRows"
            :data-index="
              vRow.index /* needed for dynamic row height measurement*/
            "
            :ref="measureElement /*measure dynamic row height*/"
            :key="rows[vRow.index].id"
            :style="{
              display: 'flex',
              position: 'absolute',
              transform: `translateY(${vRow.start}px)`, //this should always be a `style` as it changes on scroll
              width: '100%',
            }"
          >
            <td
              v-for="cell in rows[vRow.index].getVisibleCells()"
              :key="cell.id"
              :style="{
                display: 'flex',
                width: `${cell.column.getSize()}px`,
              }"
            >
              <FlexRender
                :render="cell.column.columnDef.cell"
                :props="cell.getContext()"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
