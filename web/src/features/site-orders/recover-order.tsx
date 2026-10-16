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
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getPaymentMethodName } from '@/features/wallet/lib/billing'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { recoverOrder, recordOrderReview, type SiteOrder } from './api'
import { paymentAmount } from './presentation'

export function RecoverOrder(props: {
  order: SiteOrder
  disabled: boolean
  review?: boolean
}) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState('note')
  const title = props.review
    ? t('Resolve payment review')
    : t('Verify and recover order')
  const client = useQueryClient()
  const choices = [
    { value: 'note', label: t('Record review outcome') },
    { value: 'fulfill', label: t('Fulfill verified payment') },
    { value: 'refunded', label: t('Record external refund') },
    { value: 'acknowledged', label: t('Resolve without adjustment') },
  ]
  const schema = z.object({
    reference: z
      .string()
      .trim()
      .max(128)
      .refine(
        (value) => !props.review || action !== 'refunded' || value.length > 0,
        t('Refund reference is required.')
      ),
    reason: z
      .string()
      .trim()
      .min(5, t('Enter a reason between 5 and 500 characters.'))
      .max(500, t('Enter a reason between 5 and 500 characters.')),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { reason: '', reference: '' },
  })
  const mutation = useMutation({
    mutationKey: ['site-orders', 'recover', props.order.id],
    mutationFn: (values: { reason: string; reference: string }) =>
      props.review
        ? recordOrderReview(
            props.order.id,
            values.reason,
            action === 'note'
              ? undefined
              : {
                  action,
                  reference: values.reference,
                  version: props.order.review_version ?? '',
                }
          )
        : recoverOrder(props.order.id, values.reason),
    onSuccess: () => setOpen(false),
    onSettled: () => client.invalidateQueries({ queryKey: ['site-orders'] }),
  })
  const labels: Record<string, string> = {
    review_recorded: t('Review outcome recorded.'),
    credited: t('Payment verified and wallet credited.'),
    already_credited: t(
      'This order was already credited. No duplicate credit was added.'
    ),
    unpaid: t('The payment provider has not confirmed payment.'),
    closed: t('This order is closed. No credit was added.'),
    expired: t('Payment time has ended. Waiting for the final payment result.'),
    credit_pending: t(
      'Payment is confirmed, but wallet credit failed. Retry later.'
    ),
    cache_pending: t(
      'Wallet credit is complete, but balance synchronization is pending.'
    ),
    verification_failed: t(
      'Payment verification failed. Check the order status before retrying.'
    ),
  }
  let description = t(
    'Only verified payments can credit the frozen quota. Amounts and recipients cannot be changed.'
  )
  if (props.review) {
    description =
      action === 'note'
        ? t(
            'Record the investigation or external refund outcome. This does not change balances, subscriptions or the payment hold.'
          )
        : t(
            'Fulfillment uses the verified payment and frozen order. Other resolutions do not refund money or change balances or subscriptions.'
          )
  }
  return (
    <>
      <Button
        variant='outline'
        disabled={props.disabled || mutation.isPending}
        onClick={() => {
          mutation.reset()
          form.reset()
          setAction('note')
          setOpen(true)
        }}
      >
        {title}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(value) => {
          if (!mutation.isPending) setOpen(value)
        }}
        title={title}
        desc={description}
        confirmText={
          props.review && action === 'note'
            ? t('Record review outcome')
            : title
        }
        isLoading={mutation.isPending}
        handleConfirm={() =>
          void form.handleSubmit((values) => mutation.mutate(values))()
        }
      >
        <dl className='space-y-2 text-sm break-all'>
          <div>
            <dt>{t('User')}</dt>
            <dd>
              {props.order.username} (#{props.order.user_id})
            </dd>
          </div>
          <div>
            <dt>{t('Order number')}</dt>
            <dd>{props.order.trade_no}</dd>
          </div>
          <div>
            <dt>{t('Payment Method')}</dt>
            <dd>{getPaymentMethodName(props.order.payment_method, t)}</dd>
          </div>
          <div>
            <dt>{t('Order amount')}</dt>
            <dd>{paymentAmount(props.order)}</dd>
          </div>
          <div>
            <dt>{t('Frozen quota')}</dt>
            <dd>
              {formatNumber(
                props.order.frozen_quota,
                toIntlLocale(i18n.resolvedLanguage || i18n.language)
              )}
            </dd>
          </div>
        </dl>
        {props.review && (
          <div className='space-y-2'>
            <Label htmlFor='review-action'>{t('Resolution')}</Label>
            <Select
              items={choices}
              value={action}
              disabled={mutation.isPending}
              onValueChange={(value) => setAction(value ?? 'note')}
            >
              <SelectTrigger id='review-action'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {choices.map((choice) => (
                  <SelectItem key={choice.value} value={choice.value}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-muted-foreground text-sm'>
              {t(
                'Fulfillment uses the verified payment and frozen order. Other resolutions do not refund money or change balances or subscriptions.'
              )}
            </p>
            {action === 'refunded' && (
              <>
                <Label htmlFor='refund-reference'>
                  {t('Refund reference')}
                </Label>
                <Input
                  id='refund-reference'
                  maxLength={128}
                  disabled={mutation.isPending}
                  aria-invalid={!!form.formState.errors.reference}
                  {...form.register('reference')}
                />
                <p role='alert'>{form.formState.errors.reference?.message}</p>
              </>
            )}
          </div>
        )}
        <div className='space-y-2'>
          <Label htmlFor='recovery-reason'>
            {props.review ? t('Review outcome') : t('Recovery reason')}
          </Label>
          <Textarea
            id='recovery-reason'
            maxLength={500}
            disabled={mutation.isPending}
            aria-invalid={!!form.formState.errors.reason}
            aria-describedby='recovery-reason-error'
            {...form.register('reason')}
          />
          <p id='recovery-reason-error' role='alert'>
            {form.formState.errors.reason?.message}
          </p>
        </div>
        {mutation.isError && (
          <p role='alert'>
            {t(
              'Payment verification failed. Check the order status before retrying.'
            )}
          </p>
        )}
      </ConfirmDialog>
      {mutation.data && (
        <p role='status'>
          {labels[mutation.data.result] ?? labels.verification_failed}
        </p>
      )}
    </>
  )
}
