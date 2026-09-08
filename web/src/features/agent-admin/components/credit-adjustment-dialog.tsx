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
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { adjustAgentCredit } from '@/features/agents/api'
import type {
  AdminAgent,
  AgentCreditAdjustmentResponse,
} from '@/features/agents/types'

import {
  createCreditAttempt,
  getAgentAdminInvalidationPlan,
  projectAgentBalance,
  type CreditAttempt,
} from '../lib/admin'

const formSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(?:\.\d{0,2})?$/)
    .refine((value) => !/^0+(?:\.0{0,2})?$/.test(value)),
  direction: z.enum(['credit', 'debit']),
  reason: z.string().trim().min(1).max(255),
})

type FormValues = z.infer<typeof formSchema>

type CreditAdjustmentDialogProps = {
  agent: AdminAgent
  scope: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreditAdjustmentDialog(props: CreditAdjustmentDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [attempt, setAttempt] = useState<CreditAttempt>()
  const [reviewing, setReviewing] = useState(false)
  const [result, setResult] = useState<AgentCreditAdjustmentResponse | null>(
    null
  )
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: '', direction: 'credit', reason: '' },
  })

  const mutation = useMutation({
    mutationFn: async (currentAttempt: CreditAttempt) => {
      const response = await adjustAgentCredit(props.agent.user_id, {
        ...currentAttempt.payload,
        idempotency_key: currentAttempt.idempotencyKey,
      })
      if (!response.success) throw new Error(response.message)
      return response.data
    },
    onSuccess: async (data) => {
      setResult(data)
      setAttempt(undefined)
      setReviewing(false)
      toast.success(t('Agent balance adjusted'))
      await Promise.all(
        getAgentAdminInvalidationPlan(
          'credit',
          props.scope,
          props.agent.user_id
        ).map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      )
    },
    onError: () => toast.error(t('Failed to adjust agent balance')),
  })

  const close = (open: boolean) => {
    if (mutation.isPending) return
    if (!open) {
      form.reset()
      mutation.reset()
      setAttempt(undefined)
      setReviewing(false)
      setResult(null)
    }
    props.onOpenChange(open)
  }

  const review = (values: FormValues) => {
    setResult(null)
    const nextAttempt = createCreditAttempt(attempt, values)
    if (attempt && attempt.idempotencyKey !== nextAttempt.idempotencyKey) {
      mutation.reset()
    }
    setAttempt(nextAttempt)
    setReviewing(true)
  }

  const projected = attempt
    ? projectAgentBalance(
        props.agent.balance,
        attempt.payload.amount,
        attempt.payload.direction
      )
    : null
  const signedDelta = attempt
    ? `${attempt.payload.direction === 'credit' ? '+' : '-'}${projectAgentBalance('0.00', attempt.payload.amount, 'credit')}`
    : null

  return (
    <Dialog open={props.open} onOpenChange={close}>
      <DialogContent
        className='sm:max-w-lg'
        showCloseButton={!mutation.isPending}
      >
        <DialogHeader>
          <DialogTitle>{t('Adjust agent balance')}</DialogTitle>
          <DialogDescription>
            {t(
              'Every credit or debit is recorded in the immutable point ledger.'
            )}
          </DialogDescription>
        </DialogHeader>

        {result && (
          <div
            className='grid gap-3 rounded-xl border p-4 sm:grid-cols-2'
            aria-live='polite'
          >
            <div>
              <div className='text-muted-foreground text-xs'>
                {t('Recorded delta')}
              </div>
              <div className='font-semibold tabular-nums'>
                {result.log.delta}
              </div>
            </div>
            <div>
              <div className='text-muted-foreground text-xs'>
                {t('Server balance after adjustment')}
              </div>
              <div className='font-semibold tabular-nums'>
                {result.account.balance}
              </div>
            </div>
          </div>
        )}
        {!result && reviewing && attempt && (
          <div className='flex flex-col gap-4'>
            <div className='grid gap-3 rounded-xl border p-4 sm:grid-cols-3'>
              <div>
                <div className='text-muted-foreground text-xs'>
                  {t('Current balance')}
                </div>
                <div className='font-semibold tabular-nums'>
                  {props.agent.balance}
                </div>
              </div>
              <div>
                <div className='text-muted-foreground text-xs'>
                  {t('Signed delta')}
                </div>
                <div className='font-semibold tabular-nums'>{signedDelta}</div>
              </div>
              <div>
                <div className='text-muted-foreground text-xs'>
                  {t('Projected balance')}
                </div>
                <div className='font-semibold tabular-nums'>{projected}</div>
              </div>
            </div>
            <div>
              <div className='text-muted-foreground text-xs'>{t('Reason')}</div>
              <p className='text-sm break-words'>{attempt.payload.reason}</p>
            </div>
            {projected?.startsWith('-') && (
              <p className='text-destructive text-sm'>
                {t('A debit cannot make the balance negative.')}
              </p>
            )}
          </div>
        )}
        {!result && !reviewing && (
          <form id='agent-credit-form' onSubmit={form.handleSubmit(review)}>
            <FieldGroup>
              <Field data-invalid={Boolean(form.formState.errors.direction)}>
                <FieldLabel htmlFor='agent-credit-direction'>
                  {t('Adjustment type')}
                </FieldLabel>
                <NativeSelect
                  id='agent-credit-direction'
                  {...form.register('direction')}
                >
                  <NativeSelectOption value='credit'>
                    {t('Credit points')}
                  </NativeSelectOption>
                  <NativeSelectOption value='debit'>
                    {t('Debit points')}
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field data-invalid={Boolean(form.formState.errors.amount)}>
                <FieldLabel htmlFor='agent-credit-amount'>
                  {t('Amount')}
                </FieldLabel>
                <Input
                  id='agent-credit-amount'
                  inputMode='decimal'
                  aria-invalid={Boolean(form.formState.errors.amount)}
                  {...form.register('amount')}
                />
                <FieldError>
                  {form.formState.errors.amount
                    ? t(
                        'Enter a positive amount with at most two decimal places.'
                      )
                    : null}
                </FieldError>
              </Field>
              <Field data-invalid={Boolean(form.formState.errors.reason)}>
                <FieldLabel htmlFor='agent-credit-reason'>
                  {t('Reason')}
                </FieldLabel>
                <Input
                  id='agent-credit-reason'
                  maxLength={255}
                  aria-invalid={Boolean(form.formState.errors.reason)}
                  {...form.register('reason')}
                />
                <FieldError>
                  {form.formState.errors.reason
                    ? t(
                        'A reason is required and must be 255 characters or fewer.'
                      )
                    : null}
                </FieldError>
              </Field>
            </FieldGroup>
          </form>
        )}

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={mutation.isPending}
            onClick={() =>
              reviewing && !result ? setReviewing(false) : close(false)
            }
          >
            {reviewing && !result ? t('Back') : t('Close')}
          </Button>
          {!reviewing && !result && (
            <Button type='submit' form='agent-credit-form'>
              {t('Review adjustment')}
            </Button>
          )}
          {reviewing && attempt && !result && (
            <Button
              type='button'
              disabled={mutation.isPending || projected?.startsWith('-')}
              onClick={() => mutation.mutate(attempt)}
            >
              {mutation.isPending && <Spinner data-icon='inline-start' />}
              {mutation.isError
                ? t('Retry adjustment')
                : t('Confirm adjustment')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
