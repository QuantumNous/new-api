import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { type Table } from '@tanstack/react-table'
import { Power, PowerOff, Trash2, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
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
      toast.success(t('Model names copied to clipboard'))
    } else {
      toast.error(t('Failed to copy model names'))
    }
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName='model'>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                onClick={handleEnableAll}
                className='size-8'
                aria-label={t('Enable selected models')}
                title={t('Enable selected models')}
              />
            }
          >
            <Power />
            <span className='sr-only'>{t('Enable selected models')}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('Enable selected models')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                onClick={handleDisableAll}
                className='size-8'
                aria-label={t('Disable selected models')}
                title={t('Disable selected models')}
              />
            }
          >
            <PowerOff />
            <span className='sr-only'>{t('Disable selected models')}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('Disable selected models')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                onClick={handleCopyNames}
                className='size-8'
                aria-label={t('Copy model names')}
                title={t('Copy model names')}
              />
            }
          >
            <Copy />
            <span className='sr-only'>{t('Copy model names')}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('Copy model names')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='destructive'
                size='icon'
                onClick={() => setShowDeleteConfirm(true)}
                className='size-8'
                aria-label={t('Delete selected models')}
                title={t('Delete selected models')}
              />
            }
          >
            <Trash2 />
            <span className='sr-only'>{t('Delete selected models')}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('Delete selected models')}</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Delete Models?')}</DialogTitle>
            <DialogDescription>
              {t('Are you sure you want to delete')} {selectedIds.length}{' '}
              {t('model(s)? This action cannot be undone.')}
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
              {t('Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
