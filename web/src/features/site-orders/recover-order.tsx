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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getPaymentMethodName } from '@/features/wallet/lib/billing'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { recoverOrder, type SiteOrder } from './api'
import { paymentAmount } from './presentation'

export function RecoverOrder(props: { order: SiteOrder; disabled: boolean }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const client = useQueryClient()
  const schema = z.object({
    reason: z
      .string()
      .trim()
      .min(5, t('Enter a reason between 5 and 500 characters.'))
      .max(500, t('Enter a reason between 5 and 500 characters.')),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { reason: '' },
  })
  const mutation = useMutation({
    mutationKey: ['site-orders', 'recover', props.order.id],
    mutationFn: (values: { reason: string }) =>
      recoverOrder(props.order.id, values.reason),
    onSuccess: () => setOpen(false),
    onSettled: () => client.invalidateQueries({ queryKey: ['site-orders'] }),
  })
  const labels: Record<string, string> = {
    credited: t('Payment verified and wallet credited.'),
    already_credited: t(
      'This order was already credited. No duplicate credit was added.'
    ),
    unpaid: t('The payment provider has not confirmed payment.'),
    closed: t('This order is closed. No credit was added.'),
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
  return (
    <>
      <Button
        variant='outline'
        disabled={props.disabled || mutation.isPending}
        onClick={() => {
          mutation.reset()
          setOpen(true)
        }}
      >
        {t('Verify and recover order')}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(value) => {
          if (!mutation.isPending) setOpen(value)
        }}
        title={t('Verify and recover order')}
        desc={t(
          'Only verified payments can credit the frozen quota. Amounts and recipients cannot be changed.'
        )}
        confirmText={t('Verify and recover order')}
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
        <div className='space-y-2'>
          <Label htmlFor='recovery-reason'>{t('Recovery reason')}</Label>
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
