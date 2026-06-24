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
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMediaQuery } from '@/hooks'
import { getMySkills, removeMySkill } from './api'
import { EmptyState, ErrorBanner } from './components'
import { MySkillsFilter } from './components/my-skills-filter'
import { MySkillsMobileList } from './components/my-skills-mobile-list'
import { MySkillsTable } from './components/my-skills-table'
import {
  resolveMySkillRow,
  rowMatchesFilter,
  skillKey,
  type MySkillFilter,
  type MySkillRowItem,
} from './lib/my-skills-row-state'
import type { MySkill } from './types'

export function MySkills() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [filter, setFilter] = useState<MySkillFilter>('all')
  const [removingId, setRemovingId] = useState<string | null>(null)

  const skillsQuery = useQuery({
    queryKey: ['marketplace-my-skills'],
    queryFn: getMySkills,
    retry: false,
    placeholderData: (prev) => prev,
  })

  const removeMutation = useMutation({
    mutationFn: removeMySkill,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['marketplace-my-skills'] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace-skills'] }),
      ])
      toast.success(t('Removed from My Skills'))
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Unable to remove this skill.'))
    },
    onSettled: () => setRemovingId(null),
  })

  const skills = useMemo(
    () => skillsQuery.data?.data ?? [],
    [skillsQuery.data]
  )
  const rows = useMemo<MySkillRowItem[]>(
    () => skills.map((skill) => ({ skill, view: resolveMySkillRow(skill) })),
    [skills]
  )
  const counts = useMemo(
    () => ({
      all: rows.length,
      available: rows.filter((r) => r.view.filterBucket === 'available').length,
      locked: rows.filter((r) => r.view.filterBucket === 'locked').length,
      deprecated: rows.filter((r) => r.view.filterBucket === 'deprecated')
        .length,
    }),
    [rows]
  )
  const filteredRows = useMemo(
    () => rows.filter((r) => rowMatchesFilter(r.view, filter)),
    [rows, filter]
  )

  const requestId =
    skillsQuery.data?.meta?.request_id ??
    (
      skillsQuery.error as {
        response?: { data?: { error?: { request_id?: string } } }
      }
    )?.response?.data?.error?.request_id
  const errorMessage =
    (
      skillsQuery.error as {
        response?: { data?: { error?: { message?: string } } }
        message?: string
      }
    )?.response?.data?.error?.message ??
    (skillsQuery.error as Error | null)?.message

  // Use and skill-name open both navigate to the Skill Detail page. This is
  // navigation only — DR-59 never executes a Skill and never emits skill_used
  // (V1 execution happens through the downloaded package, D-09).
  const goToDetail = (skill: MySkill) => {
    void navigate({
      to: '/skills/$slug',
      params: { slug: skill.slug || skillKey(skill) },
    })
  }

  const handleRemove = (skill: MySkill) => {
    const id = skillKey(skill)
    setRemovingId(id)
    removeMutation.mutate(id)
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('My Skills')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('{{count}} Skills in My Skills', { count: counts.all })}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          {skillsQuery.isError && (
            <ErrorBanner
              message={errorMessage ?? t('Unable to load your skills.')}
              requestId={requestId}
              retryable
              onRetry={() => void skillsQuery.refetch()}
            />
          )}

          {skillsQuery.isLoading ? (
            <div className='flex flex-col gap-3'>
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className='h-14 w-full' />
              ))}
            </div>
          ) : skills.length === 0 ? (
            !skillsQuery.isError && (
              <EmptyState kind='my-skills'>
                <Button
                  type='button'
                  onClick={() => void navigate({ to: '/skills' })}
                >
                  <Sparkles data-icon='inline-start' />
                  {t('Explore Skills')}
                </Button>
              </EmptyState>
            )
          ) : (
            <>
              <MySkillsFilter
                value={filter}
                counts={counts}
                onChange={setFilter}
              />
              {filteredRows.length === 0 ? (
                <p className='text-muted-foreground py-8 text-center text-sm'>
                  {t('No Skills match this filter.')}
                </p>
              ) : isMobile ? (
                <MySkillsMobileList
                  rows={filteredRows}
                  removingId={removingId}
                  onOpen={goToDetail}
                  onUse={goToDetail}
                  onRemove={handleRemove}
                />
              ) : (
                <MySkillsTable
                  rows={filteredRows}
                  removingId={removingId}
                  onOpen={goToDetail}
                  onUse={goToDetail}
                  onRemove={handleRemove}
                />
              )}
            </>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
