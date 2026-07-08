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
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Check, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { parseCountry } from '@/lib/country'
import { useBillingHistory } from '../hooks/use-billing-history'
import { GLASS_CARD_CLS } from '../constants'
import {
  getPaymentMethodName,
  formatTimestamp,
  formatPaidAmount,
} from '../lib/billing'
import type { TopupStatus } from '../types'

const STATUS_TABS = [
  { value: '', labelKey: 'All' },
  { value: 'success', labelKey: 'Success' },
  { value: 'pending', labelKey: 'Awaiting Payment' },
] as const

function formatRechargeAmount(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handle() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      type='button'
      onClick={handle}
      className='text-muted-foreground hover:text-foreground ml-1.5 shrink-0 transition-colors'
    >
      {copied ? (
        <Check className='size-3 text-green-500' />
      ) : (
        <Copy className='size-3' />
      )}
    </button>
  )
}

const STATUS_STYLE: Record<TopupStatus, string> = {
  success: 'bg-green-50 text-green-600 border border-green-200',
  pending: 'bg-orange-50 text-orange-500 border border-orange-200',
  expired: 'bg-gray-100 text-gray-400 border border-gray-200',
}

const STATUS_LABEL: Record<TopupStatus, string> = {
  success: 'Success',
  pending: 'Awaiting Payment',
  expired: 'Expired',
}

