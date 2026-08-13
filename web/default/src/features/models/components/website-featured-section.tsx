/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getWebsiteFeaturedModels,
  updateWebsiteFeaturedModels,
} from '../api'
import { modelsQueryKeys } from '../lib'
import type { WebsiteFeaturedCandidate } from '../types'
import {
  filterWebsiteFeaturedCandidates,
  moveWebsiteFeaturedModel,
  type WebsiteFeaturedListItem,
} from './website-featured-utils'

function normalizeFeaturedItems(items: WebsiteFeaturedListItem[]): WebsiteFeaturedListItem[] {
  return items.map((item, sortOrder) => ({ ...item, sort_order: sortOrder }))
}

export function WebsiteFeaturedSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [draftFeatured, setDraftFeatured] = useState<
    WebsiteFeaturedListItem[] | null
  >(null)
  const [candidateQuery, setCandidateQuery] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: modelsQueryKeys.websiteFeatured(),
    queryFn: getWebsiteFeaturedModels,
  })

  const serverFeatured = useMemo(
    () => normalizeFeaturedItems(data?.data?.featured ?? []),
    [data?.data?.featured]
  )
  const featured = draftFeatured ?? serverFeatured
  const updateFeatured = (
    updater: (current: WebsiteFeaturedListItem[]) => WebsiteFeaturedListItem[]
  ) => {
    setDraftFeatured((current) => updater(current ?? serverFeatured))
  }

  const candidates = useMemo(
    () => data?.data?.candidates ?? [],
    [data?.data?.candidates]
  )
  const filteredCandidates = useMemo(
    () => filterWebsiteFeaturedCandidates(candidates, featured, candidateQuery),
    [candidateQuery, candidates, featured]
  )
  const savedNames = data?.data?.featured?.map((item) => item.model_name) ?? []
  const currentNames = featured.map((item) => item.model_name)
  const isDirty = JSON.stringify(savedNames) !== JSON.stringify(currentNames)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await updateWebsiteFeaturedModels(currentNames)
      if (!response.success) {
        throw new Error(response.message || t('Failed to save featured models'))
      }
      return response
    },
    onSuccess: () => {
      setDraftFeatured(null)
      toast.success(t('Featured models saved successfully'))
      void queryClient.invalidateQueries({
        queryKey: modelsQueryKeys.websiteFeatured(),
      })
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to save featured models'))
    },
  })

  const addCandidate = (candidate: WebsiteFeaturedCandidate) => {
    updateFeatured((current) =>
      normalizeFeaturedItems([
        ...current,
        {
          ...candidate,
          sort_order: current.length,
        },
      ])
    )
  }

  const removeFeatured = (index: number) => {
    updateFeatured((current) =>
      normalizeFeaturedItems(current.filter((_, itemIndex) => itemIndex !== index))
    )
  }

  if (isLoading) {
    return (
      <div className='text-muted-foreground flex items-center justify-center gap-2 py-12'>
        <Loader2 className='h-5 w-5 animate-spin' />
        {t('Loading featured models')}
      </div>
    )
  }

  if (isError || !data?.success) {
    return (
      <Alert variant='destructive'>
        <AlertTriangle className='h-4 w-4' />
        <AlertTitle>{t('Unable to load featured models')}</AlertTitle>
        <AlertDescription>{t('Please retry later or check your administrator permissions.')}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='text-muted-foreground text-sm'>
        {t('Choose one or more models and arrange their order. Featured models appear first on the public model directory.')}
      </div>

      <section className='space-y-3'>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <h2 className='font-medium'>{t('Featured model order')}</h2>
            <p className='text-muted-foreground text-sm'>
              {t('Models not listed here keep the normal automatic ordering.')}
            </p>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
            size='sm'
          >
            {saveMutation.isPending && <Loader2 className='animate-spin' />}
            {t('Save order')}
          </Button>
        </div>

        {featured.length === 0 ? (
          <div className='border-border text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm'>
            {t('No featured models configured. Add models from the list below.')}
          </div>
        ) : (
          <div className='space-y-2'>
            {featured.map((item, index) => (
              <div
                className='border-border bg-card flex items-center gap-3 rounded-lg border p-3'
                key={`${item.model_name}-${index}`}
              >
                <span className='text-muted-foreground w-6 text-center text-sm'>
                  {index + 1}
                </span>
                <div className='min-w-0 flex-1'>
                  <div className='truncate font-medium'>{item.model_name}</div>
                  {item.vendor_name && (
                    <div className='text-muted-foreground truncate text-xs'>
                      {item.vendor_name}
                    </div>
                  )}
                </div>
                {!item.available && (
                  <Badge variant='outline'>
                    {t('No longer available')}
                  </Badge>
                )}
                <div className='flex items-center gap-1'>
                  <Button
                    variant='ghost'
                    size='icon-xs'
                    onClick={() => updateFeatured((current) => moveWebsiteFeaturedModel(current, index, -1))}
                    disabled={index === 0}
                    aria-label={t('Move featured model up')}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon-xs'
                    onClick={() => updateFeatured((current) => moveWebsiteFeaturedModel(current, index, 1))}
                    disabled={index === featured.length - 1}
                    aria-label={t('Move featured model down')}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon-xs'
                    onClick={() => removeFeatured(index)}
                    aria-label={t('Remove featured model')}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className='space-y-3'>
        <div>
          <h2 className='font-medium'>{t('Available public models')}</h2>
          <p className='text-muted-foreground text-sm'>
            {t('Only models currently shown on the public model directory can be selected.')}
          </p>
        </div>
        <div className='relative max-w-md'>
          <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2' />
          <Input
            value={candidateQuery}
            onChange={(event) => setCandidateQuery(event.target.value)}
            placeholder={t('Search public models')}
            className='pl-8'
            aria-label={t('Search public models')}
          />
        </div>
        <div className='grid gap-2 md:grid-cols-2'>
          {filteredCandidates.map((candidate) => (
            <div
              className='border-border flex items-center gap-3 rounded-lg border p-3'
              key={candidate.model_name}
            >
              <div className='min-w-0 flex-1'>
                <div className='truncate text-sm font-medium'>{candidate.model_name}</div>
                {candidate.vendor_name && (
                  <div className='text-muted-foreground truncate text-xs'>
                    {candidate.vendor_name}
                  </div>
                )}
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={() => addCandidate(candidate)}
              >
                <Plus />
                {t('Feature')}
              </Button>
            </div>
          ))}
        </div>
        {filteredCandidates.length === 0 && (
          <div className='text-muted-foreground py-6 text-center text-sm'>
            {t('No additional public models found')}
          </div>
        )}
      </section>
    </div>
  )
}
