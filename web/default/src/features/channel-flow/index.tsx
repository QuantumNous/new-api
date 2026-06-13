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

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, RefreshCw } from 'lucide-react'
import { SectionPageLayout } from '@/components/layout'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createChannelFlowPool,
  createChannelFlowPoolBinding,
  deleteChannelFlowPool,
  deleteChannelFlowPoolBinding,
  getChannelFlowPoolStatus,
  listChannelFlowPoolBindings,
  listChannelFlowPools,
  updateChannelFlowPool,
} from './api'
import { BindingFormSheet } from './components/binding-form-sheet'
import { PoolBindingsPanel } from './components/pool-bindings-panel'
import { PoolFormSheet } from './components/pool-form-sheet'
import { PoolList } from './components/pool-list'
import { PoolStatusPanel } from './components/pool-status-panel'
import {
  bindingFormToPayload,
  channelFlowQueryKeys,
  poolFormToPayload,
  type ChannelFlowBindingFormValues,
  type ChannelFlowPoolFormValues,
} from './lib'
import type { ChannelFlowPool, ChannelFlowPoolBinding, FlowTrendPoint } from './types'

const FLOW_POOL_PAGE_SIZE = 50
const FLOW_STATUS_REFETCH_MS = 5000
const FLOW_TREND_LIMIT = 30

type PoolMutationVariables = {
  values: ChannelFlowPoolFormValues
  pool?: ChannelFlowPool | null
}

