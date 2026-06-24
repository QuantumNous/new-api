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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { SectionPageLayout } from '@/components/layout'
import { getMySkills, removeMySkill } from './api'
import { EmptyState, ErrorBanner, SkillCard } from './components'

export function MySkills() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
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
  })

  const skills = skillsQuery.data?.data ?? []
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

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('My Skills')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Skills you have downloaded will appear here')}
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
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
              {Array.from({ length: 3 }).map((_, index) => (
                <SkillCard key={index} variant='loading' />
              ))}
            </div>
          ) : skills.length > 0 ? (
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
              {skills.map((skill) => (
                <SkillCard
                  key={skill.id ?? skill.skill_id}
                  skill={{
                    ...skill,
                    id: skill.id ?? skill.skill_id ?? skill.slug,
                    status: skill.status ?? skill.skill_status,
                    availability: skill.availability ?? {
                      enabled: skill.enabled,
                      cta: skill.enabled ? 'use' : 'enable',
                    },
                  }}
                  cta='remove'
                  ctaDisabled={removeMutation.isPending}
                  onCTA={(selectedSkill) => {
                    removeMutation.mutate(
                      selectedSkill.id ?? selectedSkill.slug
                    )
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              kind={skillsQuery.isError ? 'feature-off' : 'my-skills'}
            />
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
