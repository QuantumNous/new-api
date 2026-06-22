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
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/data-table/pagination'
import { StatusBadge } from '@/components/status-badge'
import type { UpstreamChannel } from '../types'
import {
  CHANNEL_STATUS_CONFIG,
  DEFAULT_ENDPOINT,
  ENDPOINT_OPTIONS,
  MODELS_DEV_PRESET_ID,
  OFFICIAL_CHANNEL_ID,
} from './constants'

type ChannelSelectorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  channels: UpstreamChannel[]
  selectedChannelIds: number[]
  onSelectedChannelIdsChange: (ids: number[]) => void
  channelEndpoints: Record<number, string>
  onChannelEndpointsChange: (endpoints: Record<number, string>) => void
  onConfirm: (selectedIds: number[]) => void
}

// Synthesized presets from `controller/ratio_sync.go` always carry stable
// negative IDs, so matching by ID alone is reliable and self-documenting.
function isOfficialChannel(channel: UpstreamChannel): boolean {
  return (
    channel.id === OFFICIAL_CHANNEL_ID || channel.id === MODELS_DEV_PRESET_ID
  )
}

export function ChannelSelectorDialog({
  open,
  onOpenChange,
  channels,
  selectedChannelIds,
  onSelectedChannelIdsChange,
  channelEndpoints,
  onChannelEndpointsChange,
  onConfirm,
}: ChannelSelectorDialogProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  useEffect(() => {
    if (!selectedChannelIds.length) {
      setRowSelection({})
      return
    }

    const availableChannelIds = new Set(channels.map((channel) => channel.id))
    const newSelection: RowSelectionState = {}

    selectedChannelIds.forEach((id) => {
      if (availableChannelIds.has(id)) {
        newSelection[id.toString()] = true
      }
    })

    setRowSelection(newSelection)
  }, [selectedChannelIds, channels])

  const updateEndpoint = useCallback(
    (channelId: number, endpoint: string) => {
      onChannelEndpointsChange({
        ...channelEndpoints,
        [channelId]: endpoint,
      })
    },
    [channelEndpoints, onChannelEndpointsChange]
  )

  const getEndpointType = (endpoint: string) => {
    const option = ENDPOINT_OPTIONS.find((opt) => opt.value === endpoint)
    return option ? endpoint : 'custom'
  }

  const columns = useMemo<ColumnDef<UpstreamChannel>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label='Select all'
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label='Select row'
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'name',
        header: t('Name'),
        cell: ({ row }) => {
          const name = row.getValue('name') as string
          const channel = row.original
          const isOfficial = isOfficialChannel(channel)

          return (
            <div className='flex items-center gap-2'>
              <span className='font-medium'>{name}</span>
              {isOfficial && (
                <StatusBadge
                  label={t('Official')}
                  variant='success'
                  size='sm'
                  copyable={false}
                />
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'base_url',
        header: t('Base URL'),
        cell: ({ row }) => {
          const url = row.getValue('base_url') as string
          return (
            <span
              className='text-muted-foreground block max-w-xs truncate font-mono text-xs'
              title={url}
            >
              {url}
            </span>
          )
        },
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        cell: ({ row }) => {
          const status = row.getValue('status') as number
          const config =
            CHANNEL_STATUS_CONFIG[status as keyof typeof CHANNEL_STATUS_CONFIG]

          if (!config) {
            return (
              <StatusBadge
                label={t('Unknown')}
                variant='neutral'
                size='sm'
                copyable={false}
              />
            )
          }

          return (
            <StatusBadge
              label={config.label}
              variant={config.variant}
              size='sm'
              copyable={false}
            />
          )
        },
      },
      {
        id: 'endpoint',
        header: t('Sync Endpoint'),
        cell: ({ row }) => {
          const channel = row.original
          const currentEndpoint =
            channelEndpoints[channel.id] || DEFAULT_ENDPOINT
          const endpointType = getEndpointType(currentEndpoint)

          const handleTypeChange = (value: string) => {
            if (value === 'custom') {
              updateEndpoint(channel.id, '')
            } else {
              updateEndpoint(channel.id, value)
            }
          }

          return (
            <div className='flex items-center gap-2'>
              <Select
                items={[
                  ...ENDPOINT_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  })),
                ]}
                value={endpointType}
                onValueChange={(v) => v !== null && handleTypeChange(v)}
              >
                <SelectTrigger className='h-8 w-32'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {ENDPOINT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {endpointType === 'custom' && (
                <Input
                  value={currentEndpoint}
                  onChange={(e) => updateEndpoint(channel.id, e.target.value)}
                  placeholder={t('/your/endpoint')}
                  className='h-8 w-40 font-mono text-xs'
                />
              )}
            </div>
          )
        },
      },
    ],
    [channelEndpoints, t, updateEndpoint]
  )

  const filteredChannels = useMemo(() => {
    if (!search.trim()) return channels

    const searchLower = search.toLowerCase()
    return channels.filter(
      (ch) =>
        ch.name.toLowerCase().includes(searchLower) ||
        ch.base_url.toLowerCase().includes(searchLower)
    )
  }, [channels, search])

  const sortedChannels = useMemo(() => {
    return [...filteredChannels].sort((a, b) => {
      const aIsOfficial = isOfficialChannel(a)
      const bIsOfficial = isOfficialChannel(b)
      if (aIsOfficial && !bIsOfficial) return -1
      if (!aIsOfficial && bIsOfficial) return 1
      return 0
    })
  }, [filteredChannels])

  const table = useReactTable({
    data: sortedChannels,
    columns,
    state: {
      rowSelection,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  const handleConfirm = () => {
    const selectedRows = table.getSelectedRowModel().rows
    const selectedIds = selectedRows.map((row) => row.original.id)
    onSelectedChannelIdsChange(selectedIds)
    onOpenChange(false)
    onConfirm(selectedIds)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90vh] max-w-[calc(100%-2rem)] flex-col sm:max-w-[90vw] xl:max-w-[1400px]'>
        <DialogHeader>
          <DialogTitle>{t('Select Sync Channels')}</DialogTitle>
          <DialogDescription>
            {t('Choose channels to sync upstream ratio configurations from')}
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-1 flex-col gap-4 overflow-hidden'>
          <div className='flex items-center gap-2'>
            <div className='relative flex-1'>
              <Search className='text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2' />
              <Input
                placeholder={t('Search by name or URL...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='ps-8'
              />
            </div>
          </div>

          <div className='flex-1 overflow-auto rounded-md border'>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className='h-24 text-center'
                    >
                      {t('No channels found')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination table={table} />
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleConfirm}>{t('Confirm Selection')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
