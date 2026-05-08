import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { type Row } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Power, PowerOff, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  handleDeleteModel,
  handleToggleModelStatus,
  isModelEnabled,
} from '../lib'
import type { Model } from '../types'
import { useModels } from './models-provider'

interface DataTableRowActionsProps {
  row: Row<Model>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const { t } = useTranslation()
  const model = row.original
  const { setOpen, setCurrentRow } = useModels()
  const queryClient = useQueryClient()
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const isEnabled = isModelEnabled(model)

  const handleEdit = () => {
    setCurrentRow(model)
    setOpen('update-model')
  }

  const handleToggleStatus = () => {
    handleToggleModelStatus(model.id, model.status, queryClient)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant='ghost'
            className='data-popup-open:bg-muted flex h-8 w-8 p-0'
          />
        }
      >
        <MoreHorizontal className='h-4 w-4' />
        <span className='sr-only'>{t('Open menu')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-48'>
        {/* Edit */}
        <DropdownMenuItem onClick={handleEdit}>
          {t('Edit')}
          <DropdownMenuShortcut>
            <Pencil size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Enable/Disable */}
        <DropdownMenuItem onClick={handleToggleStatus}>
          {isEnabled ? (
            <>
              {t('Disable')}
              <DropdownMenuShortcut>
                <PowerOff size={16} />
              </DropdownMenuShortcut>
            </>
          ) : (
            <>
              {t('Enable')}
              <DropdownMenuShortcut>
                <Power size={16} />
              </DropdownMenuShortcut>
            </>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Delete */}
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            setDeleteConfirmOpen(true)
          }}
          className='text-destructive focus:text-destructive'
        >
          {t('Delete')}
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t('Delete Model')}
        desc={`Are you sure you want to delete "${model.model_name}"? This action cannot be undone.`}
        confirmText='Delete'
        destructive
        handleConfirm={() => {
          handleDeleteModel(model.id, queryClient)
          setDeleteConfirmOpen(false)
        }}
      />
    </DropdownMenu>
  )
}
