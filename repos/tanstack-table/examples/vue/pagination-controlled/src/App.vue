<script setup lang="ts">
import { ref } from 'vue'

import {
  FlexRender,
  getCoreRowModel,
  useVueTable,
  createColumnHelper,
  PaginationState,
} from '@tanstack/vue-table'

import useService from './useService'

type Post = {
  userId: number
  id: number
  title: string
  body: string
}

const INITIAL_PAGE_INDEX = 0
const INITIAL_PAGE_SIZE = 10

const columnHelper = createColumnHelper<Post>()

const columns = [
  columnHelper.accessor('id', { header: 'Post ID' }),
  columnHelper.accessor('title', { header: 'Title' }),
]

const pageSizes = [10, 20, 30, 40, 50]

const pagination = ref<PaginationState>({
  pageIndex: INITIAL_PAGE_INDEX,
  pageSize: INITIAL_PAGE_SIZE,
})

const goToPageNumber = ref(INITIAL_PAGE_INDEX + 1)

const { data, isLoading, pageCount } = useService(pagination)

const table = useVueTable({
  get data() {
    return data.value ?? []
  },
  get pageCount() {
    return pageCount.value ?? -1
  },
  columns,
  state: {
    pagination: pagination.value,
  },
  manualPagination: true,
  onPaginationChange: updater => {
    if (typeof updater === 'function') {
      setPagination(
        updater({
          pageIndex: pagination.value.pageIndex,
          pageSize: pagination.value.pageSize,
        })
      )
    } else {
      setPagination(updater)
    }
  },
  getCoreRowModel: getCoreRowModel(),
  debugTable: true,
})

function setPagination({
  pageIndex,
  pageSize,
}: PaginationState): PaginationState {
  pagination.value.pageIndex = pageIndex
  pagination.value.pageSize = pageSize

  return { pageIndex, pageSize }
}

function handleGoToPage(e: any) {
  const page = e.target.value ? Number(e.target.value) - 1 : 0
  goToPageNumber.value = page + 1
  table.setPageIndex(page)
}

function handlePageSizeChange(e: any) {
  table.setPageSize(Number(e.target.value))
}
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
    </table>
    <div className="h-2">
      <div className="flex items-center gap-2">
        <button
          className="border rounded p-1"
          @click="() => table.setPageIndex(0)"
          :disabled="!table.getCanPreviousPage()"
        >
          «
        </button>
        <button
          className="border rounded p-1"
          @click="() => table.previousPage()"
          :disabled="!table.getCanPreviousPage()"
        >
          ‹
        </button>
        <button
          className="border rounded p-1"
          @click="() => table.nextPage()"
          :disabled="!table.getCanNextPage()"
        >
          ›
        </button>
        <button
          className="border rounded p-1"
          @click="() => table.setPageIndex(table.getPageCount() - 1)"
          :disabled="!table.getCanNextPage()"
        >
          »
        </button>
        <span className="flex items-center gap-1">
          <div>Page</div>
          <strong>
            {{ table.getState().pagination.pageIndex + 1 }} of
            {{ table.getPageCount() }}
          </strong>
        </span>
        <span className="flex items-center gap-1">
          | Go to page:
          <input
            type="number"
            :value="goToPageNumber"
            @change="handleGoToPage"
            className="border p-1 rounded w-16"
          />
        </span>
        <select
          :value="table.getState().pagination.pageSize"
          @change="handlePageSizeChange"
        >
          <option
            :key="pageSize"
            :value="pageSize"
            v-for="pageSize in pageSizes"
          >
            Show {{ pageSize }}
          </option>
        </select>
        {{ isLoading ? 'Loading...' : null }}
      </div>
      <pre>{{ JSON.stringify(pagination, null, 2) }}</pre>
    </div>
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
