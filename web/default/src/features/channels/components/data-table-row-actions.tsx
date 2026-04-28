import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { type Row } from '@tanstack/react-table'
import {
  MoreHorizontal,
  Boxes,
  Pencil,
  TestTube,
  DollarSign,
  Download,
  Copy,
  Power,
  PowerOff,
  Key,
  Trash2,
  RefreshCw,
} from 'lucide-react'
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
import { MODEL_FETCHABLE_TYPES } from '../constants'
import {
  handleDeleteChannel,
  handleToggleChannelStatus,
  isChannelEnabled,
  isMultiKeyChannel,
} from '../lib'
import { parseUpstreamUpdateMeta } from '../lib/upstream-update-utils'
import type { Channel } from '../types'
import { useChannels } from './channels-provider'

interface DataTableRowActionsProps {
  row: Row<Channel>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const { t } = useTranslation()
  const channel = row.original
  const { setOpen, setCurrentRow, upstream } = useChannels()
  const queryClient = useQueryClient()
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const isEnabled = isChannelEnabled(channel)
  const isMultiKey = isMultiKeyChannel(channel)

  const handleEdit = () => {
    setCurrentRow(channel)
    setOpen('update-channel')
  }

  const handleTest = () => {
    setCurrentRow(channel)
    setOpen('test-channel')
  }

  const handleQueryBalance = () => {
    setCurrentRow(channel)
    setOpen('balance-query')
  }

  const handleFetchModels = () => {
    setCurrentRow(channel)
    setOpen('fetch-models')
  }

  const handleManageOllamaModels = () => {
    setCurrentRow(channel)
    setOpen('ollama-models')
  }

  const handleCopy = () => {
    setCurrentRow(channel)
    setOpen('copy-channel')
  }

  const handleManageKeys = () => {
    setCurrentRow(channel)
    setOpen('multi-key-manage')
  }

  const handleToggleStatus = () => {
    handleToggleChannelStatus(channel.id, channel.status, queryClient)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='data-[state=open]:bg-muted flex h-8 w-8 p-0'
        >
          <MoreHorizontal className='h-4 w-4' />
          <span className='sr-only'>{t('Open menu')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-48'>
        {/* Edit */}
        <DropdownMenuItem onClick={handleEdit}>
          {t('Edit')}
          <DropdownMenuShortcut>
            <Pencil size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        {/* Test Connection */}
        <DropdownMenuItem onClick={handleTest}>
          {t('Test Connection')}
          <DropdownMenuShortcut>
            <TestTube size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        {/* Query Balance */}
        <DropdownMenuItem onClick={handleQueryBalance}>
          {t('Query Balance')}
          <DropdownMenuShortcut>
            <DollarSign size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        {/* Fetch Models */}
        <DropdownMenuItem onClick={handleFetchModels}>
          {t('Fetch Models')}
          <DropdownMenuShortcut>
            <Download size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        {/* Detect Upstream Updates (only for fetchable channel types) */}
        {MODEL_FETCHABLE_TYPES.has(channel.type) && (
          <DropdownMenuItem
            onClick={() => {
              const meta = parseUpstreamUpdateMeta(channel.settings)
              if (
                meta.pendingAddModels.length > 0 ||
                meta.pendingRemoveModels.length > 0
              ) {
                upstream.openModal(
                  channel,
                  meta.pendingAddModels,
                  meta.pendingRemoveModels,
                  meta.pendingAddModels.length > 0 ? 'add' : 'remove'
                )
              } else {
                upstream.detectChannelUpdates(channel)
              }
            }}
          >
            {t('Upstream Updates')}
            <DropdownMenuShortcut>
              <RefreshCw size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        )}

        {/* Ollama Models (only for Ollama channels) */}
        {channel.type === 4 && (
          <DropdownMenuItem onClick={handleManageOllamaModels}>
            {t('Manage Ollama Models')}
            <DropdownMenuShortcut>
              <Boxes size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Copy Channel */}
        <DropdownMenuItem onClick={handleCopy}>
          {t('Copy Channel')}
          <DropdownMenuShortcut>
            <Copy size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        {/* Manage Keys (only for multi-key channels) */}
        {isMultiKey && (
          <DropdownMenuItem onClick={handleManageKeys}>
            {t('Manage Keys')}
            <DropdownMenuShortcut>
              <Key size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        )}

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
        title={t('Delete Channel')}
        desc={`Are you sure you want to delete "${channel.name}"? This action cannot be undone.`}
        confirmText='Delete'
        destructive
        handleConfirm={() => {
          handleDeleteChannel(channel.id, queryClient)
          setDeleteConfirmOpen(false)
        }}
      />
    </DropdownMenu>
  )
}
