import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table'
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DataTableToolbar,
  MobileCardList,
  TableEmpty,
  TableSkeleton,
} from '@/components/data-table'
import { DataTablePagination } from '@/components/data-table/pagination'
import { PageFooterPortal } from '@/components/layout'
import { deleteDeployment, listDeployments, searchDeployments } from '../api'
import { getDeploymentStatusOptions } from '../constants'
import { deploymentsQueryKeys } from '../lib'
import type { Deployment } from '../types'
import { useDeploymentsColumns } from './deployments-columns'
import { ExtendDeploymentDialog } from './dialogs/extend-deployment-dialog'
import { RenameDeploymentDialog } from './dialogs/rename-deployment-dialog'
import { UpdateConfigDialog } from './dialogs/update-config-dialog'
import { ViewDetailsDialog } from './dialogs/view-details-dialog'
import { ViewLogsDialog } from './dialogs/view-logs-dialog'

const route = getRouteApi('/_authenticated/models/$section')

export function DeploymentsTable() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isMobile = useMediaQuery('(max-width: 640px)')

  // URL state (use dedicated keys so it won't collide with metadata table)
  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: {
      pageKey: 'dPage',
      pageSizeKey: 'dPageSize',
      defaultPage: 1,
      defaultPageSize: isMobile ? 8 : 10,
    },
    globalFilter: { enabled: true, key: 'dFilter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'dStatus', type: 'array' },
    ],
  })

  const keyword = globalFilter ?? ''
  const statusFilter =
    (columnFilters.find((f) => f.id === 'status')?.value as string[]) || []
  const activeStatus =
    statusFilter.length > 0 && !statusFilter.includes('all')
      ? statusFilter[0]
      : undefined

  // Dialog state
  const [logsOpen, setLogsOpen] = useState(false)
  const [logsDeploymentId, setLogsDeploymentId] = useState<
    string | number | null
  >(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsDeploymentId, setDetailsDeploymentId] = useState<
    string | number | null
  >(null)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [updateDeploymentId, setUpdateDeploymentId] = useState<
    string | number | null
  >(null)
  const [extendOpen, setExtendOpen] = useState(false)
  const [extendDeploymentId, setExtendDeploymentId] = useState<
    string | number | null
  >(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameDeploymentId, setRenameDeploymentId] = useState<
    string | number | null
  >(null)
  const [renameCurrentName, setRenameCurrentName] = useState<string>('')

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Deployment | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: deploymentsQueryKeys.list({
      keyword,
      status: activeStatus,
      p: pagination.pageIndex + 1,
      page_size: pagination.pageSize,
    }),
    queryFn: async () => {
      if (keyword.trim()) {
        return searchDeployments({
          keyword,
          status: activeStatus,
          p: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
        })
      }
      return listDeployments({
        status: activeStatus,
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      })
    },
    placeholderData: (prev) => prev,
  })

  const deployments = data?.data?.items || []
  const totalCount = data?.data?.total || 0

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await deleteDeployment(deleteTarget.id)
      if (res?.success) {
        toast.success(t('Deleted successfully'))
        queryClient.invalidateQueries({
          queryKey: deploymentsQueryKeys.lists(),
        })
      } else {
        toast.error(res?.message || t('Delete failed'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Delete failed'))
    } finally {
      setIsDeleting(false)
      setDeleteOpen(false)
      setDeleteTarget(null)
    }
  }

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const columns = useDeploymentsColumns({
    onViewLogs: (id) => {
      setLogsDeploymentId(id)
      setLogsOpen(true)
    },
    onViewDetails: (id) => {
      setDetailsDeploymentId(id)
      setDetailsOpen(true)
    },
    onUpdateConfig: (id) => {
      setUpdateDeploymentId(id)
      setUpdateOpen(true)
    },
    onExtend: (id) => {
      setExtendDeploymentId(id)
      setExtendOpen(true)
    },
    onRename: (id, currentName) => {
      setRenameCurrentName(currentName)
      setRenameDeploymentId(id)
      setRenameOpen(true)
    },
    onDelete: (deployment) => {
      setDeleteTarget(deployment)
      setDeleteOpen(true)
    },
  })

  const table = useReactTable({
    data: deployments,
    columns,
    pageCount: Math.ceil(totalCount / pagination.pageSize),
    state: {
      columnFilters,
      columnVisibility,
      pagination,
      globalFilter,
    },
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange,
    onGlobalFilterChange,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualFiltering: true,
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    ensurePageInRange(pageCount)
  }, [ensurePageInRange, pageCount])

  const statusFilterOptions = useMemo(() => {
    return [...getDeploymentStatusOptions(t)].map((opt) => ({
      label: opt.label,
      value: opt.value,
    }))
  }, [t])

  return (
    <>
      <div className='space-y-3 sm:space-y-4'>
        <DataTableToolbar
          table={table}
          searchPlaceholder={t('Search deployments...')}
          filters={[
            {
              columnId: 'status',
              title: t('Status'),
              options: statusFilterOptions,
              singleSelect: true,
            },
          ]}
        />

        {isMobile ? (
          <MobileCardList
            table={table}
            isLoading={isLoading}
            emptyTitle={t('No Deployments Found')}
            emptyDescription={t(
              'No deployments available. Create one to get started.'
            )}
          />
        ) : (
          <div
            className={cn(
              'overflow-hidden rounded-md border transition-opacity duration-150',
              isFetching && !isLoading && 'pointer-events-none opacity-50'
            )}
          >
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        style={{ width: header.getSize() }}
                      >
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
                {isLoading ? (
                  <TableSkeleton
                    table={table}
                    keyPrefix='deployment-skeleton'
                  />
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableEmpty
                    colSpan={table.getVisibleLeafColumns().length}
                    title={t('No Deployments Found')}
                    description={t(
                      'No deployments available. Create one to get started.'
                    )}
                  />
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
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
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <PageFooterPortal>
        <DataTablePagination
          table={table as ReturnType<typeof useReactTable>}
        />
      </PageFooterPortal>

      <ViewLogsDialog
        open={logsOpen}
        onOpenChange={(open) => {
          setLogsOpen(open)
          if (!open) setLogsDeploymentId(null)
        }}
        deploymentId={logsDeploymentId}
      />

      <ViewDetailsDialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open)
          if (!open) setDetailsDeploymentId(null)
        }}
        deploymentId={detailsDeploymentId}
      />

      <UpdateConfigDialog
        open={updateOpen}
        onOpenChange={(open) => {
          setUpdateOpen(open)
          if (!open) setUpdateDeploymentId(null)
        }}
        deploymentId={updateDeploymentId}
      />

      <ExtendDeploymentDialog
        open={extendOpen}
        onOpenChange={(open) => {
          setExtendOpen(open)
          if (!open) setExtendDeploymentId(null)
        }}
        deploymentId={extendDeploymentId}
      />

      <RenameDeploymentDialog
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open)
          if (!open) setRenameDeploymentId(null)
        }}
        deploymentId={renameDeploymentId}
        currentName={renameCurrentName}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Confirm delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Are you sure you want to delete deployment "{{name}}"? This action cannot be undone.',
                {
                  name:
                    deleteTarget?.container_name ||
                    deleteTarget?.deployment_name ||
                    deleteTarget?.id,
                }
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {isDeleting ? t('Deleting...') : t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
