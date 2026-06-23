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
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { getMarketplaceSkills, recordMarketplaceSkillEvent } from './api'
import {
  EmptyState,
  ErrorBanner,
  NewSkillBanner,
  SkillCard,
} from './components'
import type { MarketplaceSkill, SkillGrowthEntryPoint } from './types'

const NEW_SKILL_BANNER_DISMISS_KEY = 'dr78_new_skill_banner_dismissed'

function readDismissed(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeDismissed(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    /* private mode */
  }
}

export { SkillDetail } from './skill-detail'

export function Marketplace() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const skillsQuery = useQuery({
    queryKey: ['marketplace-skills'],
    queryFn: getMarketplaceSkills,
    placeholderData: (prev) => prev,
  })

  const skills = skillsQuery.data?.data ?? []
  const newSkill = useMemo(
    () => skills.find((skill) => skill.featured === true) ?? skills[0],
    [skills]
  )
  const [newSkillBannerDismissed, setNewSkillBannerDismissed] = useState(() =>
    readDismissed(NEW_SKILL_BANNER_DISMISS_KEY)
  )
  const showNewSkillBanner = newSkill != null && !newSkillBannerDismissed
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

  useEffect(() => {
    if (!newSkill || newSkillBannerDismissed) return
    void recordMarketplaceSkillEvent(newSkill.slug || newSkill.id, {
      event_type: 'skill_impression',
      entry_point: 'new',
    }).catch(() => undefined)
  }, [newSkill, newSkillBannerDismissed])

  // Every Marketplace discovery surface (card + new-skill banner) routes to the
  // Skill Detail page. The real Download action lives only on that page, where it
  // goes through downloadSkillPackage() (axios api client → New-Api-User header).
  // We never trigger a download URL directly from the list/banner: native
  // navigation omits New-Api-User (SkillUserAuth 401) and would bypass the detail
  // page's runtime-key copy + plan/auth/download error mapping.
  const goToSkillDetail = (
    skill: MarketplaceSkill,
    entryPoint: SkillGrowthEntryPoint
  ) => {
    void recordMarketplaceSkillEvent(skill.slug || skill.id, {
      event_type: 'skill_detail_view',
      entry_point: entryPoint,
    }).catch(() => undefined)
    void navigate({ to: '/skills/$slug', params: { slug: skill.slug } })
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Skill Marketplace')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Browse and download skills to enhance your AI experience')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          {showNewSkillBanner && (
            <NewSkillBanner
              skill={newSkill}
              onAction={() => goToSkillDetail(newSkill, 'new')}
              onDismiss={() => {
                setNewSkillBannerDismissed(true)
                writeDismissed(NEW_SKILL_BANNER_DISMISS_KEY)
              }}
            />
          )}
          {skillsQuery.isError && (
            <ErrorBanner
              message={errorMessage ?? t('Unable to load marketplace skills.')}
              requestId={requestId}
              retryable
              onRetry={() => void skillsQuery.refetch()}
            />
          )}
          {skillsQuery.isLoading ? (
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
              {Array.from({ length: 6 }).map((_, index) => (
                <SkillCard key={index} variant='loading' />
              ))}
            </div>
          ) : skills.length > 0 ? (
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
              {skills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  // Card click always opens the detail page, so the CTA must
                  // read "View" — not the backend availability.cta (Upgrade /
                  // Sign in / Use / Unavailable), which would mislabel a button
                  // that only navigates. The actual action (Download / upgrade)
                  // lives on the detail page. Shares goToSkillDetail with the
                  // new-skill banner (records the DR-78 detail-view event, then navigates).
                  cta='view'
                  onCTA={(s) => goToSkillDetail(s, 'marketplace_card')}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              kind={skillsQuery.isError ? 'feature-off' : 'marketplace'}
            />
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
