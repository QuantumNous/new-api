import { useState, useMemo } from 'react'
import { type Table } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CopyButton } from '@/components/copy-button'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { type ApiKey } from '../types'
import { ApiKeysMultiDeleteDialog } from './api-keys-multi-delete-dialog'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const contentToCopy = useMemo(() => {
    const selectedKeys = selectedRows.map((row) => {
      const apiKey = row.original as ApiKey
      return `${apiKey.name}\tsk-${apiKey.key}`
    })
    return selectedKeys.join('\n')
  }, [selectedRows])

  return (
    <>
      <BulkActionsToolbar table={table} entityName='API key'>
        <CopyButton
          value={contentToCopy}
          variant='outline'
          size='icon'
          className='size-8'
          tooltip='Copy selected keys'
          successTooltip='Keys copied!'
          aria-label='Copy selected keys'
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setShowDeleteConfirm(true)}
              className='size-8'
              aria-label='Delete selected API keys'
              title='Delete selected API keys'
            >
              <Trash2 />
              <span className='sr-only'>Delete selected API keys</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete selected API keys</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <ApiKeysMultiDeleteDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        table={table}
      />
    </>
  )
}
