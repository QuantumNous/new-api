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
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ReceiptText,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { PageFooterPortal, SectionPageLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { formatCurrencyFromUSD } from '@/lib/currency'
import { formatNumber } from '@/lib/format'

import {
  formatTimestamp,
  getPaymentMethodName,
  getStatusConfig,
} from '../wallet/lib/billing'
import { useBillingHistory } from '../wallet/hooks/use-billing-history'

const SKELETON_ROW_KEYS = [
  'order-skeleton-1',
  'order-skeleton-2',
  'order-skeleton-3',
  'order-skeleton-4',
  'order-skeleton-5',
]

export function Orders() {
  const { t } = useTranslation()
  const {
    records,
    total,
    page,
    pageSize,
    keyword,
    loading,
    completing,
    handlePageChange,
    handlePageSizeChange,
    handleSearch,
    handleCompleteOrder,
    refresh,
  } = useBillingHistory()

  const [confirmTradeNo, setConfirmTradeNo] = useState<string | null>(null)
  const { copyToClipboard, copiedText } = useCopyToClipboard({ notify: false })

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  let tableRows: ReactNode
  if (loading) {
    tableRows = SKELETON_ROW_KEYS.map((key) => (
      <TableRow key={key}>
        <TableCell className='px-4 py-2.5' colSpan={8}>
          <Skeleton className='h-5 w-full' />
        </TableCell>
      </TableRow>
    ))
  } else if (records.length === 0) {
    tableRows = (
      <TableRow>
        <TableCell colSpan={8}>
          <div className='text-muted-foreground flex min-h-52 flex-col items-center justify-center gap-1 py-10 text-center'>
            <div className='bg-muted mb-2 flex size-10 items-center justify-center rounded-lg'>
              <ReceiptText
                className='text-muted-foreground size-5'
                aria-hidden='true'
              />
            </div>
            <p className='text-sm font-medium'>
              {t('No billing records found')}
            </p>
            <p className='text-xs'>
              {keyword
                ? t('Try adjusting your search')
                : t('Your transaction history will appear here')}
            </p>
          </div>
        </TableCell>
      </TableRow>
    )
  } else {
    tableRows = records.map((record) => {
      const statusConfig = getStatusConfig(record.status)
      return (
        <TableRow key={record.id} className='hover:bg-muted/30'>
          <TableCell className='px-4 py-2.5 align-middle'>
            <div className='flex min-w-0 items-center gap-1.5'>
              <code className='truncate font-mono text-sm'>
                {record.trade_no}
              </code>
              <Button
                variant='ghost'
                size='sm'
                className='h-5 w-5 shrink-0 p-0'
                onClick={() => copyToClipboard(record.trade_no)}
                aria-label={t('Copy')}
              >
                {copiedText === record.trade_no ? (
                  <Check className='h-3 w-3' />
                ) : (
                  <Copy className='h-3 w-3' />
                )}
              </Button>
            </div>
          </TableCell>
          <TableCell className='py-2.5 align-middle'>
            {record.user_id != null ? (
              <StatusBadge
                label={String(record.user_id)}
                variant='neutral'
                size='sm'
                copyText={String(record.user_id)}
              />
            ) : (
              <span className='text-muted-foreground text-xs'>-</span>
            )}
          </TableCell>
          <TableCell className='py-2.5 align-middle text-sm'>
            {getPaymentMethodName(record.payment_method, t)}
          </TableCell>
          <TableCell className='py-2.5 align-middle text-sm font-semibold'>
            {formatCurrencyFromUSD(record.amount, {
              digitsLarge: 2,
              digitsSmall: 2,
              abbreviate: false,
            })}
          </TableCell>
          <TableCell className='py-2.5 align-middle text-sm font-semibold text-red-600'>
            {formatNumber(record.money)}
          </TableCell>
          <TableCell className='py-2.5 align-middle'>
            <StatusBadge
              label={statusConfig.label}
              variant={statusConfig.variant}
              showDot
              copyable={false}
            />
          </TableCell>
          <TableCell className='text-muted-foreground py-2.5 align-middle text-xs whitespace-nowrap'>
            {formatTimestamp(record.create_time)}
          </TableCell>
          <TableCell className='py-2.5 pr-4 text-right align-middle'>
            {record.status === 'pending' ? (
              <Button
                size='sm'
                variant='outline'
                onClick={() => setConfirmTradeNo(record.trade_no)}
                disabled={completing}
              >
                {t('Complete Order')}
              </Button>
            ) : (
              <span className='text-muted-foreground text-xs'>-</span>
            )}
          </TableCell>
        </TableRow>
      )
    })
  }

  const handleConfirmComplete = async () => {
    if (!confirmTradeNo) return
    const success = await handleCompleteOrder(confirmTradeNo)
    if (success) {
      setConfirmTradeNo(null)
    }
  }

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {t('Order Management')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <div className='relative w-full sm:w-64'>
            <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
            <Input
              placeholder={t('Search by order number...')}
              value={keyword}
              onChange={(e) => handleSearch(e.target.value)}
              className='h-9 pl-10'
            />
          </div>
          <Select
            items={[
              { value: '10', label: t('10 / page') },
              { value: '20', label: t('20 / page') },
              { value: '50', label: t('50 / page') },
              { value: '100', label: t('100 / page') },
            ]}
            value={pageSize.toString()}
            onValueChange={(value) =>
              value !== null && handlePageSizeChange(Number.parseInt(value))
            }
          >
            <SelectTrigger className='h-9 w-[92px] sm:w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectItem value='10'>{t('10 / page')}</SelectItem>
                <SelectItem value='20'>{t('20 / page')}</SelectItem>
                <SelectItem value='50'>{t('50 / page')}</SelectItem>
                <SelectItem value='100'>{t('100 / page')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => refresh()}
            disabled={loading}
            aria-label={t('Refresh')}
          >
            <RefreshCw
              data-icon='inline-start'
              className='size-3.5'
              aria-hidden='true'
            />
            {t('Refresh')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='h-full overflow-auto rounded-md border'>
            <Table className='min-w-[900px]'>
              <TableHeader>
                <TableRow className='bg-muted/40 hover:bg-muted/40'>
                  <TableHead className='h-9 min-w-[220px] px-4 text-xs'>
                    {t('Order Number')}
                  </TableHead>
                  <TableHead className='h-9 w-[100px] text-xs'>
                    {t('User ID')}
                  </TableHead>
                  <TableHead className='h-9 w-[140px] text-xs'>
                    {t('Payment Method')}
                  </TableHead>
                  <TableHead className='h-9 w-[120px] text-xs'>
                    {t('Amount')}
                  </TableHead>
                  <TableHead className='h-9 w-[120px] text-xs'>
                    {t('Payment')}
                  </TableHead>
                  <TableHead className='h-9 w-[110px] text-xs'>
                    {t('Status')}
                  </TableHead>
                  <TableHead className='h-9 w-[170px] text-xs'>
                    {t('Created')}
                  </TableHead>
                  <TableHead className='h-9 w-[120px] pr-4 text-right text-xs'>
                    {t('Actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{tableRows}</TableBody>
            </Table>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      {!loading && total > 0 && (
        <PageFooterPortal>
          <div className='flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between'>
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
                aria-label={t('Previous')}
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
                aria-label={t('Next')}
              >
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
          </div>
        </PageFooterPortal>
      )}

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
            <AlertDialogAction onClick={handleConfirmComplete} disabled={completing}>
              {completing ? t('Processing...') : t('Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
