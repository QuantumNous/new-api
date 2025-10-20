import { useQueryClient } from '@tanstack/react-query'
import { type Row } from '@tanstack/react-table'
import {
  MoreHorizontal,
  Pencil,
  TestTube,
  DollarSign,
  Download,
  Copy,
  Power,
  PowerOff,
  Key,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  handleDeleteChannel,
  handleToggleChannelStatus,
  isChannelEnabled,
  isMultiKeyChannel,
} from '../lib'
import type { Channel } from '../types'
import { useChannels } from './channels-provider'

interface DataTableRowActionsProps {
  row: Row<Channel>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const channel = row.original
  const { setOpen, setCurrentRow } = useChannels()
  const queryClient = useQueryClient()

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
          <span className='sr-only'>Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-48'>
        {/* Edit */}
        <DropdownMenuItem onClick={handleEdit}>
          <Pencil className='mr-2 h-4 w-4' />
          Edit
        </DropdownMenuItem>

        {/* Test Connection */}
        <DropdownMenuItem onClick={handleTest}>
          <TestTube className='mr-2 h-4 w-4' />
          Test Connection
        </DropdownMenuItem>

        {/* Query Balance */}
        <DropdownMenuItem onClick={handleQueryBalance}>
          <DollarSign className='mr-2 h-4 w-4' />
          Query Balance
        </DropdownMenuItem>

        {/* Fetch Models */}
        <DropdownMenuItem onClick={handleFetchModels}>
          <Download className='mr-2 h-4 w-4' />
          Fetch Models
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Copy Channel */}
        <DropdownMenuItem onClick={handleCopy}>
          <Copy className='mr-2 h-4 w-4' />
          Copy Channel
        </DropdownMenuItem>

        {/* Manage Keys (only for multi-key channels) */}
        {isMultiKey && (
          <DropdownMenuItem onClick={handleManageKeys}>
            <Key className='mr-2 h-4 w-4' />
            Manage Keys
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Enable/Disable */}
        <DropdownMenuItem onClick={handleToggleStatus}>
          {isEnabled ? (
            <>
              <PowerOff className='mr-2 h-4 w-4' />
              Disable
            </>
          ) : (
            <>
              <Power className='mr-2 h-4 w-4' />
              Enable
            </>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Delete */}
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            if (
              window.confirm(
                `Are you sure you want to delete "${channel.name}"? This action cannot be undone.`
              )
            ) {
              handleDeleteChannel(channel.id, queryClient)
            }
          }}
          className='text-destructive focus:text-destructive'
        >
          <Trash2 className='mr-2 h-4 w-4' />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
