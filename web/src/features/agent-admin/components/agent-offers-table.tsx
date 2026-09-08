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
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getAdminAgentOffers } from '@/features/agents/api'
import { AgentTableShell } from '@/features/agents/components/agent-table-shell'
import type { AgentOffer } from '@/features/agents/types'

import { getAgentAdminPlans, type AgentAdminPlan } from '../api'
import { agentAdminQueryKeys } from '../lib/admin'
import { AgentOfferDialog } from './agent-offer-dialog'

type AgentOffersTableProps = { scope: number; canMutate: boolean }
type OfferRow = { plan: AgentAdminPlan; offer?: AgentOffer }

export function AgentOffersTable(props: AgentOffersTableProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<OfferRow | null>(null)
  const plansQuery = useQuery({
    queryKey: agentAdminQueryKeys.plans(props.scope),
    queryFn: async () => {
      const response = await getAgentAdminPlans()
      if (!response.success) throw new Error(response.message)
      return response.data
    },
  })
  const offersQuery = useQuery({
    queryKey: agentAdminQueryKeys.offers(props.scope),
    queryFn: async () => {
      const response = await getAdminAgentOffers()
      if (!response.success) throw new Error(response.message)
      return response.data
    },
  })
  const rows = useMemo<OfferRow[]>(() => {
    const offersByPlan = new Map(
      (offersQuery.data ?? []).map((offer) => [offer.plan_id, offer])
    )
    return (plansQuery.data ?? []).map((plan) => ({
      plan,
      offer: offersByPlan.get(plan.id),
    }))
  }, [offersQuery.data, plansQuery.data])
  const columns = useMemo<ColumnDef<OfferRow>[]>(
    () => [
      {
        accessorFn: (row) => row.plan.title,
        id: 'plan',
        header: t('Subscription plan'),
        cell: ({ row }) => (
          <div>
            <div className='font-medium'>{row.original.plan.title}</div>
            <div className='text-muted-foreground text-xs'>
              #{row.original.plan.id} ·{' '}
              {row.original.plan.enabled
                ? t('Plan enabled')
                : t('Plan disabled')}
            </div>
          </div>
        ),
      },
      {
        id: 'offer_status',
        header: t('Offer status'),
        cell: ({ row }) => {
          if (!row.original.offer) {
            return <Badge variant='outline'>{t('Not configured')}</Badge>
          }
          return (
            <Badge
              variant={row.original.offer.enabled ? 'secondary' : 'outline'}
            >
              {row.original.offer.enabled ? t('Enabled') : t('Disabled')}
            </Badge>
          )
        },
      },
      {
        id: 'unit_price',
        header: t('Unit price'),
        cell: ({ row }) => (
          <span className='tabular-nums'>
            {row.original.offer?.unit_price ?? '—'}
          </span>
        ),
      },
      {
        id: 'validity',
        header: t('Validity'),
        cell: ({ row }) =>
          row.original.offer
            ? t('{{days}} days', { days: row.original.offer.code_valid_days })
            : '—',
      },
      {
        id: 'refund_fee',
        header: t('Refund fee'),
        cell: ({ row }) =>
          row.original.offer
            ? t('{{fee}} bps', { fee: row.original.offer.refund_fee_bps })
            : '—',
      },
      ...(props.canMutate
        ? [
            {
              id: 'actions',
              header: t('Actions'),
              cell: ({ row }: { row: { original: OfferRow } }) => (
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => setSelected(row.original)}
                >
                  {row.original.offer ? t('Edit offer') : t('Configure offer')}
                </Button>
              ),
            } satisfies ColumnDef<OfferRow>,
          ]
        : []),
    ],
    [props.canMutate, t]
  )
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.plan.id.toString(),
  })

  return (
    <>
      <AgentTableShell
        table={table}
        isLoading={plansQuery.isPending || offersQuery.isPending}
        isFetching={plansQuery.isFetching || offersQuery.isFetching}
        error={plansQuery.error ?? offersQuery.error}
        onRetry={() =>
          Promise.all([plansQuery.refetch(), offersQuery.refetch()])
        }
        emptyTitle={t('No subscription plans found')}
        emptyDescription={t(
          'Create a subscription plan before configuring an agent offer.'
        )}
        page={1}
        pageSize={Math.max(1, rows.length)}
        total={rows.length}
        onPageChange={() => undefined}
      />
      {selected && (
        <AgentOfferDialog
          key={selected.plan.id}
          plan={selected.plan}
          offer={selected.offer}
          scope={props.scope}
          open
          onOpenChange={(open) => !open && setSelected(null)}
        />
      )}
    </>
  )
}
