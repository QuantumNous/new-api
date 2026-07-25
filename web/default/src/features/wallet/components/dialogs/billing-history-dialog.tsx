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
import { useEffect, useState } from 'react'
import {
  Search,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  CalendarClock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { trackSuccessfulTopups } from '@/lib/analytics/topup-tracking'
import {
  formatBillingCurrencyFromUSD,
  formatCurrencyFromUSD,
} from '@/lib/currency'
import { formatNumber, formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog } from '@/components/dialog'
import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import { getInvoiceProfile, isApiSuccess } from '../../api'
import { useBillingHistory } from '../../hooks/use-billing-history'
import { useRefundableTerms } from '../../hooks/use-refundable-terms'
import {
  getStatusConfig,
  getPaymentMethodName,
  formatTimestamp,
} from '../../lib/billing'
import {
  EMPTY_INVOICE_PROFILE,
  normalizeInvoiceProfile,
  validateInvoiceProfile,
} from '../../lib/invoice'
import {
  buildPaddleWalletCheckoutUrlWithOrder,
  isPaddlePayment,
  isStripePayment,
} from '../../lib/payment'
import type {
  InvoiceProfile,
  RefundableSubscriptionTerm,
  RefundableSubscriptionTermsData,
  TopupRecord,
} from '../../types'

interface BillingHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface BillingHistoryPanelProps {
  scrollAreaClassName?: string
  onAvailabilityChange?: (available: boolean) => void
  onResumeStripeCheckout?: (record: TopupRecord) => Promise<void>
  onRefundSuccess?: () => void | Promise<void>
}

interface RefundableTermsContentProps {
  data: RefundableSubscriptionTermsData
  refundingTermId: number | null
  onRequestRefund: (term: RefundableSubscriptionTerm) => void
}

interface RefundableTermsManagerProps {
  data: RefundableSubscriptionTermsData
  refundingTermId: number | null
  onConfirmRefund: (term: RefundableSubscriptionTerm) => Promise<boolean>
}

interface RefundableTermConfirmationDetailsProps {
  term: RefundableSubscriptionTerm
}

interface RefundableTermsLoadErrorProps {
  retrying: boolean
  onRetry: () => void
}

interface BillingHistoryAvailabilityInput {
  billingTotal: number
  refundableTermCount: number
  refundableTermsError: boolean
}

// eslint-disable-next-line react-refresh/only-export-components
export function isBillingHistoryPanelAvailable({
  billingTotal,
  refundableTermCount,
  refundableTermsError,
}: BillingHistoryAvailabilityInput): boolean {
  return billingTotal > 0 || refundableTermCount > 0 || refundableTermsError
}

function formatRefundMoney(amount: number): string {
  return formatBillingCurrencyFromUSD(amount, {
    digitsLarge: 2,
    digitsSmall: 4,
    abbreviate: false,
  })
}

export function RefundableTermConfirmationDetails({
  term,
}: RefundableTermConfirmationDetailsProps) {
  const { t } = useTranslation()

  return (
    <dl className='bg-muted/30 grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-2'>
      <div className='space-y-1'>
        <dt className='text-muted-foreground text-xs'>{t('Refund amount')}</dt>
        <dd className='font-mono font-semibold tabular-nums'>
          {formatRefundMoney(term.refund_money)}
        </dd>
      </div>
      <div className='space-y-1'>
        <dt className='text-muted-foreground text-xs'>
          {t('Return to Flatkey available balance')}
        </dt>
        <dd className='font-mono font-semibold tabular-nums'>
          {formatQuota(term.refund_quota)}
        </dd>
      </div>
    </dl>
  )
}

export function RefundableTermsLoadError({
  retrying,
  onRetry,
}: RefundableTermsLoadErrorProps) {
  const { t } = useTranslation()

  return (
    <div
      className='border-destructive/30 bg-destructive/5 flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between'
      role='alert'
    >
      <div className='flex min-w-0 items-center gap-2 text-sm'>
        <AlertCircle className='text-destructive h-4 w-4 shrink-0' />
        <span>{t('Failed to load refundable plan terms')}</span>
      </div>
      <Button
        type='button'
        size='sm'
        variant='outline'
        className='shrink-0'
        disabled={retrying}
        onClick={onRetry}
      >
        {retrying ? (
          <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
        ) : (
          <RefreshCw className='mr-1.5 h-3.5 w-3.5' />
        )}
        {retrying ? t('Retrying...') : t('Retry')}
      </Button>
    </div>
  )
}

function isPendingPaddleRecord(record: TopupRecord): boolean {
  if (record.status !== 'pending') {
    return false
  }

  return (
    isPaddlePayment(record.payment_method?.trim().toLowerCase() ?? '') ||
    isPaddlePayment(record.payment_provider?.trim().toLowerCase() ?? '')
  )
}

function isPaidStripeRecord(record: TopupRecord): boolean {
  if (record.status !== 'success') {
    return false
  }

  return (
    isStripePayment(record.payment_method?.trim().toLowerCase() ?? '') ||
    isStripePayment(record.payment_provider?.trim().toLowerCase() ?? '')
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function isPendingStripeRecord(record: TopupRecord): boolean {
  if (record.status !== 'pending' || !record.gateway_trade_no?.trim()) {
    return false
  }
  return (
    isStripePayment(record.payment_method?.trim().toLowerCase() ?? '') ||
    isStripePayment(record.payment_provider?.trim().toLowerCase() ?? '')
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function isSubscriptionRecord(record: TopupRecord): boolean {
  return (
    record.trade_no.startsWith('sub_ref_') ||
    record.trade_no.startsWith('SUBBAL') ||
    record.trade_no.startsWith('SUBPUR') ||
    record.trade_no.startsWith('SUBSTR')
  )
}

function hasExistingInvoice(record: TopupRecord): boolean {
  const invoice = record.invoice
  if (!invoice) {
    return false
  }

  return (
    invoice.invoice_requested === true ||
    !!invoice.stripe_invoice_id?.trim() ||
    !!invoice.stripe_invoice_url?.trim() ||
    !!invoice.stripe_invoice_pdf?.trim()
  )
}

function hasStripeInvoiceDocument(record: TopupRecord): boolean {
  const invoice = record.invoice
  if (!invoice) {
    return false
  }

  return (
    !!invoice.stripe_invoice_id?.trim() ||
    !!invoice.stripe_invoice_url?.trim() ||
    !!invoice.stripe_invoice_pdf?.trim()
  )
}

function canRetryInvoice(record: TopupRecord): boolean {
  const invoice = record.invoice
  if (!invoice || hasStripeInvoiceDocument(record)) {
    return false
  }

  return invoice.invoice_status === 'failed'
}

function getPaddleGatewayTradeNo(record: TopupRecord): string {
  return record.gateway_trade_no?.trim() || ''
}

function getInvoiceStatusLabel(status?: string): string {
  switch (status) {
    case 'paid':
      return 'Invoiced'
    case 'failed':
      return 'Invoice failed'
    case 'expired':
      return 'Invoice expired'
    case 'pending':
      return 'Invoice pending'
    default:
      return 'Invoice requested'
  }
}

function getInvoiceStatusVariant(status?: string): StatusVariant {
  if (status === 'paid') {
    return 'success'
  }
  if (status === 'failed' || status === 'expired') {
    return 'danger'
  }
  return 'neutral'
}

export function RefundableTermsContent({
  data,
  refundingTermId,
  onRequestRefund,
}: RefundableTermsContentProps) {
  const { t } = useTranslation()

  return (
    <div className='space-y-3'>
      <div className='bg-muted/40 text-muted-foreground rounded-md border px-3 py-2 text-xs leading-relaxed'>
        {t(
          'Started plan terms are not refundable. Eligible refunds return to your Flatkey available balance, not the original payment method.'
        )}
      </div>

      <div className='flex items-center justify-between gap-3 text-sm'>
        <span className='text-muted-foreground'>
          {t('Total refundable balance')}
        </span>
        <span className='font-mono font-semibold tabular-nums'>
          {formatQuota(data.total_refund_quota)}
        </span>
      </div>

      <div className='space-y-2'>
        {data.items.map((term) => {
          const isRefunding = refundingTermId === term.term_segment_id
          return (
            <div
              key={term.term_segment_id}
              className='rounded-md border p-3'
              data-wallet-refundable-term={term.term_segment_id}
            >
              <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div className='min-w-0 flex-1'>
                  <h4 className='truncate text-sm font-semibold'>
                    {term.plan_title}
                  </h4>
                  <dl className='mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3 lg:grid-cols-5'>
                    <div className='space-y-1'>
                      <dt className='text-muted-foreground'>
                        {t('Start date')}
                      </dt>
                      <dd className='font-medium tabular-nums'>
                        {formatTimestamp(term.start_time)}
                      </dd>
                    </div>
                    <div className='space-y-1'>
                      <dt className='text-muted-foreground'>{t('End date')}</dt>
                      <dd className='font-medium tabular-nums'>
                        {formatTimestamp(term.end_time)}
                      </dd>
                    </div>
                    <div className='space-y-1'>
                      <dt className='text-muted-foreground'>
                        {t('Remaining days')}
                      </dt>
                      <dd className='font-medium tabular-nums'>
                        {t('{{count}} days', { count: term.remaining_days })}
                      </dd>
                    </div>
                    <div className='space-y-1'>
                      <dt className='text-muted-foreground'>
                        {t('Refund amount')}
                      </dt>
                      <dd className='font-mono font-semibold tabular-nums'>
                        {formatRefundMoney(term.refund_money)}
                      </dd>
                    </div>
                    <div className='space-y-1'>
                      <dt className='text-muted-foreground'>
                        {t('Return to Flatkey available balance')}
                      </dt>
                      <dd className='font-mono font-semibold tabular-nums'>
                        {formatQuota(term.refund_quota)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <Button
                  size='sm'
                  variant='outline'
                  className='shrink-0'
                  disabled={refundingTermId !== null}
                  onClick={() => onRequestRefund(term)}
                >
                  {isRefunding && (
                    <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
                  )}
                  {isRefunding ? t('Processing...') : t('Refund term')}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function RefundableTermsManager({
  data,
  refundingTermId,
  onConfirmRefund,
}: RefundableTermsManagerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [confirmTerm, setConfirmTerm] =
    useState<RefundableSubscriptionTerm | null>(null)

  if (data.items.length === 0) {
    return null
  }

  const handleConfirmRefund = async (): Promise<void> => {
    if (!confirmTerm || refundingTermId !== null) {
      return
    }
    const success = await onConfirmRefund(confirmTerm)
    if (success) {
      setConfirmTerm(null)
    }
  }

  return (
    <>
      <div className='flex justify-end'>
        <Button
          variant='ghost'
          size='sm'
          className='text-muted-foreground h-8 px-2 text-xs'
          onClick={() => setOpen(true)}
        >
          <CalendarClock className='mr-1.5 h-3.5 w-3.5' />
          {t('Manage not-started terms')}
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && refundingTermId !== null) return
          setOpen(nextOpen)
        }}
        title={t('Refundable plan terms')}
        description={t(
          'Started plan terms are not refundable. Eligible refunds return to your Flatkey available balance, not the original payment method.'
        )}
        contentClassName='sm:max-w-3xl'
        bodyClassName='space-y-3'
        showCloseButton
      >
        <RefundableTermsContent
          data={data}
          refundingTermId={refundingTermId}
          onRequestRefund={setConfirmTerm}
        />
      </Dialog>

      <AlertDialog
        open={!!confirmTerm}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && refundingTermId === null) setConfirmTerm(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('Confirm refund to Flatkey balance')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('This is not a refund to the original payment method.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmTerm ? (
            <RefundableTermConfirmationDetails term={confirmTerm} />
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refundingTermId !== null}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={refundingTermId !== null}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmRefund()
              }}
            >
              {refundingTermId !== null && (
                <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
              )}
              {refundingTermId !== null ? t('Processing...') : t('Refund term')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function BillingHistoryPanel(props: BillingHistoryPanelProps) {
  const { onAvailabilityChange, scrollAreaClassName } = props
  const { t } = useTranslation()
  const {
    records,
    total,
    page,
    pageSize,
    keyword,
    loading,
    completing,
    requestingInvoice,
    isAdmin,
    handlePageChange,
    handlePageSizeChange,
    handleSearch,
    handleCompleteOrder,
    handleRequestInvoice,
    refresh: refreshBillingHistory,
  } = useBillingHistory()
  const {
    data: refundableTerms,
    loading: refundableTermsLoading,
    error: refundableTermsError,
    retrying: refundableTermsRetrying,
    refundingTermId,
    retry: retryRefundableTerms,
    refundTerm,
  } = useRefundableTerms()

  const billingHistoryAvailable = isBillingHistoryPanelAvailable({
    billingTotal: total,
    refundableTermCount: refundableTerms.items.length,
    refundableTermsError,
  })

  // Fire the top-up (purchase) conversion for any freshly-succeeded top-up that
  // lands here — covers redirect-back providers (Stripe/epay) the inline Paddle
  // poll never sees. De-duped + recency-gated in trackSuccessfulTopups, so this
  // is safe to run on every records change and never back-fires for old top-ups.
  useEffect(() => {
    if (records.length) trackSuccessfulTopups(records)
  }, [records])

  useEffect(() => {
    if (loading || refundableTermsLoading) return
    onAvailabilityChange?.(billingHistoryAvailable)
  }, [
    billingHistoryAvailable,
    loading,
    onAvailabilityChange,
    refundableTermsLoading,
  ])

  const [confirmTradeNo, setConfirmTradeNo] = useState<string | null>(null)
  const [resumingTradeNo, setResumingTradeNo] = useState<string | null>(null)
  const [invoiceTradeNo, setInvoiceTradeNo] = useState<string | null>(null)
  const [invoiceProfile, setInvoiceProfile] = useState<InvoiceProfile>(
    EMPTY_INVOICE_PROFILE
  )
  const [invoiceProfileLoading, setInvoiceProfileLoading] = useState(false)
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

  useEffect(() => {
    if (!invoiceTradeNo) {
      return
    }

    let cancelled = false
    setInvoiceProfile(EMPTY_INVOICE_PROFILE)
    setInvoiceProfileLoading(true)
    getInvoiceProfile()
      .then((response) => {
        if (cancelled) {
          return
        }
        if (isApiSuccess(response) && response.data) {
          setInvoiceProfile({
            ...EMPTY_INVOICE_PROFILE,
            ...response.data,
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(t('Failed to load invoice profile'))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInvoiceProfileLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [invoiceTradeNo, t])

  if (!loading && !refundableTermsLoading && !billingHistoryAvailable) {
    return null
  }

  const handleConfirmTermRefund = (
    term: RefundableSubscriptionTerm
  ): Promise<boolean> =>
    refundTerm(term.term_segment_id, async () => {
      await Promise.all([refreshBillingHistory(), props.onRefundSuccess?.()])
    })

  const updateInvoiceField = (
    field: keyof InvoiceProfile,
    value: string
  ): void => {
    setInvoiceProfile((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleOpenInvoiceRequest = (record: TopupRecord): void => {
    setInvoiceTradeNo(record.trade_no)
  }

  const handleConfirmRequestInvoice = async (): Promise<void> => {
    if (!invoiceTradeNo) {
      return
    }

    const normalized = normalizeInvoiceProfile(invoiceProfile)
    const validationMessage = validateInvoiceProfile(normalized)
    if (validationMessage) {
      toast.error(t(validationMessage))
      return
    }

    const success = await handleRequestInvoice(invoiceTradeNo, normalized)
    if (success) {
      setInvoiceTradeNo(null)
    }
  }

  const handleReopenPaddleCheckout = (record: TopupRecord): void => {
    const gatewayTradeNo = getPaddleGatewayTradeNo(record)
    if (!gatewayTradeNo) {
      return
    }

    window.location.assign(
      buildPaddleWalletCheckoutUrlWithOrder(gatewayTradeNo, record.trade_no)
    )
  }

  const handleReopenStripeCheckout = async (
    record: TopupRecord
  ): Promise<void> => {
    if (!props.onResumeStripeCheckout || resumingTradeNo) return
    setResumingTradeNo(record.trade_no)
    try {
      await props.onResumeStripeCheckout(record)
    } finally {
      setResumingTradeNo(null)
    }
  }

  return (
    <>
      <div className='min-h-0 space-y-3'>
        {refundableTermsError ? (
          <RefundableTermsLoadError
            retrying={refundableTermsRetrying}
            onRetry={() => void retryRefundableTerms()}
          />
        ) : (
          <RefundableTermsManager
            data={refundableTerms}
            refundingTermId={refundingTermId}
            onConfirmRefund={handleConfirmTermRefund}
          />
        )}

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
            items={[
              { value: '10', label: t('10 / page') },
              { value: '20', label: t('20 / page') },
              { value: '50', label: t('50 / page') },
              { value: '100', label: t('100 / page') },
            ]}
            value={pageSize.toString()}
            onValueChange={(value) =>
              value !== null && handlePageSizeChange(parseInt(value))
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
        </div>

        {/* Records List */}
        <ScrollArea
          className={cn(
            'max-h-[min(54vh,520px)] pr-3 sm:pr-4',
            scrollAreaClassName
          )}
        >
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
            <div className='text-muted-foreground flex min-h-40 flex-col items-center justify-center py-10 text-center'>
              <p className='text-sm font-medium'>
                {t('No billing records found')}
              </p>
              <p className='mt-1 text-xs'>
                {keyword
                  ? t('Try adjusting your search')
                  : t('Your transaction history will appear here')}
              </p>
            </div>
          ) : (
            <div className='space-y-3'>
              {records.map((record) => {
                const statusConfig = getStatusConfig(record.status)
                const canReopenPaddleCheckout =
                  isPendingPaddleRecord(record) &&
                  getPaddleGatewayTradeNo(record) !== ''
                const canReopenStripeCheckout =
                  !!props.onResumeStripeCheckout &&
                  isPendingStripeRecord(record)
                const invoice = record.invoice
                const hasInvoice = invoice?.invoice_requested === true
                const invoiceUrl = invoice?.stripe_invoice_url?.trim()
                const invoicePdf = invoice?.stripe_invoice_pdf?.trim()
                const canRequestInvoice =
                  !isAdmin &&
                  isPaidStripeRecord(record) &&
                  (!hasExistingInvoice(record) || canRetryInvoice(record))
                const showActions =
                  canReopenPaddleCheckout ||
                  canReopenStripeCheckout ||
                  canRequestInvoice ||
                  (isAdmin && record.status === 'pending') ||
                  !!invoiceUrl ||
                  !!invoicePdf
                // Subscription purchases are mirrored into top-up history with
                // amount=0. Render them with a friendly title and no $0 column.
                const subscriptionRecord = isSubscriptionRecord(record)
                return (
                  <div
                    key={record.id}
                    className='hover:bg-muted/50 rounded-lg border p-3 transition-colors sm:p-4'
                  >
                    {/* Header Row */}
                    <div className='flex items-start justify-between gap-2'>
                      <div className='flex-1 space-y-1'>
                        <div className='flex min-w-0 items-center gap-2'>
                          {subscriptionRecord ? (
                            <span className='text-foreground truncate text-sm font-semibold'>
                              {t('Plan subscription')}
                            </span>
                          ) : (
                            <code className='text-foreground truncate font-mono text-sm'>
                              {record.trade_no}
                            </code>
                          )}
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
                        label={t(statusConfig.label)}
                        variant={statusConfig.variant}
                        showDot
                        copyable={false}
                      />
                    </div>

                    {/* Details Grid */}
                    <div
                      className={`mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:gap-4 ${
                        record.bonus_amount && record.bonus_amount > 0
                          ? 'sm:grid-cols-4'
                          : 'sm:grid-cols-3'
                      }`}
                    >
                      <div className='space-y-1'>
                        <Label className='text-muted-foreground text-xs'>
                          {t('Payment Method')}
                        </Label>
                        <div className='text-sm font-medium'>
                          {getPaymentMethodName(record.payment_method, t)}
                        </div>
                      </div>
                      {!subscriptionRecord && (
                        <div className='space-y-1'>
                          <Label className='text-muted-foreground text-xs'>
                            {t('Amount')}
                          </Label>
                          <div className='text-sm font-semibold'>
                            {formatCurrencyFromUSD(record.amount, {
                              digitsLarge: 2,
                              digitsSmall: 2,
                              abbreviate: false,
                            })}
                          </div>
                        </div>
                      )}
                      <div className='space-y-1'>
                        <Label className='text-muted-foreground text-xs'>
                          {t('Payment')}
                        </Label>
                        <div className='text-sm font-semibold'>
                          {formatNumber(record.money)}{' '}
                          {record.payment_currency?.trim() || 'USD'}
                        </div>
                      </div>
                      {record.bonus_amount && record.bonus_amount > 0 ? (
                        <div className='space-y-1'>
                          <Label className='text-muted-foreground text-xs'>
                            {t('Bonus Credit')}
                          </Label>
                          <div className='text-sm font-semibold text-[#FF2D78]'>
                            +
                            {formatCurrencyFromUSD(record.bonus_amount, {
                              digitsLarge: 2,
                              digitsSmall: 2,
                              abbreviate: false,
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {hasInvoice && (
                      <div className='bg-muted/20 mt-3 rounded-md border p-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <StatusBadge
                            label={t(
                              getInvoiceStatusLabel(invoice?.invoice_status)
                            )}
                            variant={getInvoiceStatusVariant(
                              invoice?.invoice_status
                            )}
                            size='sm'
                            copyable={false}
                          />
                          {invoice?.stripe_invoice_number && (
                            <span className='text-muted-foreground text-xs'>
                              {invoice.stripe_invoice_number}
                            </span>
                          )}
                        </div>
                        <div className='mt-2 grid gap-2 text-xs'>
                          <div>
                            <span className='text-muted-foreground'>
                              {t('Company name')}:
                            </span>{' '}
                            <span className='font-medium'>
                              {invoice?.company_name || '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {showActions && (
                      <div className='mt-4 flex flex-wrap justify-end gap-2'>
                        {invoiceUrl && (
                          <Button
                            size='sm'
                            variant='outline'
                            render={
                              <a
                                href={invoiceUrl}
                                target='_blank'
                                rel='noopener noreferrer'
                              />
                            }
                          >
                            <ExternalLink className='mr-1.5 h-3.5 w-3.5' />
                            {t('View invoice')}
                          </Button>
                        )}
                        {invoicePdf && (
                          <Button
                            size='sm'
                            variant='outline'
                            render={
                              <a
                                href={invoicePdf}
                                target='_blank'
                                rel='noopener noreferrer'
                              />
                            }
                          >
                            <ExternalLink className='mr-1.5 h-3.5 w-3.5' />
                            {t('Invoice PDF')}
                          </Button>
                        )}
                        {canRequestInvoice && (
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => handleOpenInvoiceRequest(record)}
                          >
                            <FileText className='mr-1.5 h-3.5 w-3.5' />
                            {t('Request invoice')}
                          </Button>
                        )}
                        {canReopenPaddleCheckout && (
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => handleReopenPaddleCheckout(record)}
                          >
                            <ExternalLink className='mr-1.5 h-3.5 w-3.5' />
                            {t('Reopen Checkout')}
                          </Button>
                        )}
                        {canReopenStripeCheckout && (
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() =>
                              void handleReopenStripeCheckout(record)
                            }
                            disabled={resumingTradeNo === record.trade_no}
                          >
                            {resumingTradeNo === record.trade_no ? (
                              <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
                            ) : (
                              <ExternalLink className='mr-1.5 h-3.5 w-3.5' />
                            )}
                            {t('Reopen Checkout')}
                          </Button>
                        )}
                        {isAdmin && record.status === 'pending' && (
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => setConfirmTradeNo(record.trade_no)}
                            disabled={completing}
                          >
                            {t('Complete Order')}
                          </Button>
                        )}
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
              {completing ? t('Processing...') : t('Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Request Invoice Dialog */}
      <AlertDialog
        open={!!invoiceTradeNo}
        onOpenChange={(open) => !open && setInvoiceTradeNo(null)}
      >
        <AlertDialogContent className='max-h-[calc(100dvh-2rem)] overflow-hidden sm:max-w-2xl'>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Request invoice')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Enter billing details for this paid Stripe topup order.')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ScrollArea className='max-h-[58vh] pr-3'>
            {invoiceProfileLoading ? (
              <div className='grid gap-3 sm:grid-cols-2'>
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className='h-16 rounded-md' />
                ))}
              </div>
            ) : (
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-1.5'>
                  <Label htmlFor='request-invoice-company-name'>
                    {t('Company name')}
                  </Label>
                  <Input
                    id='request-invoice-company-name'
                    value={invoiceProfile.company_name}
                    onChange={(event) =>
                      updateInvoiceField('company_name', event.target.value)
                    }
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='request-invoice-country'>
                    {t('Country')}
                  </Label>
                  <Input
                    id='request-invoice-country'
                    value={invoiceProfile.country}
                    onChange={(event) =>
                      updateInvoiceField('country', event.target.value)
                    }
                    placeholder='US'
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='request-invoice-tax-id-type'>
                    {t('Tax ID type')}
                  </Label>
                  <Input
                    id='request-invoice-tax-id-type'
                    value={invoiceProfile.tax_id_type || ''}
                    onChange={(event) =>
                      updateInvoiceField('tax_id_type', event.target.value)
                    }
                    placeholder='us_ein'
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='request-invoice-tax-id'>{t('Tax ID')}</Label>
                  <Input
                    id='request-invoice-tax-id'
                    value={invoiceProfile.tax_id || ''}
                    onChange={(event) =>
                      updateInvoiceField('tax_id', event.target.value)
                    }
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='request-invoice-state'>{t('State')}</Label>
                  <Input
                    id='request-invoice-state'
                    value={invoiceProfile.state || ''}
                    onChange={(event) =>
                      updateInvoiceField('state', event.target.value)
                    }
                  />
                </div>
                <div className='space-y-1.5 sm:col-span-2'>
                  <Label htmlFor='request-invoice-address-line1'>
                    {t('Address')}
                  </Label>
                  <Input
                    id='request-invoice-address-line1'
                    value={invoiceProfile.address_line1}
                    onChange={(event) =>
                      updateInvoiceField('address_line1', event.target.value)
                    }
                  />
                </div>
                <div className='space-y-1.5 sm:col-span-2'>
                  <Label htmlFor='request-invoice-address-line2'>
                    {t('Address line 2')}
                  </Label>
                  <Input
                    id='request-invoice-address-line2'
                    value={invoiceProfile.address_line2 || ''}
                    onChange={(event) =>
                      updateInvoiceField('address_line2', event.target.value)
                    }
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='request-invoice-city'>{t('City')}</Label>
                  <Input
                    id='request-invoice-city'
                    value={invoiceProfile.city || ''}
                    onChange={(event) =>
                      updateInvoiceField('city', event.target.value)
                    }
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='request-invoice-postal-code'>
                    {t('Postal code')}
                  </Label>
                  <Input
                    id='request-invoice-postal-code'
                    value={invoiceProfile.postal_code || ''}
                    onChange={(event) =>
                      updateInvoiceField('postal_code', event.target.value)
                    }
                  />
                </div>
                <div className='space-y-1.5 sm:col-span-2'>
                  <Label htmlFor='request-invoice-phone'>{t('Phone')}</Label>
                  <Input
                    id='request-invoice-phone'
                    value={invoiceProfile.phone || ''}
                    onChange={(event) =>
                      updateInvoiceField('phone', event.target.value)
                    }
                  />
                </div>
              </div>
            )}
          </ScrollArea>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={requestingInvoice}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmRequestInvoice()
              }}
              disabled={requestingInvoice || invoiceProfileLoading}
            >
              {requestingInvoice && (
                <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
              )}
              {requestingInvoice ? t('Processing...') : t('Request invoice')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function BillingHistoryDialog({
  open,
  onOpenChange,
}: BillingHistoryDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Billing History')}
      description={t('View your topup transaction records and payment history')}
      contentClassName='flex max-h-[calc(100dvh-2rem)] flex-col max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:p-4 sm:max-w-4xl'
      contentHeight='auto'
      bodyClassName='space-y-3'
    >
      <BillingHistoryPanel />
    </Dialog>
  )
}
