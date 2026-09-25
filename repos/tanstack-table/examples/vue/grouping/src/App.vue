<script setup lang="ts">
import {
  FlexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  useVueTable,
  type ColumnDef,
  type ExpandedState,
  type GroupingState,
} from '@tanstack/vue-table'
import { ref } from 'vue'

// Define task type
interface Task {
  id: string
  title: string
  description: string
  status: { id: string; name: string }
  priority: { id: string; name: string }
  dueDate: string
}

// Dummy data
const tasks: Task[] = [
  {
    id: '1',
    title: 'Implement Authentication',
    description: 'Set up OAuth2 with JWT tokens',
    status: { id: 's1', name: 'In Progress' },
    priority: { id: 'p1', name: 'High' },
    dueDate: '2023-09-15',
  },
  {
    id: '2',
    title: 'Create Dashboard UI',
    description: 'Design and implement main dashboard',
    status: { id: 's2', name: 'To Do' },
    priority: { id: 'p2', name: 'Medium' },
    dueDate: '2023-09-20',
  },
  {
    id: '3',
    title: 'API Documentation',
    description: 'Document all API endpoints using Swagger',
    status: { id: 's1', name: 'In Progress' },
    priority: { id: 'p1', name: 'High' },
    dueDate: '2023-09-10',
  },
  {
    id: '4',
    title: 'Database Optimization',
    description: 'Improve query performance and add indexes',
    status: { id: 's3', name: 'Done' },
    priority: { id: 'p3', name: 'Low' },
    dueDate: '2023-08-30',
  },
  {
    id: '5',
    title: 'User Testing',
    description: 'Conduct user testing sessions',
    status: { id: 's2', name: 'To Do' },
    priority: { id: 'p2', name: 'Medium' },
    dueDate: '2023-09-25',
  },
]

// Define columns
const columns: ColumnDef<Task>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => row.original.title,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableGrouping: true,
    accessorFn: row => row.status.name,
    cell: ({ row }) => row.original.status.name,
  },
  {
    accessorKey: 'priority',
    header: 'Priority',
    enableGrouping: true,
    accessorFn: row => row.priority.name,
    cell: ({ row }) => row.original.priority.name,
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => row.original.description,
  },
  {
    accessorKey: 'dueDate',
    header: 'Due Date',
    cell: ({ row }) => new Date(row.original.dueDate).toLocaleDateString(),
  },
]

// State for grouping
const grouping = ref<GroupingState>([])
const expanded = ref<ExpandedState>({})

// Initialize table
const table = useVueTable({
  data: tasks,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getGroupedRowModel: getGroupedRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  state: {
    get grouping() {
      return grouping.value
    },
    get expanded() {
      return expanded.value
    },
  },
  onGroupingChange: updaterOrValue => {
    grouping.value =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(grouping.value)
        : updaterOrValue
  },
  onExpandedChange: updaterOrValue => {
    expanded.value =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(expanded.value)
        : updaterOrValue
  },
})

// Group by status
const groupByStatus = (): void => {
  grouping.value = ['status']
}

// Group by priority
const groupByPriority = (): void => {
  grouping.value = ['priority']
}

// Clear grouping
const clearGrouping = (): void => {
  grouping.value = []
}
</script>

<template>
  <div class="row-grouping-container">
    <h1 class="title">Vue Tanstack Table Example with Row Grouping</h1>

    <!-- Grouping controls -->
    <div class="grouping-controls">
      <button
        @click="groupByStatus"
        class="group-button"
        :class="{ active: grouping.includes('status') }"
      >
        Group by Status
      </button>

      <button
        @click="groupByPriority"
        class="group-button"
        :class="{ active: grouping.includes('priority') }"
      >
        Group by Priority
      </button>

      <button
        v-if="grouping.length > 0"
        @click="clearGrouping"
        class="clear-button"
      >
        Clear Grouping
      </button>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th
              v-for="header in table.getHeaderGroups()[0].headers"
              :key="header.id"
            >
              {{ header.column.columnDef.header }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            :class="{ 'grouped-row': row.getIsGrouped() }"
          >
            <td v-for="cell in row.getVisibleCells()" :key="cell.id">
              <!-- Grouped cell -->
              <div v-if="cell.getIsGrouped()" class="grouped-cell">
                <button
                  class="expand-button"
                  @click="row.getToggleExpandedHandler()()"
                >
                  <span v-if="row.getIsExpanded()" class="icon">👇</span>
                  <span v-else class="icon">👉</span>
                  <span class="group-value">{{ cell.getValue() }}</span>
                  <span class="group-count"> ({{ row.subRows.length }}) </span>
                </button>
              </div>

              <!-- Aggregated cell -->
              <div v-else-if="cell.getIsAggregated()">
                {{ cell.getValue() }}
              </div>

              <!-- Placeholder cell -->
              <div v-else-if="cell.getIsPlaceholder()"></div>

              <!-- Regular cell -->
              <div v-else>
                <FlexRender
                  :render="cell.column.columnDef.cell"
                  :props="cell.getContext()"
                />
              </div>
            </td>
          </tr>

          <!-- Empty state -->
          <tr v-if="table.getRowModel().rows.length === 0">
            <td :colspan="columns.length" class="empty-table">
              No tasks found.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.row-grouping-container {
  padding: 20px;
  font-family: sans-serif;
}

.title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 16px;
}

.grouping-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.group-button,
.clear-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
}

.group-button {
  background-color: #3b82f6;
  color: white;
}

.group-button:hover {
  background-color: #2563eb;
}

.group-button.active {
  background-color: #1d4ed8;
}

.clear-button {
  background-color: #6b7280;
  color: white;
}

.clear-button:hover {
  background-color: #4b5563;
}

.icon {
  height: 16px;
  width: 16px;
  margin-right: 10px;
}

.table-container {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background-color: #f9fafb;
  color: #6b7280;
  border-bottom: 1px solid #e5e7eb;
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.grouped-row {
  background-color: #3b82f6;
}

.grouped-cell {
  font-weight: 500;
}

.expand-button {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-size: inherit;
}

.group-value {
  font-weight: 500;
}

.group-count {
  margin-left: 8px;
  color: #ffffff;
  font-size: 12px;
}

.empty-table {
  text-align: center;
  color: #6b7280;
  padding: 24px;
}
</style>
