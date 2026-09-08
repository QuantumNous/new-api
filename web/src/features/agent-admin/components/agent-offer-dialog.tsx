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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { upsertAgentOffer } from '@/features/agents/api'
import type { AgentOffer } from '@/features/agents/types'

import type { AgentAdminPlan } from '../api'
import {
  getAgentAdminInvalidationPlan,
  validateAgentOfferDraft,
} from '../lib/admin'

type AgentOfferDialogProps = {
  plan: AgentAdminPlan
  offer?: AgentOffer
  scope: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AgentOfferDialog(props: AgentOfferDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [enabled, setEnabled] = useState(props.offer?.enabled ?? true)
  const [unitPrice, setUnitPrice] = useState(props.offer?.unit_price ?? '1.00')
  const [codeValidDays, setCodeValidDays] = useState(
    props.offer?.code_valid_days.toString() ?? '365'
  )
  const [refundFeeBps, setRefundFeeBps] = useState(
    props.offer?.refund_fee_bps.toString() ?? '0'
  )
  const [submitted, setSubmitted] = useState(false)
  const validPrice = validateAgentOfferDraft({
    unitPrice,
    codeValidDays: '1',
    refundFeeBps: '0',
  })
  const validDays = validateAgentOfferDraft({
    unitPrice: '1',
    codeValidDays,
    refundFeeBps: '0',
  })
  const validFee = validateAgentOfferDraft({
    unitPrice: '1',
    codeValidDays: '1',
    refundFeeBps,
  })
  const valid = validateAgentOfferDraft({
    unitPrice,
    codeValidDays,
    refundFeeBps,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await upsertAgentOffer(props.plan.id, {
        enabled,
        unit_price: unitPrice,
        code_valid_days: Number(codeValidDays),
        refund_fee_bps: Number(refundFeeBps),
      })
      if (!response.success) throw new Error(response.message)
      return response.data
    },
    onSuccess: async () => {
      toast.success(t('Agent offer saved'))
      await Promise.all(
        getAgentAdminInvalidationPlan('offer', props.scope, 0).map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
      props.onOpenChange(false)
    },
    onError: () => toast.error(t('Failed to save agent offer')),
  })

  const close = (open: boolean) => {
    if (mutation.isPending) return
    props.onOpenChange(open)
  }

  const submit = () => {
    setSubmitted(true)
    if (valid) mutation.mutate()
  }

  return (
    <Dialog open={props.open} onOpenChange={close}>
      <DialogContent
        className='sm:max-w-lg'
        showCloseButton={!mutation.isPending}
      >
        <DialogHeader>
          <DialogTitle>{t('Configure agent offer')}</DialogTitle>
          <DialogDescription>
            {t(
              'Set package-code terms for {{plan}}. Existing orders keep their original snapshot.',
              { plan: props.plan.title }
            )}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field orientation='horizontal'>
            <Checkbox
              id='agent-offer-enabled'
              checked={enabled}
              onCheckedChange={(value) => setEnabled(value === true)}
            />
            <FieldLabel htmlFor='agent-offer-enabled'>
              {t('Offer enabled')}
            </FieldLabel>
          </Field>
          <Field data-invalid={submitted && !validPrice}>
            <FieldLabel htmlFor='agent-offer-price'>
              {t('Unit price in points')}
            </FieldLabel>
            <Input
              id='agent-offer-price'
              inputMode='decimal'
              aria-invalid={submitted && !validPrice}
              value={unitPrice}
              onChange={(event) => setUnitPrice(event.target.value)}
            />
            <FieldDescription>
              {t('One point equals one CNY.')}
            </FieldDescription>
            <FieldError>
              {submitted && !validPrice
                ? t('Enter a positive price with at most two decimal places.')
                : null}
            </FieldError>
          </Field>
          <Field data-invalid={submitted && !validDays}>
            <FieldLabel htmlFor='agent-offer-valid-days'>
              {t('Code validity in days')}
            </FieldLabel>
            <Input
              id='agent-offer-valid-days'
              type='number'
              min={1}
              max={3650}
              step={1}
              aria-invalid={submitted && !validDays}
              value={codeValidDays}
              onChange={(event) => setCodeValidDays(event.target.value)}
            />
            <FieldError>
              {submitted && !validDays
                ? t('Enter a whole number from 1 to 3650.')
                : null}
            </FieldError>
          </Field>
          <Field data-invalid={submitted && !validFee}>
            <FieldLabel htmlFor='agent-offer-refund-fee'>
              {t('Refund fee in basis points')}
            </FieldLabel>
            <Input
              id='agent-offer-refund-fee'
              type='number'
              min={0}
              max={10000}
              step={1}
              aria-invalid={submitted && !validFee}
              value={refundFeeBps}
              onChange={(event) => setRefundFeeBps(event.target.value)}
            />
            <FieldDescription>
              {t('100 basis points equals 1%.')}
            </FieldDescription>
            <FieldError>
              {submitted && !validFee
                ? t('Enter a whole number from 0 to 10000.')
                : null}
            </FieldError>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={mutation.isPending}
            onClick={() => close(false)}
          >
            {t('Cancel')}
          </Button>
          <Button type='button' disabled={mutation.isPending} onClick={submit}>
            {mutation.isPending && <Spinner data-icon='inline-start' />}
            {mutation.isError ? t('Retry save') : t('Save offer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
