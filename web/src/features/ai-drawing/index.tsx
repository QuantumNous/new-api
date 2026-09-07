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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useCustomerPrice } from '@/features/agents/hooks'
import { getUserGroups, getUserModels } from '@/features/playground/api'
import { useAuthStore } from '@/stores/auth-store'

import {
  createDrawing,
  drawingErrorMessage,
  getDrawingBatches,
  getDrawingSettings,
} from './api'
import { DrawingForm } from './components/drawing-form'
import { DrawingResult } from './components/drawing-result'
import { filterImageModels, getDefaultImageModel } from './lib/drawing'
import { clearLegacyDrawingCache } from './lib/drawing-cache'
import type { DrawingRequest } from './types'

export function AiDrawing() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const customerPrice = useCustomerPrice()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const [group, setGroup] = useState('default')
  const [model, setModel] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const pendingSubmit = useRef<{
    signature: string
    id: string
    image?: File
  } | null>(null)
  const groupsQuery = useQuery({
    queryKey: ['ai-drawing-groups', userId],
    queryFn: getUserGroups,
  })
  const modelsQuery = useQuery({
    queryKey: ['ai-drawing-models', userId, group],
    queryFn: () => getUserModels(group),
    enabled: Boolean(group),
  })
  const settingsQuery = useQuery({
    queryKey: ['ai-drawing-settings', userId],
    queryFn: getDrawingSettings,
  })
  const batchesQuery = useQuery({
    queryKey: ['ai-drawing-batches', userId],
    queryFn: getDrawingBatches,
    enabled: Boolean(userId),
    refetchInterval: 3000,
  })
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data])
  const models = useMemo(
    () => filterImageModels(modelsQuery.data ?? []),
    [modelsQuery.data]
  )
  const batches = batchesQuery.data ?? []
  const selected =
    batches.find((batch) => batch.id === selectedId) ?? batches[0]

  useEffect(() => {
    void clearLegacyDrawingCache().catch(() =>
      toast.error(t('Close older drawing tabs to clear their cached images'))
    )
  }, [t])
  useEffect(() => {
    if (groups.length && !groups.some((option) => option.value === group)) {
      setGroup(groups[0].value)
    }
  }, [groups, group])
  useEffect(() => {
    if (!models.some((option) => option.value === model)) {
      setModel(getDefaultImageModel(models))
    }
  }, [models, model])
  useEffect(() => {
    const error =
      groupsQuery.error ||
      modelsQuery.error ||
      settingsQuery.error ||
      batchesQuery.error ||
      customerPrice.error
    if (error) toast.error(t(drawingErrorMessage(error, 'Request failed')))
  }, [
    groupsQuery.error,
    modelsQuery.error,
    settingsQuery.error,
    batchesQuery.error,
    customerPrice.error,
    t,
  ])

  const mutation = useMutation({
    mutationFn: async (request: DrawingRequest) => {
      const signature = JSON.stringify({
        ...request,
        image: undefined,
        expectedAgentPriceVersion: undefined,
      })
      if (
        !pendingSubmit.current ||
        pendingSubmit.current.signature !== signature ||
        pendingSubmit.current.image !== request.image
      ) {
        pendingSubmit.current = {
          signature,
          image: request.image,
          id: crypto.randomUUID(),
        }
      }
      return createDrawing(request, pendingSubmit.current.id)
    },
    onSuccess: async (batch) => {
      pendingSubmit.current = null
      setSelectedId(batch.id)
      await queryClient.invalidateQueries({
        queryKey: ['ai-drawing-batches', userId],
      })
    },
    onError: (error) => {
      toast.error(t(drawingErrorMessage(error, 'Request failed')))
      void queryClient.invalidateQueries({ queryKey: ['agent-customer-price'] })
    },
  })
  return (
    <div className='mx-auto flex size-full min-h-0 max-w-[100rem] flex-col overflow-y-auto md:overflow-visible'>
      <div className='flex flex-col gap-5 md:grid md:min-h-0 md:flex-1 md:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]'>
        <DrawingForm
          models={models}
          groups={groups}
          model={model}
          group={group}
          isLoadingModels={
            modelsQuery.isLoading ||
            groupsQuery.isLoading ||
            settingsQuery.isLoading ||
            customerPrice.isLoading ||
            Boolean(customerPrice.error)
          }
          isSubmitting={mutation.isPending}
          maxCount={settingsQuery.data?.max_count}
          agentPriceCents={
            model === 'gpt-image-2'
              ? (customerPrice.data?.price_cents ?? undefined)
              : undefined
          }
          onModelChange={setModel}
          onGroupChange={setGroup}
          onSubmit={(request) =>
            mutation.mutate({
              ...request,
              expectedAgentPriceVersion: customerPrice.data?.version ?? 0,
            })
          }
        />
        <DrawingResult
          key={userId}
          batch={selected}
          isLoading={batchesQuery.isLoading}
        />
      </div>
    </div>
  )
}
