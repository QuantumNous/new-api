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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import { StaticRowActions } from '@/components/data-table/static/static-row-actions'
import { Dialog } from '@/components/dialog'
import { ProviderBadge } from '@/components/provider-badge'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import { getVendors } from '../../api'
import { getModelStatusConfig } from '../../constants'
import { vendorsQueryKeys, handleDeleteVendor } from '../../lib'
import type { Vendor } from '../../types'

type VendorManagementDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateVendor: () => void
  onEditVendor: (vendor: Vendor) => void
}

export function VendorManagementDialog({
  open,
  onOpenChange,
  onCreateVendor,
  onEditVendor,
}: VendorManagementDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const [deleteState, setDeleteState] = useState<{
    open: boolean
    vendor: Vendor | null
  }>({ open: false, vendor: null })
  const [isDeleting, setIsDeleting] = useState(false)

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch: refetchVendors,
  } = useQuery({
    queryKey: vendorsQueryKeys.list(),
    queryFn: () => getVendors({ page_size: 1000 }),
    enabled: open,
  })

  const vendors = useMemo(() => data?.data?.items ?? [], [data?.data?.items])

  const sortedVendors = useMemo(
    () => [...vendors].sort((a, b) => a.name.localeCompare(b.name)),
    [vendors]
  )

  const statusConfig = getModelStatusConfig(t)

  useEffect(() => {
    if (!open) {
      setDeleteState({ open: false, vendor: null })
      setIsDeleting(false)
    }
  }, [open])

  const handleDeleteClick = (vendor: Vendor) => {
    setDeleteState({ open: true, vendor })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteState.vendor) return
    setIsDeleting(true)
    try {
      await handleDeleteVendor(deleteState.vendor.id, queryClient, () => {
        setDeleteState({ open: false, vendor: null })
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const renderVendorCell = (vendor: Vendor) => (
    <div className='flex flex-col gap-1'>
      <div className='flex flex-wrap items-center gap-2'>
        <ProviderBadge iconKey={vendor.icon} label={vendor.name} />
        <TableId value={vendor.id} />
      </div>
      {vendor.description ? (
        <p className='text-muted-foreground text-xs'>{vendor.description}</p>
      ) : (
        <p className='text-muted-foreground text-xs italic'>
          {t('No description provided')}
        </p>
      )}
    </div>
  )

  let vendorsContent: ReactNode
  if (isLoading) {
    vendorsContent = (
      <div className='flex flex-col items-center justify-center gap-2 py-12 text-center'>
        <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
        <p className='text-muted-foreground text-sm'>
          {t('Fetching vendors...')}
        </p>
      </div>
    )
  } else if (sortedVendors.length === 0) {
    vendorsContent = (
      <Empty className='border border-dashed py-10'>
        <EmptyMedia variant='icon'>
          <Building2 className='h-6 w-6' />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>{t('No vendors yet')}</EmptyTitle>
          <EmptyDescription>
            {t('Create your first vendor to get started.')}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyDescription>
          {t('Vendors help you organize models by their upstream provider.')}
        </EmptyDescription>
      </Empty>
    )
  } else if (isMobile) {
    vendorsContent = (
      <div className='space-y-3'>
        {sortedVendors.map((vendor) => {
          const status = statusConfig[vendor.status as 0 | 1] || statusConfig[0]
          return (
            <Card key={vendor.id} className='border-border/60'>
              <CardHeader className='flex flex-row items-start justify-between gap-4'>
                <div className='space-y-2'>
                  <CardTitle className='flex flex-wrap items-center gap-2'>
                    <ProviderBadge iconKey={vendor.icon} label={vendor.name} />
                    <StatusBadge
                      variant={status.variant}
                      size='sm'
                      copyable={false}
                    >
                      {status.label}
                    </StatusBadge>
                  </CardTitle>
                  {vendor.description ? (
                    <CardDescription className='line-clamp-2'>
                      {vendor.description}
                    </CardDescription>
                  ) : (
                    <CardDescription className='text-muted-foreground italic'>
                      {t('No description provided')}
                    </CardDescription>
                  )}
                </div>

                <div className='flex items-center gap-2'>
                  <Button
                    size='icon'
                    variant='outline'
                    onClick={() => onEditVendor(vendor)}
                  >
                    <Pencil className='h-4 w-4' />
                    <span className='sr-only'>{t('Edit Vendor')}</span>
                  </Button>
                  <Button
                    size='icon'
                    variant='ghost'
                    className='text-destructive hover:text-destructive'
                    onClick={() => handleDeleteClick(vendor)}
                  >
                    <Trash2 className='h-4 w-4' />
                    <span className='sr-only'>{t('Delete Vendor')}</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs font-medium tracking-wide uppercase'>
                  <span>{t('Models')}</span>
                  <StatusBadge
                    label={`${vendor.model_count ?? 0}`}
                    variant='neutral'
                    size='sm'
                    copyable={false}
                  />
                </div>
                <div className='font-mono text-sm whitespace-nowrap'>
                  {formatTimestampToDate(vendor.created_time)}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  } else {
    vendorsContent = (
      <StaticDataTable
        tableClassName='min-w-[680px]'
        data={sortedVendors}
        getRowKey={(vendor) => vendor.id}
        columns={[
          {
            id: 'vendor',
            header: t('Vendor'),
            cellClassName: 'align-top whitespace-normal',
            cell: (vendor) => renderVendorCell(vendor),
          },
          {
            id: 'model_count',
            header: t('Model Count'),
            className: 'min-w-[120px]',
            cellClassName: 'align-top',
            cell: (vendor) => (
              <StatusBadge
                label={`${vendor.model_count ?? 0}`}
                variant='neutral'
                size='sm'
                copyable={false}
              />
            ),
          },
          {
            id: 'status',
            header: t('Status'),
            cellClassName: 'align-top',
            cell: (vendor) => {
              const status =
                statusConfig[vendor.status as 0 | 1] || statusConfig[0]
              return (
                <StatusBadge
                  variant={status.variant}
                  size='sm'
                  copyable={false}
                >
                  {status.label}
                </StatusBadge>
              )
            },
          },
          {
            id: 'created',
            header: t('Created'),
            cellClassName: 'align-top',
            cell: (vendor) => (
              <div className='font-mono text-sm whitespace-nowrap'>
                {formatTimestampToDate(vendor.created_time)}
              </div>
            ),
          },
          {
            id: 'actions',
            header: t('Actions'),
            className: 'text-right',
            cellClassName: 'align-top',
            cell: (vendor) => (
              <StaticRowActions
                editLabel={t('Edit Vendor')}
                deleteLabel={t('Delete Vendor')}
                menuLabel={t('Open menu')}
                onEdit={() => onEditVendor(vendor)}
                onDelete={() => handleDeleteClick(vendor)}
              />
            ),
          },
        ]}
      />
    )
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={
          <>
            <Building2 className='text-foreground/80 h-5 w-5' />
            {t('Vendor Management')}
          </>
        }
        description={t(
          'Manage the vendors that models are associated with. Create, edit, or remove vendors here.'
        )}
        contentClassName={cn(
          'w-[calc(100vw-2rem)] sm:max-w-[52rem]',
          isMobile && 'max-w-none rounded-none'
        )}
        titleClassName='flex flex-wrap items-center gap-2 text-lg'
        descriptionClassName='text-sm leading-relaxed'
        contentHeight='auto'
        bodyClassName={cn(
          'space-y-3',
          isMobile && 'pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]'
        )}
      >
        <div className='bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-md border p-2 text-sm'>
          <div className='flex flex-wrap items-center gap-2'>
            <Button size='sm' onClick={onCreateVendor}>
              <Plus className='mr-2 h-4 w-4' />
              {t('New Vendor')}
            </Button>
            <Button
              size='sm'
              variant='ghost'
              onClick={() => refetchVendors()}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <RefreshCcw className='mr-2 h-4 w-4' />
              )}
              {t('Refresh')}
            </Button>
          </div>
          <StatusBadge
            label={t('{{count}} vendors', { count: vendors.length })}
            variant='neutral'
            copyable={false}
          />
        </div>

        <div className='flex flex-col gap-3'>
          {error && (
            <Alert variant='destructive'>
              <AlertTitle>{t('Unable to load vendors')}</AlertTitle>
              <AlertDescription>
                {(error as Error).message ||
                  t('Please retry or refresh the page.')}
              </AlertDescription>
            </Alert>
          )}

          {vendorsContent}
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteState.open}
        onOpenChange={(next) => setDeleteState({ open: next, vendor: null })}
        title={t('Delete Vendor')}
        desc={
          <p>
            {t(
              'Are you sure you want to delete vendor "{{name}}"? This action cannot be undone.',
              { name: deleteState.vendor?.name ?? '' }
            )}
          </p>
        }
        destructive
        confirmText={isDeleting ? t('Deleting...') : t('Delete')}
        isLoading={isDeleting}
        handleConfirm={handleDeleteConfirm}
      />
    </>
  )
}
