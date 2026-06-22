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
import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { type Table } from '@tanstack/react-table'
import { Power, PowerOff, Trash2, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { cn } from '@/lib/utils'
import { opsConsoleOutlineButtonClassName } from '@/lib/ops-ui-styles'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import {
  handleBatchEnableModels,
  handleBatchDisableModels,
  handleBatchDeleteModels,
} from '../lib'
import type { Model } from '../types'

const modelsBulkPanelClassName = cn(
  'border-[#DBEAFE] bg-white/95 text-slate-800 shadow-md shadow-blue-950/5 backdrop-blur-md'
)

const modelsBulkClearButtonClassName = opsConsoleOutlineButtonClassName

const modelsBulkActionButtonClassName = cn(
  'size-8 border-[#DBEAFE] bg-white text-slate-700',
  '[&_svg]:text-slate-600',
  'hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:[&_svg]:text-blue-600',
  'disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-60'
)

const modelsBulkDeleteButtonClassName = cn(
  'size-8 border-red-200 bg-red-50 text-red-700',
  '[&_svg]:text-red-600',
  'hover:border-red-300 hover:bg-red-100 hover:text-red-800',
  'disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-60'
)

interface DataTableBulkActionsProps<TData> {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedIds = selectedRows.reduce<number[]>((ids, row) => {
    const id = (row.original as Model).id

    if (typeof id === 'number') {
      ids.push(id)
    }

    return ids
  }, [])

  const selectedModels = selectedRows.map((row) => row.original as Model)

  const selectionSummary = useCallback(
    (count: number) =>
      count === 1
        ? t('{{count}} model resource selected', { count })
        : t('{{count}} model resources selected', { count }),
    [t]
  )

  const handleClearSelection = () => {
    table.resetRowSelection()
  }

  const handleEnableAll = () => {
    handleBatchEnableModels(selectedIds, queryClient, handleClearSelection)
  }

  const handleDisableAll = () => {
    handleBatchDisableModels(selectedIds, queryClient, handleClearSelection)
  }

  const handleDeleteAll = () => {
    handleBatchDeleteModels(selectedIds, queryClient, () => {
      setShowDeleteConfirm(false)
      handleClearSelection()
    })
  }

  const handleCopyNames = async () => {
    const names = selectedModels.map((m) => m.model_name).join(',')
    const success = await copyToClipboard(names)
    if (success) {
      toast.success(t('Model resource names copied to clipboard'))
    } else {
      toast.error(t('Failed to copy model resource names'))
    }
  }

  const enableLabel = t('Enable selected model resources')
  const disableLabel = t('Disable selected model resources')
  const copyLabel = t('Copy model resource name list')
  const deleteLabel = t('Delete selected model resources')

  return (
    <>
      <BulkActionsToolbar
        table={table}
        entityName='model'
        selectionSummary={selectionSummary}
        panelClassName={modelsBulkPanelClassName}
        clearButtonClassName={modelsBulkClearButtonClassName}
        countTextClassName='text-slate-200'
        badgeClassName='border-cyan-500/30 bg-cyan-500/20 text-cyan-100'
        separatorClassName='bg-white/10'
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                onClick={handleEnableAll}
                disabled={selectedIds.length === 0}
                className={modelsBulkActionButtonClassName}
                aria-label={enableLabel}
                title={enableLabel}
              />
            }
          >
            <Power />
            <span className='sr-only'>{enableLabel}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{enableLabel}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                onClick={handleDisableAll}
                disabled={selectedIds.length === 0}
                className={modelsBulkActionButtonClassName}
                aria-label={disableLabel}
                title={disableLabel}
              />
            }
          >
            <PowerOff />
            <span className='sr-only'>{disableLabel}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{disableLabel}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                onClick={handleCopyNames}
                disabled={selectedIds.length === 0}
                className={modelsBulkActionButtonClassName}
                aria-label={copyLabel}
                title={copyLabel}
              />
            }
          >
            <Copy />
            <span className='sr-only'>{copyLabel}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{copyLabel}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selectedIds.length === 0}
                className={modelsBulkDeleteButtonClassName}
                aria-label={deleteLabel}
                title={deleteLabel}
              />
            }
          >
            <Trash2 />
            <span className='sr-only'>{deleteLabel}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{deleteLabel}</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Delete selected model resources?')}</DialogTitle>
            <DialogDescription>
              {t(
                'Are you sure you want to delete {{count}} selected model resources? This action cannot be undone.',
                { count: selectedIds.length }
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowDeleteConfirm(false)}
            >
              {t('Cancel')}
            </Button>
            <Button variant='destructive' onClick={handleDeleteAll}>
              {t('Delete model resource')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
