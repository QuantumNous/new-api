import { useState } from 'react'
import { Search, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatCurrencyFromUSD } from '@/lib/currency'
import { formatNumber } from '@/lib/format'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import { useBillingHistory } from '../../hooks/use-billing-history'
import {
  getStatusConfig,
  getPaymentMethodName,
  formatTimestamp,
} from '../../lib/billing'

interface BillingHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BillingHistoryDialog({
  open,
  onOpenChange,
}: BillingHistoryDialogProps) {
  const { t } = useTranslation()
  const {
    records,
    total,
    page,
    pageSize,
    keyword,
    loading,
    completing,
    isAdmin,
    handlePageChange,
    handlePageSizeChange,
    handleSearch,
    handleCompleteOrder,
  } = useBillingHistory()

  const [confirmTradeNo, setConfirmTradeNo] = useState<string | null>(null)
  const { copyToClipboard, copiedText } = useCopyToClipboard({ notify: false })

  const totalPages = Math.ceil(total / pageSize)

  const handleConfirmComplete = async () => {
    if (confirmTradeNo) {
      const success = await handleCompleteOrder(confirmTradeNo)
      if (success) {
        setConfirmTradeNo(null)
      }
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='flex max-h-[calc(100dvh-2rem)] flex-col max-sm:h-dvh max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:p-4 sm:max-w-4xl'>
          <DialogHeader>
            <DialogTitle>{t('Billing History')}</DialogTitle>
            <DialogDescription>
              {t('View your topup transaction records and payment history')}
            </DialogDescription>
          </DialogHeader>

          <div className='min-h-0 flex-1 space-y-3 sm:space-y-4'>
            {/* Search and Filter Bar */}
            <div className='flex items-center gap-2'>
              <div className='relative flex-1'>
                <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                <Input
                  placeholder={t('Search by order number...')}
                  value={keyword}
                  onChange={(e) => handleSearch(e.target.value)}
                  className='h-9 pl-10'
                />
              </div>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) =>
                  value !== null && handlePageSizeChange(parseInt(value))
                }
              >
                <SelectTrigger className='h-9 w-[92px] sm:w-32'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='10'>{t('10 / page')}</SelectItem>
                  <SelectItem value='20'>{t('20 / page')}</SelectItem>
                  <SelectItem value='50'>{t('50 / page')}</SelectItem>
                  <SelectItem value='100'>{t('100 / page')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Records List */}
            <ScrollArea className='h-[calc(100dvh-15rem)] pr-3 sm:h-[500px] sm:pr-4'>
              {loading ? (
                <div className='space-y-3'>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className='rounded-lg border p-3 sm:p-4'>
                      <div className='flex items-start justify-between'>
                        <div className='flex-1 space-y-2'>
                          <Skeleton className='h-4 w-48' />
                          <Skeleton className='h-3 w-32' />
                        </div>
                        <Skeleton className='h-5 w-16' />
                      </div>
                      <div className='mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4'>
                        <Skeleton className='h-3 w-full' />
                        <Skeleton className='h-3 w-full' />
                        <Skeleton className='h-3 w-full' />
                      </div>
                    </div>
                  ))}
                </div>
              ) : records.length === 0 ? (
                <div className='text-muted-foreground flex h-[320px] flex-col items-center justify-center text-center sm:h-[400px]'>
                  <p className='text-sm font-medium'>
                    {t('No billing records found')}
                  </p>
                  <p className='mt-1 text-xs'>
                    {keyword
                      ? 'Try adjusting your search'
                      : 'Your transaction history will appear here'}
                  </p>
                </div>
              ) : (
                <div className='space-y-3'>
                  {records.map((record) => {
                    const statusConfig = getStatusConfig(record.status)
                    return (
                      <div
                        key={record.id}
                        className='hover:bg-muted/50 rounded-lg border p-3 transition-colors sm:p-4'
                      >
                        {/* Header Row */}
                        <div className='flex items-start justify-between gap-2'>
                          <div className='flex-1 space-y-1'>
                            <div className='flex min-w-0 items-center gap-2'>
                              <code className='text-foreground truncate font-mono text-sm'>
                                {record.trade_no}
                              </code>
                              <Button
                                variant='ghost'
                                size='sm'
                                className='h-5 w-5 p-0'
                                onClick={() => copyToClipboard(record.trade_no)}
                              >
                                {copiedText === record.trade_no ? (
                                  <Check className='h-3 w-3' />
                                ) : (
                                  <Copy className='h-3 w-3' />
                                )}
                              </Button>
                              {isAdmin && record.user_id != null && (
                                <StatusBadge
                                  label={`${t('User ID')}: ${record.user_id}`}
                                  variant='neutral'
                                  size='sm'
                                  copyText={String(record.user_id)}
                                />
                              )}
                            </div>
                            <div className='text-muted-foreground text-xs'>
                              {formatTimestamp(record.create_time)}
                            </div>
                          </div>
                          <StatusBadge
                            label={statusConfig.label}
                            variant={statusConfig.variant}
                            showDot
                            copyable={false}
                          />
                        </div>

                        {/* Details Grid */}
                        <div className='mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:grid-cols-3 sm:gap-4'>
                          <div className='space-y-1'>
                            <Label className='text-muted-foreground text-xs'>
                              Payment Method
                            </Label>
                            <div className='text-sm font-medium'>
                              {getPaymentMethodName(record.payment_method)}
                            </div>
                          </div>
                          <div className='space-y-1'>
                            <Label className='text-muted-foreground text-xs'>
                              Amount
                            </Label>
                            <div className='text-sm font-semibold'>
                              {formatCurrencyFromUSD(record.amount, {
                                digitsLarge: 2,
                                digitsSmall: 2,
                                abbreviate: false,
                              })}
                            </div>
                          </div>
                          <div className='space-y-1'>
                            <Label className='text-muted-foreground text-xs'>
                              Payment
                            </Label>
                            <div className='text-sm font-semibold text-red-600'>
                              {formatNumber(record.money)}
                            </div>
                          </div>
                        </div>

                        {/* Admin Actions */}
                        {isAdmin && record.status === 'pending' && (
                          <div className='mt-4 flex justify-end'>
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() => setConfirmTradeNo(record.trade_no)}
                              disabled={completing}
                            >
                              Complete Order
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Pagination */}
            {!loading && records.length > 0 && (
              <div className='flex flex-col items-center gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between'>
                <div className='text-muted-foreground text-xs sm:text-sm'>
                  {t('Showing')} {(page - 1) * pageSize + 1}-
                  {Math.min(page * pageSize, total)} {t('of')} {total}
                </div>
                <div className='flex items-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className='h-8 w-8 p-0'
                  >
                    <ChevronLeft className='h-4 w-4' />
                  </Button>
                  <div className='text-muted-foreground flex items-center gap-1 text-sm'>
                    <span className='font-medium'>{page}</span>
                    <span>/</span>
                    <span>{totalPages}</span>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                    className='h-8 w-8 p-0'
                  >
                    <ChevronRight className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Complete Order Dialog */}
      <AlertDialog
        open={!!confirmTradeNo}
        onOpenChange={(open) => !open && setConfirmTradeNo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Complete Order')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Are you sure you want to manually complete this order? The user will be credited with the corresponding quota.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completing}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmComplete}
              disabled={completing}
            >
              {completing ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
