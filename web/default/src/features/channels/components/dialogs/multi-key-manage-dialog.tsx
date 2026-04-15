import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw, Trash2, Power, PowerOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { StatusBadge } from '@/components/status-badge'
import {
  getMultiKeyStatus,
  enableMultiKey,
  disableMultiKey,
  deleteMultiKey,
  enableAllMultiKeys,
  disableAllMultiKeys,
  deleteDisabledMultiKeys,
} from '../../api'
import { MULTI_KEY_FILTER_OPTIONS } from '../../constants'
import {
  channelsQueryKeys,
  formatTimestamp,
  getMultiKeyStatusConfig,
  getMultiKeyConfirmMessage,
  isDestructiveAction,
} from '../../lib'
import type { KeyStatus, MultiKeyConfirmAction } from '../../types'
import { useChannels } from '../channels-provider'
import { StatisticsCard } from './multi-key-statistics-card'
import { MultiKeyTableRowActions } from './multi-key-table-row-actions'

type MultiKeyManageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MultiKeyManageDialog({
  open,
  onOpenChange,
}: MultiKeyManageDialogProps) {
  const { t } = useTranslation()
  const { currentRow } = useChannels()
  const queryClient = useQueryClient()

  // Data state
  const [isLoading, setIsLoading] = useState(false)
  const [keys, setKeys] = useState<KeyStatus[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [enabledCount, setEnabledCount] = useState(0)
  const [manualDisabledCount, setManualDisabledCount] = useState(0)
  const [autoDisabledCount, setAutoDisabledCount] = useState(0)

  // UI state
  const [statusFilter, setStatusFilter] = useState<number | null>(null)
  const [confirmAction, setConfirmAction] =
    useState<MultiKeyConfirmAction | null>(null)
  const [isPerformingAction, setIsPerformingAction] = useState(false)

  // Reset and load data when dialog opens
  useEffect(() => {
    if (open && currentRow) {
      setCurrentPage(1)
      setStatusFilter(null)
      loadKeyStatus(1, pageSize, null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to load key status'
      )
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
      const { type, keyIndex } = confirmAction
      let response

      // Execute the appropriate action
      if (type === 'enable' && keyIndex !== undefined) {
        response = await enableMultiKey(currentRow.id, keyIndex)
      } else if (type === 'disable' && keyIndex !== undefined) {
        response = await disableMultiKey(currentRow.id, keyIndex)
      } else if (type === 'delete' && keyIndex !== undefined) {
        response = await deleteMultiKey(currentRow.id, keyIndex)
      } else if (type === 'enable-all') {
        response = await enableAllMultiKeys(currentRow.id)
      } else if (type === 'disable-all') {
        response = await disableAllMultiKeys(currentRow.id)
      } else if (type === 'delete-disabled') {
        response = await deleteDisabledMultiKeys(currentRow.id)
      }

      if (response?.success) {
        toast.success(response.message || 'Operation successful')
        queryClient.invalidateQueries({ queryKey: channelsQueryKeys.lists() })

        // Reload data - reset to page 1 for bulk actions
        const isBulkAction = type.includes('all') || type === 'delete-disabled'
        if (isBulkAction) {
          setCurrentPage(1)
          loadKeyStatus(1, pageSize)
        } else {
          loadKeyStatus(currentPage, pageSize)
        }
      } else {
        toast.error(response?.message || 'Operation failed')
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Operation failed')
    } finally {
      setIsPerformingAction(false)
      setConfirmAction(null)
    }
  }

  const renderStatusBadge = (status: number) => {
    const config = getMultiKeyStatusConfig(status)
    return (
      <StatusBadge
        label={t(config.label)}
        variant={config.variant}
        showDot
        copyable={false}
      />
    )
  }

  const formatKeyTimestamp = (timestamp?: number) => {
    if (!timestamp) return '-'
    return formatTimestamp(timestamp)
  }

  if (!currentRow) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='flex max-h-[90vh] max-w-5xl flex-col'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              {t('Multi-Key Management')}
              <StatusBadge
                label={currentRow.name}
                variant='neutral'
                copyable={false}
              />
              {currentRow.channel_info?.multi_key_mode && (
                <StatusBadge
                  label={
                    currentRow.channel_info.multi_key_mode === 'random'
                      ? t('Random')
                      : t('Polling')
                  }
                  variant='neutral'
                  copyable={false}
                />
              )}
            </DialogTitle>
            <DialogDescription>
              {t('Manage multi-key status and configuration for this channel')}
            </DialogDescription>
          </DialogHeader>

          <div className='flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden'>
            {/* Statistics */}
            <div className='grid shrink-0 grid-cols-3 gap-3'>
              <StatisticsCard
                label={t('Enabled')}
                count={enabledCount}
                total={total}
              />
              <StatisticsCard
                label={t('Manual Disabled')}
                count={manualDisabledCount}
                total={total}
              />
              <StatisticsCard
                label={t('Auto Disabled')}
                count={autoDisabledCount}
                total={total}
              />
            </div>

            <Separator className='shrink-0' />

            {/* Toolbar */}
            <div className='flex shrink-0 items-center justify-between'>
              <Select
                value={statusFilter === null ? 'all' : statusFilter.toString()}
                onValueChange={handleStatusFilterChange}
              >
                <SelectTrigger className='w-40'>
                  <SelectValue placeholder={t('All Status')} />
                </SelectTrigger>
                <SelectContent>
                  {MULTI_KEY_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
                    {t('Enable All')}
                  </Button>
                )}

                {enabledCount > 0 && (
                  <Button
                    variant='destructive'
                    size='sm'
                    onClick={() => setConfirmAction({ type: 'disable-all' })}
                  >
                    <PowerOff className='mr-2 h-4 w-4' />
                    {t('Disable All')}
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
                    {t('Delete Auto-Disabled')}
                  </Button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className='min-h-0 flex-1 overflow-auto rounded-md border'>
              {isLoading ? (
                <div className='flex items-center justify-center py-12'>
                  <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
                </div>
              ) : keys.length === 0 ? (
                <div className='text-muted-foreground py-12 text-center'>
                  {t('No keys found')}
                </div>
              ) : (
                <div className='min-w-[800px]'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className='w-20'>{t('Index')}</TableHead>
                        <TableHead className='w-32'>{t('Status')}</TableHead>
                        <TableHead className='min-w-[200px]'>
                          {t('Disabled Reason')}
                        </TableHead>
                        <TableHead className='w-44'>
                          {t('Disabled Time')}
                        </TableHead>
                        <TableHead className='w-44 text-right'>
                          {t('Actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {keys.map((key) => (
                        <TableRow key={key.index}>
                          <TableCell className='font-mono text-sm'>
                            #{key.index + 1}
                          </TableCell>
                          <TableCell>{renderStatusBadge(key.status)}</TableCell>
                          <TableCell className='max-w-xs truncate text-sm'>
                            {key.reason || '-'}
                          </TableCell>
                          <TableCell className='text-muted-foreground text-sm'>
                            {formatKeyTimestamp(key.disabled_time)}
                          </TableCell>
                          <TableCell>
                            <MultiKeyTableRowActions
                              keyIndex={key.index}
                              status={key.status}
                              onAction={setConfirmAction}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className='flex shrink-0 items-center justify-between'>
                <div className='text-muted-foreground text-sm'>
                  {t('Page {{current}} of {{total}}', {
                    current: currentPage,
                    total: totalPages,
                  })}
                </div>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || isLoading}
                  >
                    {t('Previous')}
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages || isLoading}
                  >
                    {t('Next')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={t('Confirm Action')}
        desc={t(getMultiKeyConfirmMessage(confirmAction))}
        destructive={isDestructiveAction(confirmAction)}
        isLoading={isPerformingAction}
        handleConfirm={performAction}
      />
    </>
  )
}
