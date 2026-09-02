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
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getUserGroups, getUserModels } from '@/features/playground/api'

import { createDrawing } from './api'
import { DrawingForm } from './components/drawing-form'
import { DrawingResult } from './components/drawing-result'
import {
  filterImageModels,
  getDefaultImageModel,
  getDrawingResultUrl,
} from './lib/drawing'
import type { DrawingRequest } from './types'

function getRequestErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const response = 'response' in error ? error.response : undefined
    if (response && typeof response === 'object' && 'data' in response) {
      const data = response.data as {
        error?: { message?: string }
        message?: string
      }
      return data.error?.message || data.message || fallback
    }
  }
  return error instanceof Error ? error.message : fallback
}

export function AiDrawing() {
  const { t } = useTranslation()
  const [group, setGroup] = useState('default')
  const [model, setModel] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const groupsQuery = useQuery({
    queryKey: ['ai-drawing-groups'],
    queryFn: getUserGroups,
  })
  const modelsQuery = useQuery({
    queryKey: ['ai-drawing-models', group],
    queryFn: () => getUserModels(group),
    enabled: Boolean(group),
  })
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data])
  const models = useMemo(
    () => filterImageModels(modelsQuery.data ?? []),
    [modelsQuery.data]
  )

  useEffect(() => {
    if (groups.length === 0) return
    if (groups.some((option) => option.value === group)) return
    setGroup(groups[0].value)
  }, [group, groups])

  useEffect(() => {
    if (models.length === 0) {
      setModel('')
      return
    }
    if (models.some((option) => option.value === model)) return
    setModel(getDefaultImageModel(models))
  }, [model, models])

  useEffect(() => {
    if (!groupsQuery.error) return
    toast.error(getRequestErrorMessage(groupsQuery.error, t('Request failed')))
  }, [groupsQuery.error, t])

  useEffect(() => {
    if (!modelsQuery.error) return
    toast.error(getRequestErrorMessage(modelsQuery.error, t('Request failed')))
  }, [modelsQuery.error, t])

  const drawingMutation = useMutation({
    mutationFn: async (request: DrawingRequest) => {
      const response = await createDrawing(request)
      const url = getDrawingResultUrl(response)
      if (!url) {
        throw new Error(response.error?.message || t('Empty image response'))
      }
      return url
    },
    onMutate: () => setResultUrl(''),
    onSuccess: setResultUrl,
    onError: (error) => {
      toast.error(getRequestErrorMessage(error, t('Request failed')))
    },
  })

  return (
    <div className='mx-auto flex size-full min-h-0 max-w-[100rem] flex-col'>
      <div className='grid min-h-0 flex-1 gap-5 md:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]'>
        <DrawingForm
          models={models}
          groups={groups}
          model={model}
          group={group}
          isLoadingModels={modelsQuery.isLoading || groupsQuery.isLoading}
          isSubmitting={drawingMutation.isPending}
          onModelChange={setModel}
          onGroupChange={setGroup}
          onSubmit={drawingMutation.mutate}
        />
        <DrawingResult
          resultUrl={resultUrl}
          isLoading={drawingMutation.isPending}
        />
      </div>
    </div>
  )
}
