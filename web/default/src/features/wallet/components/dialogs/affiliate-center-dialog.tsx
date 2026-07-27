import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatTimestampToDate } from '@/lib/format'

import type {
  ApiResponse,
  AffiliateStatement,
  AffiliateSummary,
  AffiliateWithdrawal,
} from '../../types'

const MICROS_PER_UNIT = 1_000_000

const withdrawalSchema = z.object({
  amount: z.coerce.number().positive(),
  payoutMethod: z.string().trim().min(1).max(32),
  payoutAccount: z.string().trim().min(1).max(1000),
})

type WithdrawalValues = z.infer<typeof withdrawalSchema>

interface AffiliateCenterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  summary?: AffiliateSummary
  withdrawals: AffiliateWithdrawal[]
  statements: AffiliateStatement[]
  loading: boolean
  submitting: boolean
  cancelling: boolean
  onSubmit: (request: {
    amount_micros: number
    payout_method: string
    payout_account: string
    request_key: string
  }) => Promise<ApiResponse>
  onCancel: (withdrawalId: number) => Promise<unknown>
}

function formatMoney(micros: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'CNY',
  }).format(micros / MICROS_PER_UNIT)
}

export function AffiliateCenterDialog(props: AffiliateCenterDialogProps) {
  const { t } = useTranslation()
  const minimumAmount =
    (props.summary?.minimum_withdrawal_micros ?? 0) / MICROS_PER_UNIT
  const form = useForm<WithdrawalValues>({
    resolver: zodResolver(
      withdrawalSchema
    ) as unknown as Resolver<WithdrawalValues>,
    defaultValues: {
      amount: minimumAmount,
      payoutMethod: '',
      payoutAccount: '',
    },
  })

  useEffect(() => {
    if (props.open) {
      form.reset({
        amount: minimumAmount,
        payoutMethod: '',
        payoutAccount: '',
      })
    }
  }, [form, minimumAmount, props.open])

  async function submitWithdrawal(values: WithdrawalValues) {
    const amountMicros = Math.round(values.amount * MICROS_PER_UNIT)
    if (amountMicros < (props.summary?.minimum_withdrawal_micros ?? 0)) {
      toast.error(t('Amount is below the minimum withdrawal'))
      return
    }
    if (amountMicros > (props.summary?.account.available_micros ?? 0)) {
      toast.error(t('Insufficient available cashback balance'))
      return
    }
    const response = await props.onSubmit({
      amount_micros: amountMicros,
      payout_method: values.payoutMethod,
      payout_account: values.payoutAccount,
      request_key: crypto.randomUUID(),
    })
    if (response.success) {
      form.reset({
        amount: minimumAmount,
        payoutMethod: '',
        payoutAccount: '',
      })
    }
  }

  const currency = props.summary?.currency ?? 'CNY'
  const account = props.summary?.account
  const statusLabels: Record<AffiliateWithdrawal['status'], string> = {
    pending: t('Pending'),
    approved: t('Approved'),
    paid: t('Paid'),
    rejected: t('Rejected'),
    cancelled: t('Cancelled'),
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[88vh] overflow-y-auto sm:max-w-4xl'>
        <DialogHeader>
          <DialogTitle>{t('Referral Cashback')}</DialogTitle>
          <DialogDescription>
            {t('Manage cashback withdrawals and monthly statements.')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue='account' className='min-h-0'>
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='account'>{t('Account')}</TabsTrigger>
            <TabsTrigger value='withdrawals'>{t('Withdrawals')}</TabsTrigger>
            <TabsTrigger value='statements'>{t('Statements')}</TabsTrigger>
          </TabsList>

          <TabsContent value='account' className='space-y-5 pt-3'>
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
              {[
                [t('Pending'), account?.pending_micros ?? 0],
                [t('Available'), account?.available_micros ?? 0],
                [t('Frozen'), account?.frozen_micros ?? 0],
                [t('Withdrawn'), account?.withdrawn_micros ?? 0],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className='border-border border-l-2 pl-3'
                >
                  <div className='text-muted-foreground text-xs'>{label}</div>
                  <div className='mt-1 font-semibold tabular-nums'>
                    {formatMoney(Number(value), currency)}
                  </div>
                </div>
              ))}
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(submitWithdrawal)}
                className='grid gap-4 border-t pt-5 sm:grid-cols-2'
              >
                <FormField
                  control={form.control}
                  name='amount'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Withdrawal amount')}</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={minimumAmount}
                          step='0.01'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='payoutMethod'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Payout method')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Bank transfer, PayPal, or wallet')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='payoutAccount'
                  render={({ field }) => (
                    <FormItem className='sm:col-span-2'>
                      <FormLabel>{t('Payout account')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t(
                            'Account number, email, or wallet address'
                          )}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className='flex items-center justify-between gap-3 sm:col-span-2'>
                  <p className='text-muted-foreground text-xs'>
                    {t('Minimum withdrawal')}:{' '}
                    {formatMoney(
                      props.summary?.minimum_withdrawal_micros ?? 0,
                      currency
                    )}
                  </p>
                  <Button
                    type='submit'
                    disabled={
                      props.submitting ||
                      !props.summary?.enabled ||
                      (account?.available_micros ?? 0) <
                        (props.summary?.minimum_withdrawal_micros ?? 0)
                    }
                  >
                    {props.submitting ? (
                      <Loader2 className='animate-spin' />
                    ) : null}
                    {t('Submit withdrawal')}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value='withdrawals' className='pt-3'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Requested')}</TableHead>
                  <TableHead>{t('Amount')}</TableHead>
                  <TableHead>{t('Payout method')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  <TableHead className='text-right'>{t('Action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.withdrawals.map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell>
                      {formatTimestampToDate(withdrawal.requested_at)}
                    </TableCell>
                    <TableCell className='font-medium'>
                      {formatMoney(
                        withdrawal.amount_micros,
                        withdrawal.currency
                      )}
                    </TableCell>
                    <TableCell>
                      {withdrawal.payout_method} · {withdrawal.payout_account}
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline'>
                        {statusLabels[withdrawal.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      {withdrawal.status === 'pending' ? (
                        <Button
                          size='sm'
                          variant='ghost'
                          disabled={props.cancelling}
                          onClick={() => props.onCancel(withdrawal.id)}
                        >
                          {t('Cancel')}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
                {!props.loading && props.withdrawals.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className='text-muted-foreground text-center'
                    >
                      {t('No withdrawal requests yet')}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value='statements' className='pt-3'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Period')}</TableHead>
                  <TableHead>{t('Earned')}</TableHead>
                  <TableHead>{t('Paid')}</TableHead>
                  <TableHead>{t('Closing available')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.statements.map((statement) => (
                  <TableRow key={statement.id}>
                    <TableCell>
                      {formatTimestampToDate(statement.start_at)} -{' '}
                      {formatTimestampToDate(statement.end_at - 1)}
                    </TableCell>
                    <TableCell>
                      {formatMoney(statement.earned_micros, statement.currency)}
                    </TableCell>
                    <TableCell>
                      {formatMoney(statement.paid_micros, statement.currency)}
                    </TableCell>
                    <TableCell className='font-medium'>
                      {formatMoney(
                        statement.closing_available_micros,
                        statement.currency
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!props.loading && props.statements.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className='text-muted-foreground text-center'
                    >
                      {t('No statements available yet')}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
