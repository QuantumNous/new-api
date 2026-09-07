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
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/auth-store'

import { getAgentTopUps, type AgentCustomer } from './api'
import { formatTopUps } from './money'

export function CustomerTopUps(props: {
  customer: AgentCustomer
  onClose: () => void
}) {
  const { t } = useTranslation()
  const agentId = useAuthStore((state) => state.auth.user?.id)
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['agent-topups', agentId, props.customer.id, page],
    queryFn: () => getAgentTopUps(props.customer.id, page),
  })
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>
            {props.customer.username} · {t('Successful top-ups')}
          </DialogTitle>
        </DialogHeader>
        <div className='max-h-80 overflow-y-auto'>
          {query.isLoading && <p>{t('Loading')}</p>}
          {query.error && <p>{t('Unable to load agent data')}</p>}
          {!query.isLoading && !query.data?.items.length && (
            <p>{t('No successful top-ups')}</p>
          )}
          {query.data?.items.map((item) => (
            <div
              key={item.id}
              className='flex items-center justify-between gap-4 border-b py-3 text-sm'
            >
              <span>
                {new Date(item.complete_time * 1000).toLocaleString()}
              </span>
              <span>{item.payment_method}</span>
              <strong>{formatTopUps([item])}</strong>
            </div>
          ))}
        </div>
        <div className='flex justify-end gap-2'>
          <Button
            variant='outline'
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('Previous')}
          </Button>
          <Button
            variant='outline'
            disabled={page * 20 >= (query.data?.total ?? 0)}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('Next')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
