import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Info, Pencil, Settings2, Timer, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTimestampToDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table/column-header'
import { StatusBadge } from '@/components/status-badge'
import { getDeploymentStatusConfig } from '../constants'
import {
  formatRemainingMinutes,
  normalizeDeploymentStatus,
} from '../lib/deployments-utils'
import type { Deployment } from '../types'

export function useDeploymentsColumns(opts: {
  onViewLogs: (id: string | number) => void
  onViewDetails: (id: string | number) => void
  onUpdateConfig: (id: string | number) => void
  onExtend: (id: string | number) => void
  onRename: (id: string | number, currentName: string) => void
  onDelete: (deployment: Deployment) => void
}): ColumnDef<Deployment>[] {
  const { t } = useTranslation()
  const STATUS = getDeploymentStatusConfig(t)

  return [
    {
      accessorKey: 'id',
      meta: { label: t('ID'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('ID')} />
      ),
      cell: ({ row }) => {
        const id = row.original.id
        return (
          <StatusBadge
            label={String(id)}
            variant='neutral'
            copyText={String(id)}
            size='sm'
            className='font-mono'
          />
        )
      },
      size: 120,
    },
    {
      id: 'name',
      accessorFn: (row) =>
        row.container_name || row.deployment_name || row.name || '',
      meta: { label: t('Name'), mobileTitle: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Name')} />
      ),
      cell: ({ getValue }) => {
        const name = String(getValue() || '-') || '-'
        return (
          <StatusBadge
            label={name}
            variant='neutral'
            copyText={name}
            size='sm'
            className='font-mono'
          />
        )
      },
      minSize: 220,
    },
    {
      accessorKey: 'status',
      meta: { label: t('Status'), mobileBadge: true },
      header: t('Status'),
      cell: ({ row }) => {
        const raw = row.original.status
        const key = normalizeDeploymentStatus(raw)
        const config = STATUS[key] || {
          label:
            typeof raw === 'string' && raw.trim() ? raw.trim() : t('Unknown'),
          variant: 'neutral' as const,
        }
        return (
          <StatusBadge
            label={config.label}
            variant={config.variant}
            showDot={config.showDot}
            size='sm'
            copyable={false}
          />
        )
      },
      filterFn: (row, id, value) => {
        if (
          !Array.isArray(value) ||
          value.length === 0 ||
          value.includes('all')
        ) {
          return true
        }
        const status = normalizeDeploymentStatus(row.getValue(id))
        return value.includes(status)
      },
      size: 160,
      enableSorting: false,
    },
    {
      accessorKey: 'provider',
      meta: { label: t('Provider') },
      header: t('Provider'),
      cell: ({ row }) => {
        const provider = row.original.provider
        if (!provider)
          return <span className='text-muted-foreground text-xs'>-</span>
        return (
          <StatusBadge
            label={String(provider)}
            autoColor={String(provider)}
            size='sm'
            copyable={false}
          />
        )
      },
      size: 140,
      enableSorting: false,
    },
    {
      accessorKey: 'time_remaining',
      meta: { label: t('Time remaining') },
      header: t('Time remaining'),
      cell: ({ row }) => {
        const status = normalizeDeploymentStatus(row.original.status)
        const remainingText =
          typeof row.original.time_remaining === 'string' &&
          row.original.time_remaining.trim()
            ? row.original.time_remaining.trim()
            : '-'
        const remainingHuman = formatRemainingMinutes(
          row.original.compute_minutes_remaining
        )
        const percentUsed =
          typeof row.original.completed_percent === 'number' &&
          Number.isFinite(row.original.completed_percent)
            ? Math.max(
                0,
                Math.min(100, Math.round(row.original.completed_percent))
              )
            : null
        const percentRemain =
          percentUsed === null
            ? null
            : Math.max(0, Math.min(100, 100 - percentUsed))

        return (
          <div className='flex flex-col gap-1 text-sm'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='font-medium'>{remainingText}</span>
              {status === 'running' && percentRemain !== null ? (
                <StatusBadge
                  label={`${percentRemain}%`}
                  variant='info'
                  size='sm'
                  copyable={false}
                />
              ) : null}
            </div>
            {remainingHuman ? (
              <div className='text-muted-foreground text-xs'>
                {t('Approx.')} {remainingHuman}
              </div>
            ) : null}
          </div>
        )
      },
      minSize: 220,
      enableSorting: false,
    },
    {
      id: 'hardware',
      meta: { label: t('Hardware'), mobileHidden: true },
      header: t('Hardware'),
      accessorFn: (row) =>
        row.hardware_info || row.hardware_name || row.brand_name || '',
      cell: ({ row }) => {
        const hardware =
          row.original.hardware_name ||
          (typeof row.original.hardware_info === 'string'
            ? row.original.hardware_info
            : '')
        const qty =
          typeof row.original.hardware_quantity === 'number'
            ? row.original.hardware_quantity
            : null
        if (!hardware)
          return <span className='text-muted-foreground text-xs'>-</span>
        return (
          <div className='flex flex-wrap items-center gap-2'>
            <StatusBadge
              label={String(hardware)}
              variant='neutral'
              copyText={String(hardware)}
              size='sm'
            />
            {qty !== null ? (
              <span className='text-muted-foreground text-xs'>×{qty}</span>
            ) : null}
          </div>
        )
      },
      minSize: 220,
      enableSorting: false,
    },
    {
      accessorKey: 'created_at',
      meta: { label: t('Created'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Created')} />
      ),
      cell: ({ row }) => {
        const ts =
          typeof row.original.created_at === 'number'
            ? row.original.created_at
            : typeof row.original.created_at === 'string'
              ? Number(row.original.created_at)
              : undefined
        return (
          <div className='min-w-[140px] font-mono text-sm'>
            {formatTimestampToDate(ts)}
          </div>
        )
      },
      size: 180,
    },
    {
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => {
        const id = row.original.id
        const currentName =
          row.original.container_name ||
          row.original.deployment_name ||
          row.original.name ||
          ''

        return (
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => opts.onViewLogs(id)}
              title={t('View logs')}
            >
              <Eye className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => opts.onViewDetails(id)}
              title={t('View details')}
            >
              <Info className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => opts.onUpdateConfig(id)}
              title={t('Update configuration')}
            >
              <Settings2 className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => opts.onExtend(id)}
              title={t('Extend deployment')}
            >
              <Timer className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => opts.onRename(id, String(currentName))}
              title={t('Rename deployment')}
            >
              <Pencil className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => opts.onDelete(row.original)}
              title={t('Delete')}
            >
              <Trash2 className='h-4 w-4 text-red-500' />
            </Button>
          </div>
        )
      },
      size: 180,
    },
  ]
}
