import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  RefreshCw,
  Trash2,
  Power,
  PowerOff,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
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
import {
  getMultiKeyStatus,
  enableMultiKey,
  disableMultiKey,
  deleteMultiKey,
  enableAllMultiKeys,
  disableAllMultiKeys,
  deleteDisabledMultiKeys,
} from '../../api'
import { channelsQueryKeys } from '../../lib'
import type { KeyStatus } from '../../types'
import { useChannels } from '../channels-provider'

type MultiKeyManageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ConfirmAction = {
  type:
    | 'enable'
    | 'disable'
    | 'delete'
    | 'enable-all'
    | 'disable-all'
    | 'delete-disabled'
  keyIndex?: number
}

export function MultiKeyManageDialog({
  open,
  onOpenChange,
}: MultiKeyManageDialogProps) {
  const { currentRow } = useChannels()
  const queryClient = useQueryClient()

  const [isLoading, setIsLoading] = useState(false)
  const [keys, setKeys] = useState<KeyStatus[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Statistics
  const [enabledCount, setEnabledCount] = useState(0)
  const [manualDisabledCount, setManualDisabledCount] = useState(0)
  const [autoDisabledCount, setAutoDisabledCount] = useState(0)

  // Filter
  const [statusFilter, setStatusFilter] = useState<number | null>(null)

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [isPerformingAction, setIsPerformingAction] = useState(false)

  useEffect(() => {
    if (open && currentRow) {
      setCurrentPage(1)
      loadKeyStatus(1, pageSize, null)
    } else {
      // Reset state when dialog closes
      setKeys([])
      setTotal(0)
      setTotalPages(0)
      setEnabledCount(0)
      setManualDisabledCount(0)
      setAutoDisabledCount(0)
      setStatusFilter(null)
      setCurrentPage(1)
    }
  }, [open, currentRow?.id])

  const loadKeyStatus = async (
    page: number = currentPage,
    size: number = pageSize,
    status: number | null = statusFilter
  ) => {
    if (!currentRow) return

    setIsLoading(true)
    try {
      const response = await getMultiKeyStatus(
        currentRow.id,
        page,
        size,
        status === null ? undefined : status
      )

      if (response.success && response.data) {
        setKeys(response.data.keys || [])
        setTotal(response.data.total || 0)
        setCurrentPage(response.data.page || 1)
        setPageSize(response.data.page_size || 10)
        setTotalPages(response.data.total_pages || 0)
        setEnabledCount(response.data.enabled_count || 0)
        setManualDisabledCount(response.data.manual_disabled_count || 0)
        setAutoDisabledCount(response.data.auto_disabled_count || 0)
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load key status')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusFilterChange = (value: string) => {
    const newFilter = value === 'all' ? null : parseInt(value)
    setStatusFilter(newFilter)
    setCurrentPage(1)
    loadKeyStatus(1, pageSize, newFilter)
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    loadKeyStatus(newPage, pageSize)
  }

  const performAction = async () => {
    if (!confirmAction || !currentRow) return

    setIsPerformingAction(true)
    try {
      let response
      switch (confirmAction.type) {
        case 'enable':
          if (confirmAction.keyIndex !== undefined) {
            response = await enableMultiKey(
              currentRow.id,
              confirmAction.keyIndex
            )
          }
          break
        case 'disable':
          if (confirmAction.keyIndex !== undefined) {
            response = await disableMultiKey(
              currentRow.id,
              confirmAction.keyIndex
            )
          }
          break
        case 'delete':
          if (confirmAction.keyIndex !== undefined) {
            response = await deleteMultiKey(
              currentRow.id,
              confirmAction.keyIndex
            )
          }
          break
        case 'enable-all':
          response = await enableAllMultiKeys(currentRow.id)
          break
        case 'disable-all':
          response = await disableAllMultiKeys(currentRow.id)
          break
        case 'delete-disabled':
          response = await deleteDisabledMultiKeys(currentRow.id)
          break
      }

      if (response?.success) {
        toast.success(response.message || 'Operation successful')
        queryClient.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
        // Reload current page or reset to page 1 for bulk actions
        if (
          confirmAction.type.includes('all') ||
          confirmAction.type === 'delete-disabled'
        ) {
          setCurrentPage(1)
          loadKeyStatus(1, pageSize)
        } else {
          loadKeyStatus(currentPage, pageSize)
        }
      } else {
        toast.error(response?.message || 'Operation failed')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Operation failed')
    } finally {
      setIsPerformingAction(false)
      setConfirmAction(null)
    }
  }

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return (
          <Badge
            variant='outline'
            className='border-green-200 bg-green-50 text-green-700'
          >
            Enabled
          </Badge>
        )
      case 2:
        return (
          <Badge
            variant='outline'
            className='border-red-200 bg-red-50 text-red-700'
          >
            Disabled
          </Badge>
        )
      case 3:
        return (
          <Badge
            variant='outline'
            className='border-orange-200 bg-orange-50 text-orange-700'
          >
            Auto-Disabled
          </Badge>
        )
      default:
        return <Badge variant='outline'>Unknown</Badge>
    }
  }

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '-'
    return new Date(timestamp * 1000).toLocaleString()
  }

  if (!currentRow) return null

  const enabledPercent =
    total > 0 ? Math.round((enabledCount / total) * 100) : 0
  const manualDisabledPercent =
    total > 0 ? Math.round((manualDisabledCount / total) * 100) : 0
  const autoDisabledPercent =
    total > 0 ? Math.round((autoDisabledCount / total) * 100) : 0

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='flex max-h-[90vh] max-w-5xl flex-col overflow-hidden'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              Multi-Key Management
              <Badge variant='outline'>{currentRow.name}</Badge>
              <Badge variant='outline'>Total: {total}</Badge>
              {currentRow.channel_info?.multi_key_mode && (
                <Badge variant='outline'>
                  {currentRow.channel_info.multi_key_mode === 'random'
                    ? 'Random'
                    : 'Polling'}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Manage multi-key configuration for this channel
            </DialogDescription>
          </DialogHeader>

          <div className='flex-1 space-y-4 overflow-y-auto'>
            {/* Statistics Cards */}
            <div className='grid grid-cols-3 gap-4'>
              <div className='rounded-lg border bg-green-50/50 p-4 dark:bg-green-950/20'>
                <div className='mb-2 text-sm font-medium text-green-700 dark:text-green-300'>
                  Enabled
                </div>
                <div className='text-2xl font-bold text-green-900 dark:text-green-100'>
                  {enabledCount}
                  <span className='text-muted-foreground text-lg'>
                    {' '}
                    / {total}
                  </span>
                </div>
                <Progress value={enabledPercent} className='mt-2 h-2' />
              </div>

              <div className='rounded-lg border bg-red-50/50 p-4 dark:bg-red-950/20'>
                <div className='mb-2 text-sm font-medium text-red-700 dark:text-red-300'>
                  Manual Disabled
                </div>
                <div className='text-2xl font-bold text-red-900 dark:text-red-100'>
                  {manualDisabledCount}
                  <span className='text-muted-foreground text-lg'>
                    {' '}
                    / {total}
                  </span>
                </div>
                <Progress
                  value={manualDisabledPercent}
                  className='mt-2 h-2 [&>div]:bg-red-500'
                />
              </div>

              <div className='rounded-lg border bg-orange-50/50 p-4 dark:bg-orange-950/20'>
                <div className='mb-2 text-sm font-medium text-orange-700 dark:text-orange-300'>
                  Auto Disabled
                </div>
                <div className='text-2xl font-bold text-orange-900 dark:text-orange-100'>
                  {autoDisabledCount}
                  <span className='text-muted-foreground text-lg'>
                    {' '}
                    / {total}
                  </span>
                </div>
                <Progress
                  value={autoDisabledPercent}
                  className='mt-2 h-2 [&>div]:bg-orange-500'
                />
              </div>
            </div>

            {/* Toolbar */}
            <div className='flex items-center justify-between gap-2'>
              <div className='flex items-center gap-2'>
                <Select
                  value={
                    statusFilter === null ? 'all' : statusFilter.toString()
                  }
                  onValueChange={handleStatusFilterChange}
                >
                  <SelectTrigger className='w-40'>
                    <SelectValue placeholder='All Status' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Status</SelectItem>
                    <SelectItem value='1'>Enabled</SelectItem>
                    <SelectItem value='2'>Manual Disabled</SelectItem>
                    <SelectItem value='3'>Auto Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => loadKeyStatus()}
                  disabled={isLoading}
                >
                  <RefreshCw className='h-4 w-4' />
                </Button>

                {manualDisabledCount + autoDisabledCount > 0 && (
                  <Button
                    variant='default'
                    size='sm'
                    onClick={() => setConfirmAction({ type: 'enable-all' })}
                  >
                    <Power className='mr-2 h-4 w-4' />
                    Enable All
                  </Button>
                )}

                {enabledCount > 0 && (
                  <Button
                    variant='destructive'
                    size='sm'
                    onClick={() => setConfirmAction({ type: 'disable-all' })}
                  >
                    <PowerOff className='mr-2 h-4 w-4' />
                    Disable All
                  </Button>
                )}

                {autoDisabledCount > 0 && (
                  <Button
                    variant='destructive'
                    size='sm'
                    onClick={() =>
                      setConfirmAction({ type: 'delete-disabled' })
                    }
                  >
                    <Trash2 className='mr-2 h-4 w-4' />
                    Delete Auto-Disabled
                  </Button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className='rounded-lg border'>
              {isLoading ? (
                <div className='flex items-center justify-center py-12'>
                  <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
                </div>
              ) : keys.length === 0 ? (
                <div className='text-muted-foreground py-12 text-center'>
                  No keys found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-20'>Index</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Disabled Reason</TableHead>
                      <TableHead>Disabled Time</TableHead>
                      <TableHead className='text-right'>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keys.map((key) => (
                      <TableRow key={key.index}>
                        <TableCell className='font-mono'>
                          #{key.index}
                        </TableCell>
                        <TableCell>{getStatusBadge(key.status)}</TableCell>
                        <TableCell className='max-w-xs truncate'>
                          {key.reason || '-'}
                        </TableCell>
                        <TableCell className='text-muted-foreground text-sm'>
                          {formatTimestamp(key.disabled_time)}
                        </TableCell>
                        <TableCell className='text-right'>
                          <div className='flex justify-end gap-2'>
                            {key.status === 1 ? (
                              <Button
                                variant='outline'
                                size='sm'
                                onClick={() =>
                                  setConfirmAction({
                                    type: 'disable',
                                    keyIndex: key.index,
                                  })
                                }
                              >
                                Disable
                              </Button>
                            ) : (
                              <Button
                                variant='outline'
                                size='sm'
                                onClick={() =>
                                  setConfirmAction({
                                    type: 'enable',
                                    keyIndex: key.index,
                                  })
                                }
                              >
                                Enable
                              </Button>
                            )}
                            <Button
                              variant='destructive'
                              size='sm'
                              onClick={() =>
                                setConfirmAction({
                                  type: 'delete',
                                  keyIndex: key.index,
                                })
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className='flex items-center justify-between'>
                <div className='text-muted-foreground text-sm'>
                  Page {currentPage} of {totalPages}
                </div>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || isLoading}
                  >
                    Previous
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages || isLoading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className='flex items-center gap-2'>
              <AlertTriangle className='h-5 w-5 text-orange-500' />
              Confirm Action
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'delete' &&
                'Are you sure you want to delete this key? This action cannot be undone.'}
              {confirmAction?.type === 'enable' && 'Enable this key?'}
              {confirmAction?.type === 'disable' && 'Disable this key?'}
              {confirmAction?.type === 'enable-all' &&
                'Are you sure you want to enable all keys?'}
              {confirmAction?.type === 'disable-all' &&
                'Are you sure you want to disable all enabled keys?'}
              {confirmAction?.type === 'delete-disabled' &&
                'Are you sure you want to delete all auto-disabled keys? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPerformingAction}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={performAction}
              disabled={isPerformingAction}
              className={
                confirmAction?.type === 'delete' ||
                confirmAction?.type === 'delete-disabled' ||
                confirmAction?.type === 'disable-all'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {isPerformingAction && (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              )}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
