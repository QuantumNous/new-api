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
import { Copy01Icon, ShoppingCartAdd01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useAuthStore } from '@/stores/auth-store'

import { purchaseAgentCodes } from '../api'
import { formatAgentPoints } from '../lib/money'
import {
  refreshAgentMutationQueries,
  setAgentMutationBalance,
} from '../lib/mutation-sync'
import {
  AgentIdempotencyKeyStore,
  canChangeAgentDialogOpen,
  resetAgentDialogLifecycle,
} from '../lib/workspace'
import type { AgentOffer, AgentPurchaseResponse } from '../types'

const purchaseFormSchema = z.object({
  quantity: z.number().int().min(1).max(100),
})

type PurchaseFormValues = z.infer<typeof purchaseFormSchema>

type PurchaseDialogProps = {
  offer: AgentOffer | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PurchaseDialog(props: PurchaseDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const userID = useAuthStore((state) => state.auth.user?.id ?? 0)
  const keyStore = useRef(new AgentIdempotencyKeyStore())
  const [result, setResult] = useState<AgentPurchaseResponse | null>(null)
  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: { quantity: 1 },
  })

  const mutation = useMutation({
    mutationFn: async (values: PurchaseFormValues) => {
      if (!props.offer) throw new Error('Missing offer')
      const fingerprint = `plan=${props.offer.plan_id}&quantity=${values.quantity}`
      const response = await purchaseAgentCodes({
        plan_id: props.offer.plan_id,
        quantity: values.quantity,
        idempotency_key: keyStore.current.keyFor(fingerprint),
      })
      if (!response.success) throw new Error('Purchase failed')
      return response.data
    },
    onSuccess: (data) => {
      keyStore.current.complete()
      setResult(data)
      toast.success(t('Package codes purchased'))
      setAgentMutationBalance(queryClient, userID, data.balance_after)
      void refreshAgentMutationQueries(queryClient, userID)
    },
    onError: () => toast.error(t('Failed to purchase package codes')),
  })

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success(t('Code copied'))
    } catch {
      toast.error(t('Failed to copy code'))
    }
  }

  const onSubmit = (values: PurchaseFormValues) => {
    setResult(null)
    mutation.mutate(values)
  }

  const handleOpenChange = (open: boolean) => {
    if (!canChangeAgentDialogOpen(open, mutation.isPending)) return
    if (!open) {
      setResult(null)
      mutation.reset()
      form.reset({ quantity: 1 })
      resetAgentDialogLifecycle(keyStore.current)
    }
    props.onOpenChange(open)
  }

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      <DialogContent
        className='max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg'
        showCloseButton={!mutation.isPending}
      >
        <DialogHeader>
          <DialogTitle>{t('Purchase package codes')}</DialogTitle>
          <DialogDescription>
            {props.offer
              ? t(
                  'Buy redemption codes for {{plan}} at {{price}} points each.',
                  {
                    plan: props.offer.plan.title,
                    price: formatAgentPoints(props.offer.unit_price),
                  }
                )
              : t('Select a package offer to continue.')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={Boolean(form.formState.errors.quantity)}>
              <FieldLabel htmlFor='agent-purchase-quantity'>
                {t('Quantity')}
              </FieldLabel>
              <Input
                id='agent-purchase-quantity'
                type='number'
                min={1}
                max={100}
                step={1}
                aria-invalid={Boolean(form.formState.errors.quantity)}
                {...form.register('quantity', { valueAsNumber: true })}
              />
              <FieldDescription>
                {t('You can purchase between 1 and 100 codes per order.')}
              </FieldDescription>
              <FieldError>
                {form.formState.errors.quantity
                  ? t('Enter a whole-number quantity from 1 to 100.')
                  : null}
              </FieldError>
            </Field>
          </FieldGroup>

          {result && (
            <div
              className='mt-4 flex flex-col gap-3 rounded-xl border p-3'
              aria-live='polite'
            >
              <div className='grid gap-2 text-sm sm:grid-cols-2'>
                <div>
                  <div className='text-muted-foreground'>
                    {t('Order total')}
                  </div>
                  <div className='font-semibold tabular-nums'>
                    {formatAgentPoints(result.order.total_price)}
                  </div>
                </div>
                <div>
                  <div className='text-muted-foreground'>
                    {t('Balance after purchase')}
                  </div>
                  <div className='font-semibold tabular-nums'>
                    {formatAgentPoints(result.balance_after)}
                  </div>
                </div>
              </div>
              <div className='flex flex-col gap-1.5'>
                <div className='font-medium'>{t('Purchased codes')}</div>
                <div className='flex max-h-48 flex-col gap-1 overflow-y-auto'>
                  {result.codes.map((code) => (
                    <div
                      key={code.id}
                      className='bg-muted/50 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5'
                    >
                      <code className='min-w-0 truncate text-xs'>
                        {code.key}
                      </code>
                      <Button
                        type='button'
                        size='icon-sm'
                        variant='ghost'
                        aria-label={t('Copy code')}
                        onClick={() => copyCode(code.key)}
                      >
                        <HugeiconsIcon
                          icon={Copy01Icon}
                          strokeWidth={2}
                          data-icon='inline-start'
                        />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className='mt-4'>
            <Button
              type='button'
              variant='outline'
              disabled={mutation.isPending}
              onClick={() => handleOpenChange(false)}
            >
              {t('Close')}
            </Button>
            <Button type='submit' disabled={!props.offer || mutation.isPending}>
              {mutation.isPending ? (
                <Spinner data-icon='inline-start' />
              ) : (
                <HugeiconsIcon
                  icon={ShoppingCartAdd01Icon}
                  strokeWidth={2}
                  data-icon='inline-start'
                />
              )}
              {mutation.isError ? t('Retry purchase') : t('Confirm purchase')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