export function ChannelFlowPools() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [selectedPoolId, setSelectedPoolId] = useState<number | undefined>()
  const [editingPool, setEditingPool] = useState<ChannelFlowPool | null>(null)
  const [poolSheetOpen, setPoolSheetOpen] = useState(false)
  const [bindingSheetOpen, setBindingSheetOpen] = useState(false)
  const [poolPendingDelete, setPoolPendingDelete] =
    useState<ChannelFlowPool | null>(null)
  const [deletingBindingId, setDeletingBindingId] = useState<number | null>(null)
  const [trend, setTrend] = useState<FlowTrendPoint[]>([])

  const listParams = useMemo(
    () => ({
      p: 1,
      page_size: FLOW_POOL_PAGE_SIZE,
      keyword: keyword.trim() || undefined,
    }),
    [keyword]
  )

  const poolsQuery = useQuery({
    queryKey: channelFlowQueryKeys.list(listParams),
    queryFn: () => listChannelFlowPools(listParams),
  })

  const pools = poolsQuery.data?.data?.items ?? []
  const selectedPool =
    pools.find((pool) => pool.id === selectedPoolId) ?? pools[0] ?? null

  useEffect(() => {
    if (pools.length === 0) {
      setSelectedPoolId(undefined)
      return
    }
    if (!selectedPoolId || !pools.some((pool) => pool.id === selectedPoolId)) {
      setSelectedPoolId(pools[0].id)
    }
  }, [pools, selectedPoolId])

  useEffect(() => {
    setTrend([])
  }, [selectedPoolId])

  const statusQuery = useQuery({
    queryKey: channelFlowQueryKeys.status(selectedPool?.id ?? 0),
    queryFn: () => getChannelFlowPoolStatus(selectedPool!.id),
    enabled: Boolean(selectedPool),
    refetchInterval: FLOW_STATUS_REFETCH_MS,
  })

  const bindingsQuery = useQuery({
    queryKey: channelFlowQueryKeys.bindings(selectedPool?.id ?? 0),
    queryFn: () => listChannelFlowPoolBindings(selectedPool!.id),
    enabled: Boolean(selectedPool),
  })

  useEffect(() => {
    const status = statusQuery.data?.data
    if (!status) return
    setTrend((current) => {
      const next = [
        ...current,
        {
          at: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }),
          running: status.running,
          queued: status.queued,
        },
      ]
      return next.slice(-FLOW_TREND_LIMIT)
    })
  }, [statusQuery.dataUpdatedAt, statusQuery.data])

  const poolMutation = useMutation({
    mutationFn: async (variables: PoolMutationVariables) => {
      const payload = poolFormToPayload(variables.values)
      if (variables.pool?.id) {
        return updateChannelFlowPool(variables.pool.id, payload)
      }
      return createChannelFlowPool(payload)
    },
    onSuccess: (response) => {
      if (!response.success) {
        toast.error(response.message || t('Failed to save Flow Pool'))
        return
      }
      toast.success(t('Flow Pool saved'))
      setPoolSheetOpen(false)
      setEditingPool(null)
      if (response.data?.id) {
        setSelectedPoolId(response.data.id)
      }
      queryClient.invalidateQueries({ queryKey: channelFlowQueryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: channelFlowQueryKeys.all })
    },
    onError: () => {
      toast.error(t('Failed to save Flow Pool'))
    },
  })

  const deletePoolMutation = useMutation({
    mutationFn: (poolId: number) => deleteChannelFlowPool(poolId),
    onSuccess: (response) => {
      if (!response.success) {
        toast.error(response.message || t('Failed to delete Flow Pool'))
        return
      }
      toast.success(t('Flow Pool deleted'))
      setPoolPendingDelete(null)
      queryClient.invalidateQueries({ queryKey: channelFlowQueryKeys.all })
    },
    onError: () => {
      toast.error(t('Failed to delete Flow Pool'))
    },
  })

  const bindingMutation = useMutation({
    mutationFn: (values: ChannelFlowBindingFormValues) => {
      if (!selectedPool) {
        throw new Error('missing selected pool')
      }
      return createChannelFlowPoolBinding(
        selectedPool.id,
        bindingFormToPayload(values)
      )
    },
    onSuccess: (response) => {
      if (!response.success) {
        toast.error(response.message || t('Failed to bind channel'))
        return
      }
      toast.success(t('Channel bound'))
      setBindingSheetOpen(false)
      if (selectedPool) {
        queryClient.invalidateQueries({
          queryKey: channelFlowQueryKeys.bindings(selectedPool.id),
        })
      }
    },
    onError: () => {
      toast.error(t('Failed to bind channel'))
    },
  })

  const deleteBindingMutation = useMutation({
    mutationFn: (binding: ChannelFlowPoolBinding) => {
      setDeletingBindingId(binding.id)
      return deleteChannelFlowPoolBinding(binding.id)
    },
    onSuccess: (response) => {
      setDeletingBindingId(null)
      if (!response.success) {
        toast.error(response.message || t('Failed to delete binding'))
        return
      }
      toast.success(t('Binding deleted'))
      if (selectedPool) {
        queryClient.invalidateQueries({
          queryKey: channelFlowQueryKeys.bindings(selectedPool.id),
        })
      }
    },
    onError: () => {
      setDeletingBindingId(null)
      toast.error(t('Failed to delete binding'))
    },
  })

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Flow Pools')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              poolsQuery.refetch()
              statusQuery.refetch()
              bindingsQuery.refetch()
            }}
          >
            <RefreshCw className='size-4' />
            {t('Refresh')}
          </Button>
          <Button
            size='sm'
            onClick={() => {
              setEditingPool(null)
              setPoolSheetOpen(true)
            }}
          >
            <Plus className='size-4' />
            {t('Create Flow Pool')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='grid h-full min-h-0 gap-4 lg:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)]'>
            <section className='flex min-h-0 flex-col overflow-hidden rounded-lg border p-3'>
              <div className='mb-3'>
                <Input
                  value={keyword}
                  placeholder={t('Search Flow Pools')}
                  onChange={(event) => setKeyword(event.target.value)}
                />
              </div>
              <div className='min-h-0 flex-1 overflow-y-auto overflow-x-hidden'>
                <PoolList
                  pools={pools}
                  selectedPoolId={selectedPool?.id}
                  status={statusQuery.data?.data ?? null}
                  loading={poolsQuery.isLoading}
                  onSelect={(pool) => setSelectedPoolId(pool.id)}
                  onEdit={(pool) => {
                    setEditingPool(pool)
                    setPoolSheetOpen(true)
                  }}
                  onDelete={setPoolPendingDelete}
                />
              </div>
            </section>

            <section className='min-h-0 overflow-y-auto overflow-x-hidden'>
              <div className='space-y-4'>
                <PoolStatusPanel
                  pool={selectedPool}
                  status={statusQuery.data?.data ?? null}
                  trend={trend}
                />
                <PoolBindingsPanel
                  pool={selectedPool}
                  bindings={bindingsQuery.data?.data ?? []}
                  loading={bindingsQuery.isLoading}
                  deletingBindingId={deletingBindingId}
                  onAddBinding={() => setBindingSheetOpen(true)}
                  onDeleteBinding={(binding) =>
                    deleteBindingMutation.mutate(binding)
                  }
                />
              </div>
            </section>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <PoolFormSheet
        open={poolSheetOpen}
        onOpenChange={setPoolSheetOpen}
        pool={editingPool}
        submitting={poolMutation.isPending}
        onSubmit={(values) => poolMutation.mutate({ values, pool: editingPool })}
      />

      <BindingFormSheet
        open={bindingSheetOpen}
        onOpenChange={setBindingSheetOpen}
        pool={selectedPool}
        bindings={bindingsQuery.data?.data ?? []}
        submitting={bindingMutation.isPending}
        onSubmit={(values) => bindingMutation.mutate(values)}
      />

      <AlertDialog
        open={Boolean(poolPendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPoolPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Flow Pool')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'This can only succeed after all channel bindings are removed.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              disabled={deletePoolMutation.isPending}
              onClick={() => {
                if (poolPendingDelete) {
                  deletePoolMutation.mutate(poolPendingDelete.id)
                }
              }}
            >
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
