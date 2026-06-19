/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
/**
 * Column definitions factory
 */
import type { ColumnDef } from '@tanstack/react-table'

import { useCommonLogsColumns } from '../components/columns/common-logs-columns'
import { useDrawingLogsColumns } from '../components/columns/drawing-logs-columns'
import { useTaskLogsColumns } from '../components/columns/task-logs-columns'
import type { LogCategory, MidjourneyLog, TaskLog } from '../types'
import type { UsageLog } from '../data/schema'

type UsageLogsRow = UsageLog | MidjourneyLog | TaskLog

/**
 * Get column definitions based on log category
 * Returns a union row type because the table switches between common,
 * drawing, and task log shapes at runtime.
 */
export function useColumnsByCategory(
  logCategory: LogCategory,
  isAdmin: boolean,
  showIpInLogs = false
): ColumnDef<UsageLogsRow>[] {
  const commonColumns = useCommonLogsColumns(isAdmin, showIpInLogs)
  const drawingColumns = useDrawingLogsColumns(isAdmin)
  const taskColumns = useTaskLogsColumns(isAdmin)

  switch (logCategory) {
    case 'common':
      return commonColumns as ColumnDef<UsageLogsRow>[]
    case 'drawing':
      return drawingColumns as ColumnDef<UsageLogsRow>[]
    case 'task':
      return taskColumns as ColumnDef<UsageLogsRow>[]
    default:
      return commonColumns as ColumnDef<UsageLogsRow>[]
  }
}
