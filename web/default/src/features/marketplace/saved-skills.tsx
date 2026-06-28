/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Bookmark } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionPageLayout } from '@/components/layout'
import { getSavedSkills, unsaveSkill } from './api'
import { EmptyState, ErrorBanner, PlanBadge } from './components'
import type { SavedSkill } from './types'

export function SavedSkills() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const savedQuery = useQuery({
    queryKey: ['marketplace-saved-skills'],
    queryFn: getSavedSkills,
    retry: false,
  })
  const rows = useMemo(() => savedQuery.data?.data ?? [], [savedQuery.data])
  const unsaveMutation = useMutation({
    mutationFn: (skill: SavedSkill) =>
      unsaveSkill(skill.slug || skill.skill_id, 'saved_list'),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['marketplace-saved-skills'],
        }),
        queryClient.invalidateQueries({ queryKey: ['marketplace-skills'] }),
      ])
      toast.success(t('Removed from Saved Skills'))
    },
  })

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Saved Skills')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('{{count}} saved Skills', { count: rows.length })}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          {savedQuery.isError && (
            <ErrorBanner
              message={t('Unable to load saved skills.')}
              retryable
              onRetry={() => void savedQuery.refetch()}
            />
          )}
          {savedQuery.isLoading ? (
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className='h-32 w-full' />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState kind='my-skills'>
              <Button
                type='button'
                onClick={() => void navigate({ to: '/skills' })}
              >
                <Bookmark data-icon='inline-start' />
                {t('Explore Skills')}
              </Button>
            </EmptyState>
          ) : (
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
              {rows.map((skill) => (
                <Card key={skill.skill_id} size='sm'>
                  <CardHeader>
                    <div className='flex items-start justify-between gap-3'>
                      <div className='min-w-0'>
                        <CardTitle className='line-clamp-1 text-base'>
                          {skill.name}
                        </CardTitle>
                        <p className='text-muted-foreground text-sm'>
                          {skill.category}
                        </p>
                      </div>
                      {skill.enabled ? (
                        <Badge variant='secondary'>{t('In My Skills')}</Badge>
                      ) : (
                        <Badge variant='outline'>{t('Saved')}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className='flex flex-col gap-3'>
                    <p className='text-muted-foreground line-clamp-2 min-h-10 text-sm'>
                      {skill.short_description}
                    </p>
                    <div className='flex flex-wrap items-center gap-2'>
                      <PlanBadge plan={skill.required_plan} />
                      {skill.last_used_at == null && (
                        <Badge variant='outline'>{t('Not used yet')}</Badge>
                      )}
                    </div>
                    <div className='flex justify-end gap-2'>
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => unsaveMutation.mutate(skill)}
                        disabled={unsaveMutation.isPending}
                      >
                        {t('Unsave')}
                      </Button>
                      <Button
                        type='button'
                        onClick={() =>
                          void navigate({
                            to: '/skills/$slug',
                            params: { slug: skill.slug || skill.skill_id },
                          })
                        }
                      >
                        {t('Open')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
