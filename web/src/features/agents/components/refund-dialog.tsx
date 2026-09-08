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
import { RefreshIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { useAuthStore } from '@/stores/auth-store'

import { refundAgentCodes } from '../api'
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
import type { AgentRefundResponse } from '../types'

type RefundDialogProps = {
  redemptionIDs: number[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefunded: (redemptionIDs: number[]) => void
}

export function RefundDialog(props: RefundDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const userID = useAuthStore((state) => state.auth.user?.id ?? 0)
  const keyStore = useRef(new AgentIdempotencyKeyStore())
  const [result, setResult] = useState<AgentRefundResponse | null>(null)
  const mutation = useMutation({
    mutationFn: async () => {
      const redemptionIDs = [...props.redemptionIDs].sort(
        (left, right) => left - right
      )
      const fingerprint = redemptionIDs.join(',')
      const response = await refundAgentCodes({
        redemption_ids: redemptionIDs,
        idempotency_key: keyStore.current.keyFor(fingerprint),
      })
      if (!response.success) throw new Error('Refund failed')
      return response.data
    },
    onSuccess: (data) => {
      keyStore.current.complete()
      setResult(data)
      props.onRefunded(data.redemption_ids)
      toast.success(t('Package codes refunded'))
      setAgentMutationBalance(queryClient, userID, data.balance_after)
      void refreshAgentMutationQueries(queryClient, userID)
    },
    onError: () => toast.error(t('Failed to refund package codes')),
  })

  const handleOpenChange = (open: boolean) => {
    if (!canChangeAgentDialogOpen(open, mutation.isPending)) return
    if (!open) {
      setResult(null)
      mutation.reset()
      resetAgentDialogLifecycle(keyStore.current)
    }
    props.onOpenChange(open)
  }

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      <DialogContent
        className='sm:max-w-md'
        showCloseButton={!mutation.isPending}
      >
        <DialogHeader>
          <DialogTitle>{t('Refund package codes')}</DialogTitle>
          <DialogDescription>
            {t(
              'Refund {{count}} selected unused and unexpired codes. The server applies the fee saved with each purchase.',
              { count: props.redemptionIDs.length }
            )}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div
            className='grid gap-3 rounded-xl border p-3 sm:grid-cols-3'
            aria-live='polite'
          >
            <div>
              <div className='text-muted-foreground text-xs'>
                {t('Refund fee')}
              </div>
              <div className='font-semibold tabular-nums'>
                {formatAgentPoints(result.fee)}
              </div>
            </div>
            <div>
              <div className='text-muted-foreground text-xs'>
                {t('Points refunded')}
              </div>
              <div className='font-semibold tabular-nums'>
                {formatAgentPoints(result.refunded)}
              </div>
            </div>
            <div>
              <div className='text-muted-foreground text-xs'>
                {t('Current balance')}
              </div>
              <div className='font-semibold tabular-nums'>
                {formatAgentPoints(result.balance_after)}
              </div>
            </div>
          </div>
        ) : (
          <p className='text-muted-foreground text-sm'>
            {t(
              'The final fee, refund amount, and balance will come from the server result.'
            )}
          </p>
        )}

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={mutation.isPending}
            onClick={() => handleOpenChange(false)}
          >
            {result ? t('Done') : t('Cancel')}
          </Button>
          {!result && (
            <Button
              type='button'
              variant='destructive'
              disabled={props.redemptionIDs.length === 0 || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <Spinner data-icon='inline-start' />
              ) : (
                <HugeiconsIcon
                  icon={RefreshIcon}
                  strokeWidth={2}
                  data-icon='inline-start'
                />
              )}
              {mutation.isError ? t('Retry refund') : t('Confirm refund')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
