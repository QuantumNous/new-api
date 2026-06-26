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
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { trackSuccessfulTopups } from '@/lib/analytics/topup-tracking'
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
import { StatusBadge } from '@/components/status-badge'
import type { StatusVariant } from '@/components/status-badge'
import { getInvoiceProfile, isApiSuccess } from '../../api'
import { useBillingHistory } from '../../hooks/use-billing-history'
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
import type { InvoiceProfile, TopupRecord } from '../../types'

interface BillingHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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
    requestingInvoice,
    isAdmin,
    handlePageChange,
    handlePageSizeChange,
    handleSearch,
    handleCompleteOrder,
    handleRequestInvoice,
  } = useBillingHistory()

  // Fire the top-up (purchase) conversion for any freshly-succeeded top-up that
  // lands here — covers redirect-back providers (Stripe/epay) the inline Paddle
  // poll never sees. De-duped + recency-gated in trackSuccessfulTopups, so this
  // is safe to run on every records change and never back-fires for old top-ups.
  useEffect(() => {
    if (records.length) trackSuccessfulTopups(records)
  }, [records])

  const [confirmTradeNo, setConfirmTradeNo] = useState<string | null>(null)
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

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={t('Billing History')}
        description={t(
          'View your topup transaction records and payment history'
        )}
        contentClassName='flex max-h-[calc(100dvh-2rem)] flex-col max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:p-4 sm:max-w-4xl'
        contentHeight='auto'
        bodyClassName='space-y-3'
      >
        <div className='min-h-0 space-y-3'>
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
          <ScrollArea className='max-h-[min(54vh,520px)] pr-3 sm:pr-4'>
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
                    canRequestInvoice ||
                    (isAdmin && record.status === 'pending') ||
                    !!invoiceUrl ||
                    !!invoicePdf
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
                        <div className='space-y-1'>
                          <Label className='text-muted-foreground text-xs'>
                            {t('Payment')}
                          </Label>
                          <div className='text-sm font-semibold text-red-600'>
                            {formatNumber(record.money)}
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
