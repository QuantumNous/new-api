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
import { getRouteApi } from '@tanstack/react-router'
import type { Table } from '@tanstack/react-table'
import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { exportLogsCsv } from '../api'
import { getCsvFilename } from '../lib/csv'
import { buildExportParams } from '../lib/utils'
import { useUsageLogsContext } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

export function CommonLogsExportButton<TData>(props: { table: Table<TData> }) {
  const { t } = useTranslation()
  const searchParams = route.useSearch()
  const { viewScope } = useUsageLogsContext()
  const isRoot = useAuthStore(
    (state) => state.auth.user?.role === ROLE.SUPER_ADMIN
  )
  const [exporting, setExporting] = useState(false)

  if (!isRoot) return null

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const result = await exportLogsCsv(
        buildExportParams({
          searchParams,
          columnFilters: props.table.getState().columnFilters,
          scope: viewScope,
        })
      )
      const url = URL.createObjectURL(result.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = getCsvFilename(result.contentDisposition)
      anchor.style.display = 'none'
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success(t('CSV export downloaded'))
    } catch {
      toast.error(t('Failed to export CSV'))
    } finally {
      setExporting(false)
    }
  }

  const label = exporting ? t('Exporting CSV') : t('Export CSV')
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            onClick={handleExport}
            disabled={exporting}
            aria-label={label}
            aria-busy={exporting}
            className='text-muted-foreground hover:text-foreground'
          />
        }
      >
        {exporting ? <Loader2 className='animate-spin' /> : <Download />}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