function StatusChip({ status }: { status: TopupStatus }) {
  const { t } = useTranslation()
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLE[status] ?? STATUS_STYLE.pending}`}
    >
      {t(STATUS_LABEL[status] ?? 'Pending')}
    </span>
  )
}

export function TransactionHistory() {
  const { t } = useTranslation()
  const {
    records,
    total,
    page,
    pageSize,
    keyword,
    statusFilter,
    loading,
    isAdmin,
    handlePageChange,
    handleSearch,
    handleStatusChange,
  } = useBillingHistory({ initialPageSize: 10 })
  const colCount = isAdmin ? 9 : 6

  const totalPages = Math.ceil(total / pageSize)

  return (
    <Card className={GLASS_CARD_CLS}>
      <CardHeader className='pb-3'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h3 className='text-base font-semibold'>
              {t('Transaction History')}
            </h3>
            <p className='text-muted-foreground mt-0.5 text-xs'>
              {t('View all your transaction records')}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            {total > 0 && (
              <span className='text-muted-foreground shrink-0 rounded-full border px-2.5 py-0.5 text-xs'>
                {t('Total {{count}} records', { count: total })}
              </span>
            )}
            <Input
              placeholder={
                isAdmin
                  ? t('Order No. / Email / UID')
                  : t('Search by order number...')
              }
              value={keyword}
              onChange={(e) => handleSearch(e.target.value)}
              className='h-8 w-full sm:w-52 text-sm'
            />
          </div>
        </div>
        {isAdmin && (
          <div className='mt-2 flex gap-1'>
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleStatusChange(tab.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === tab.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className='p-0'>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-y bg-muted/30 text-xs text-muted-foreground'>
                <th className='px-4 py-2.5 text-left font-medium'>
                  {t('Order No.')}
                </th>
                {isAdmin && (
                  <th className='px-4 py-2.5 text-left font-medium'>
                    {t('Username')}
                  </th>
                )}
                {isAdmin && (
                  <th className='px-4 py-2.5 text-left font-medium'>
                    <Globe className='inline size-3 mr-1 opacity-60' />
                    {t('Country')}
                  </th>
                )}
                {isAdmin && (
                  <th className='px-4 py-2.5 text-left font-medium'>
                    {t('Language')}
                  </th>
                )}
                <th className='px-4 py-2.5 text-left font-medium'>
                  {t('Payment Method')}
                </th>
                <th className='px-4 py-2.5 text-right font-medium'>
                  {t('Recharge Amount')}
                </th>
                <th className='px-4 py-2.5 text-right font-medium'>
                  {t('Amount Paid')}
                </th>
                <th className='px-4 py-2.5 text-center font-medium'>
                  {t('Status')}
                </th>
                <th className='px-4 py-2.5 text-right font-medium'>
                  {t('Time')}
                </th>
              </tr>
            </thead>
            <tbody className='divide-y'>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className='px-4 py-3'>
                      <Skeleton className='h-4 w-44' />
                    </td>
                    {isAdmin && (
                      <td className='px-4 py-3'>
                        <Skeleton className='h-4 w-24' />
                      </td>
                    )}
                    {isAdmin && (
                      <td className='px-4 py-3'>
                        <Skeleton className='h-4 w-8' />
                      </td>
                    )}
                    {isAdmin && (
                      <td className='px-4 py-3'>
                        <Skeleton className='h-4 w-10' />
                      </td>
                    )}
                    <td className='px-4 py-3'>
                      <Skeleton className='h-4 w-16' />
                    </td>
                    <td className='px-4 py-3'>
                      <Skeleton className='ml-auto h-4 w-12' />
                    </td>
                    <td className='px-4 py-3'>
                      <Skeleton className='ml-auto h-4 w-16' />
                    </td>
                    <td className='px-4 py-3'>
                      <Skeleton className='mx-auto h-5 w-14 rounded-full' />
                    </td>
                    <td className='px-4 py-3'>
                      <Skeleton className='ml-auto h-4 w-28' />
                    </td>
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className='px-4 py-12 text-center'>
                    <p className='text-muted-foreground text-sm'>
                      {keyword
                        ? t('Try adjusting your search')
                        : t('No billing records found')}
                    </p>
                  </td>
                </tr>
              ) : (
                records.map((record) => {
                  const creditedAmount =
                    Number(record.credited_amount || 0) > 0
                      ? Number(record.credited_amount)
                      : Number(record.amount || 0)
                  return (
                    <tr
                      key={record.id}
                      className='hover:bg-muted/20 transition-colors'
                    >
                      <td className='px-4 py-3'>
                        <div className='flex items-center'>
                          <code className='font-mono text-xs text-foreground max-w-[200px] truncate'>
                            {record.trade_no || `#${record.id}`}
                          </code>
                          <CopyBtn
                            text={record.trade_no || String(record.id)}
                          />
                        </div>
                      </td>
                      {isAdmin && (
                        <td className='px-4 py-3'>
                          {record.username ? (
                            <div className='flex flex-col gap-0.5'>
                              <div className='flex items-center gap-1'>
                                <span className='font-mono text-xs text-foreground max-w-[160px] truncate'>
                                  {record.username}
                                </span>
                                <CopyBtn text={record.username} />
                              </div>
                              {record.email && (
                                <div className='flex items-center gap-1'>
                                  <span className='text-muted-foreground text-xs max-w-[200px] truncate'>
                                    {record.email}
                                  </span>
                                  <CopyBtn text={record.email} />
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className='text-muted-foreground text-xs'>
                              —
                            </span>
                          )}
                        </td>
                      )}
                      {isAdmin && (
                        <td className='px-4 py-3'>
                          {(() => {
                            const c = parseCountry(record.country)
                            return c ? (
                              <div className='flex flex-col gap-0.5'>
                                <span className='text-xs font-medium'>
                                  {c.code}
                                </span>
                                {c.name && (
                                  <span className='text-muted-foreground text-xs'>
                                    {c.name}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className='text-muted-foreground text-xs'>
                                —
                              </span>
                            )
                          })()}
                        </td>
                      )}
                      {isAdmin && (
                        <td className='px-4 py-3'>
                          {record.language ? (
                            <span className='text-xs font-medium'>
                              {record.language}
                            </span>
                          ) : (
                            <span className='text-muted-foreground text-xs'>
                              —
                            </span>
                          )}
                        </td>
                      )}
                      <td className='px-4 py-3 text-muted-foreground'>
                        {getPaymentMethodName(record.payment_method, t)}
                      </td>
                      <td className='px-4 py-3 text-right font-mono'>
                        {formatRechargeAmount(creditedAmount)}
                      </td>
                      <td className='px-4 py-3 text-right font-mono font-medium'>
                        {formatPaidAmount(
                          record.money,
                          record.payment_method,
                          creditedAmount,
                        )}
                      </td>
                      <td className='px-4 py-3 text-center'>
                        <StatusChip status={record.status} />
                      </td>
                      <td className='px-4 py-3 text-right text-muted-foreground text-xs whitespace-nowrap'>
                        {formatTimestamp(record.create_time)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className='border-t flex items-center justify-between px-4 py-3'>
            <span className='text-muted-foreground text-xs'>
              {t('Page {{page}} of {{total}}', { page, total: totalPages })}
            </span>
            <div className='flex items-center gap-1'>
              <Button
                variant='outline'
                size='sm'
                className='h-7 w-7 p-0'
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                <ChevronLeft className='size-4' />
              </Button>
              <Button
                variant='outline'
                size='sm'
                className='h-7 w-7 p-0'
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                <ChevronRight className='size-4' />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
