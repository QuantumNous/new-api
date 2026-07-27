import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, Check, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatTimestampToDate } from '@/lib/format'

import { getAdminAffiliateWithdrawals, updateAffiliateWithdrawal } from './api'
import type { AffiliateWithdrawal, WithdrawalAction } from './types'

const PAGE_SIZE = 20

function formatMoney(micros: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'CNY',
  }).format(micros / 1_000_000)
}

export function AffiliateWithdrawals() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AffiliateWithdrawal>()
  const [action, setAction] = useState<WithdrawalAction>()
  const [actionValue, setActionValue] = useState('')

  const query = useQuery({
    queryKey: ['admin', 'affiliate-withdrawals', status, page],
    queryFn: () =>
      getAdminAffiliateWithdrawals({ page, pageSize: PAGE_SIZE, status }),
    select: (response) => response.data,
    placeholderData: (previous) => previous,
  })
  const mutation = useMutation({
    mutationFn: updateAffiliateWithdrawal,
    onSuccess: async (response) => {
      if (!response.success) return
      toast.success(t('Withdrawal updated'))
      setSelected(undefined)
      setAction(undefined)
      setActionValue('')
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'affiliate-withdrawals'],
      })
    },
  })

  const openAction = (
    withdrawal: AffiliateWithdrawal,
    nextAction: WithdrawalAction
  ) => {
    setSelected(withdrawal)
    setAction(nextAction)
    setActionValue('')
  }

  const submitAction = () => {
    if (!selected || !action) return
    if ((action === 'reject' || action === 'paid') && !actionValue.trim()) {
      toast.error(
        action === 'paid'
          ? t('Payment reference is required')
          : t('Review note is required')
      )
      return
    }
    mutation.mutate({
      id: selected.id,
      action,
      note: action === 'paid' ? undefined : actionValue.trim(),
      paymentReference: action === 'paid' ? actionValue.trim() : undefined,
    })
  }

  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const statusLabels: Record<AffiliateWithdrawal['status'], string> = {
    pending: t('Pending'),
    approved: t('Approved'),
    paid: t('Paid'),
    rejected: t('Rejected'),
    cancelled: t('Cancelled'),
  }
  const statusOptions = [
    { value: 'pending', label: t('Pending') },
    { value: 'approved', label: t('Approved') },
    { value: 'paid', label: t('Paid') },
    { value: 'rejected', label: t('Rejected') },
    { value: 'all', label: t('All') },
  ]
  let actionTitle = t('Mark withdrawal as paid')
  if (action === 'approve') {
    actionTitle = t('Approve withdrawal')
  } else if (action === 'reject') {
    actionTitle = t('Reject withdrawal')
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Cashback Withdrawals')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='space-y-4'>
            <Tabs
              value={status || 'all'}
              onValueChange={(value) => {
                setStatus(value === 'all' ? '' : value)
                setPage(1)
              }}
            >
              <TabsList className='max-w-full overflow-x-auto'>
                {statusOptions.map((option) => (
                  <TabsTrigger key={option.value} value={option.value}>
                    {option.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className='rounded-lg border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Request')}</TableHead>
                    <TableHead>{t('User')}</TableHead>
                    <TableHead>{t('Amount')}</TableHead>
                    <TableHead>{t('Payout account')}</TableHead>
                    <TableHead>{t('Status')}</TableHead>
                    <TableHead className='text-right'>{t('Action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>
                        <div className='font-medium'>#{withdrawal.id}</div>
                        <div className='text-muted-foreground text-xs'>
                          {formatTimestampToDate(withdrawal.requested_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='font-medium'>{withdrawal.username}</div>
                        <div className='text-muted-foreground text-xs'>
                          ID {withdrawal.user_id}
                        </div>
                      </TableCell>
                      <TableCell className='font-semibold'>
                        {formatMoney(
                          withdrawal.amount_micros,
                          withdrawal.currency
                        )}
                      </TableCell>
                      <TableCell>
                        <div>{withdrawal.payout_method}</div>
                        <div className='text-muted-foreground max-w-72 truncate font-mono text-xs'>
                          {withdrawal.payout_account}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline'>
                          {statusLabels[withdrawal.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className='flex justify-end gap-1'>
                          {withdrawal.status === 'pending' ? (
                            <>
                              <Button
                                size='sm'
                                variant='outline'
                                onClick={() =>
                                  openAction(withdrawal, 'approve')
                                }
                              >
                                <Check />
                                {t('Approve')}
                              </Button>
                              <Button
                                size='sm'
                                variant='ghost'
                                onClick={() => openAction(withdrawal, 'reject')}
                              >
                                <X />
                                {t('Reject')}
                              </Button>
                            </>
                          ) : null}
                          {withdrawal.status === 'approved' ? (
                            <Button
                              size='sm'
                              onClick={() => openAction(withdrawal, 'paid')}
                            >
                              <Banknote />
                              {t('Mark paid')}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!query.isLoading && items.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className='text-muted-foreground text-center'
                      >
                        {t('No withdrawal requests found')}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>

            <div className='flex items-center justify-between'>
              <p className='text-muted-foreground text-sm'>
                {t('Total')}: {total}
              </p>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page <= 1 || query.isFetching}
                  onClick={() => setPage((current) => current - 1)}
                >
                  {t('Previous')}
                </Button>
                <span className='text-sm tabular-nums'>
                  {page} / {totalPages}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page >= totalPages || query.isFetching}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {t('Next')}
                </Button>
              </div>
            </div>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <Dialog
        open={Boolean(selected && action)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(undefined)
            setAction(undefined)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionTitle}</DialogTitle>
            <DialogDescription>
              {selected
                ? `${selected.username} · ${formatMoney(selected.amount_micros, selected.currency)}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-2'>
            <Label htmlFor='withdrawal-action-value'>
              {action === 'paid' ? t('Payment reference') : t('Review note')}
            </Label>
            <Input
              id='withdrawal-action-value'
              value={actionValue}
              onChange={(event) => setActionValue(event.target.value)}
              placeholder={
                action === 'paid'
                  ? t('Bank transaction or payment reference')
                  : t('Optional for approval, required for rejection')
              }
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setSelected(undefined)}>
              {t('Cancel')}
            </Button>
            <Button onClick={submitAction} disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className='animate-spin' /> : null}
              {t('Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
