import { useQueryClient } from '@tanstack/react-query'
import { type Row } from '@tanstack/react-table'
import { MoreHorizontal, Power, PowerOff, Pencil, Edit } from 'lucide-react'
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
import { handleEnableTagChannels, handleDisableTagChannels } from '../lib'
import type { Channel } from '../types'
import { useChannels } from './channels-provider'

interface DataTableTagRowActionsProps {
  row: Row<Channel & { tag?: string }>
}

export function DataTableTagRowActions({ row }: DataTableTagRowActionsProps) {
  const { t } = useTranslation()
  const tag = row.original.tag
  const { setOpen, setCurrentTag } = useChannels()
  const queryClient = useQueryClient()

  if (!tag) return null

  const handleEnableAll = () => {
    handleEnableTagChannels(tag, queryClient)
  }

  const handleDisableAll = () => {
    handleDisableTagChannels(tag, queryClient)
  }

  const handleBatchEdit = () => {
    setCurrentTag(tag)
    setOpen('tag-batch-edit')
  }

  const handleEditTag = () => {
    setCurrentTag(tag)
    setOpen('edit-tag')
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
        {/* Edit Tag */}
        <DropdownMenuItem onClick={handleEditTag}>
          {t('Edit Tag')}
          <DropdownMenuShortcut>
            <Edit size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        {/* Batch Edit */}
        <DropdownMenuItem onClick={handleBatchEdit}>
          {t('Batch Edit')}
          <DropdownMenuShortcut>
            <Pencil size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Enable All */}
        <DropdownMenuItem onClick={handleEnableAll}>
          {t('Enable All')}
          <DropdownMenuShortcut>
            <Power size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        {/* Disable All */}
        <DropdownMenuItem onClick={handleDisableAll}>
          {t('Disable All')}
          <DropdownMenuShortcut>
            <PowerOff size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
