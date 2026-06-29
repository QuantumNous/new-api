/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Bookmark,
  CalendarClock,
  CreditCard,
  Home,
  PackageCheck,
  Sparkles,
  WalletCards,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatQuota } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionPageLayout } from '@/components/layout'
import {
  downloadSkillPackage,
  recordMarketplaceSkillEvent,
  saveSkill,
  skillDownloadURL,
  unsaveSkill,
} from '@/features/marketplace/api'
import {
  ErrorBanner,
  PlanBadge,
  SkillCard,
  SkillCardSkeleton,
} from '@/features/marketplace/components'
import type { MarketplaceSkill, SavedSkill } from '@/features/marketplace/types'
import { getUserHome } from './api'
import type { UserHomeData } from './types'

export function UserHome() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['user-home'],
    queryFn: getUserHome,
    retry: false,
  })
  const entryPoint = query.data?.entry_point ?? 'user_home'
  const saveMutation = useMutation({
    mutationFn: (skill: MarketplaceSkill) => {
      const id = skill.slug || skill.id
      return skill.saved === true
        ? unsaveSkill(id, entryPoint)
        : saveSkill(id, entryPoint)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['user-home'] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace-skills'] }),
        queryClient.invalidateQueries({
          queryKey: ['marketplace-saved-skills'],
        }),
      ])
      toast.success(t('Saved successfully'))
    },
  })

  const openSkill = (skill: MarketplaceSkill | SavedSkill) => {
    const slug =
      'skill_id' in skill
        ? skill.slug || skill.skill_id
        : skill.slug || skill.id
    void navigate({ to: '/skills/$slug', params: { slug } })
  }

  const handleCardCTA = (skill: MarketplaceSkill) => {
    if (skill.availability?.cta === 'download') {
      void downloadSkillPackage(
        skillDownloadURL(skill.slug || skill.id, entryPoint),
        skill.slug || skill.id
      ).catch(() => toast.error(t('Download failed')))
      return
    }
    openSkill(skill)
  }

  const emitImpressions = useMemo(() => {
    if (!query.data) return []
    return [
      ...query.data.recommended_for_you,
      ...query.data.new_this_week_for_you,
    ].map((skill) => skill.id)
  }, [query.data])

  useEffect(() => {
    for (const skillId of emitImpressions) {
      void recordMarketplaceSkillEvent(skillId, {
        event_type: 'skill_impression',
        entry_point: entryPoint,
      }).catch(() => undefined)
    }
  }, [emitImpressions, entryPoint])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Home')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Your balance, plan, purchases, saved Skills, and recommendations.')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        {query.isError ? (
          <ErrorBanner
            message={t('Unable to load your home dashboard.')}
            retryable
            onRetry={() => void query.refetch()}
          />
        ) : query.isLoading || !query.data ? (
          <UserHomeSkeleton />
        ) : (
          <div className='flex flex-col gap-5'>
            <StatusGrid data={query.data} />
            <SkillRail
              title={t('Recommended for you')}
              icon={<Sparkles className='size-4' aria-hidden='true' />}
              skills={query.data.recommended_for_you}
              emptyLabel={t('Recommendations appear after you add Skills.')}
              onOpen={openSkill}
              onCTA={handleCardCTA}
              onSaveToggle={(skill) => saveMutation.mutate(skill)}
              ctaDisabled={saveMutation.isPending}
            />
            <SkillRail
              title={t('New this week for you')}
              icon={<CalendarClock className='size-4' aria-hidden='true' />}
              skills={query.data.new_this_week_for_you}
              emptyLabel={t('No matching new Skills this week.')}
              onOpen={openSkill}
              onCTA={handleCardCTA}
              onSaveToggle={(skill) => saveMutation.mutate(skill)}
              ctaDisabled={saveMutation.isPending}
            />
            <SavedRail skills={query.data.saved_skills} onOpen={openSkill} />
          </div>
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function StatusGrid(props: { data: UserHomeData }) {
  const { t } = useTranslation()
  const activePlan = props.data.subscriptions.active[0]
  const latestOrder = props.data.purchases.recent_orders[0]
  const cards = [
    {
      label: t('Balance'),
      value: formatQuota(props.data.account.balance_quota),
      detail: t('{{count}} recent top-ups', {
        count: props.data.account.recent_topups_count,
      }),
      icon: WalletCards,
    },
    {
      label: t('Plan'),
      value: activePlan?.plan?.title ?? t('No active plan'),
      detail:
        activePlan?.subscription.status === 'active'
          ? t('Active until {{date}}', {
              date: new Date(
                activePlan.subscription.end_time * 1000
              ).toLocaleDateString(),
            })
          : t('Upgrade when a Skill needs PLUS'),
      icon: CreditCard,
    },
    {
      label: t('Purchases'),
      value: t('{{count}} owned Skills', {
        count: props.data.purchases.entitled_skill_ids.length,
      }),
      detail: latestOrder
        ? t('Latest: {{name}}', { name: latestOrder.skill_name })
        : t('No Skill purchases yet'),
      icon: PackageCheck,
    },
  ]

  return (
    <div className='grid grid-cols-1 gap-3 lg:grid-cols-3'>
      {cards.map((item) => (
        <Card key={item.label} size='sm'>
          <CardHeader>
            <div className='flex items-center justify-between gap-3'>
              <CardTitle className='text-sm font-semibold'>
                {item.label}
              </CardTitle>
              <item.icon className='text-muted-foreground size-4' />
            </div>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold tabular-nums'>
              {item.value}
            </div>
            <p className='text-muted-foreground mt-1 text-sm'>{item.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

interface SkillRailProps {
  title: string
  icon: ReactNode
  skills: MarketplaceSkill[]
  emptyLabel: string
  onOpen: (skill: MarketplaceSkill) => void
  onCTA: (skill: MarketplaceSkill) => void
  onSaveToggle: (skill: MarketplaceSkill) => void
  ctaDisabled?: boolean
}

function SkillRail(props: SkillRailProps) {
  return (
    <section className='flex flex-col gap-3'>
      <div className='flex items-center gap-2'>
        {props.icon}
        <h2 className='text-base font-semibold'>{props.title}</h2>
      </div>
      {props.skills.length === 0 ? (
        <div className='text-muted-foreground rounded-lg border px-4 py-6 text-sm'>
          {props.emptyLabel}
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-3 xl:grid-cols-3'>
          {props.skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onOpen={props.onOpen}
              onCTA={props.onCTA}
              onSaveToggle={props.onSaveToggle}
              ctaDisabled={props.ctaDisabled}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function SavedRail(props: {
  skills: SavedSkill[]
  onOpen: (skill: SavedSkill) => void
}) {
  const { t } = useTranslation()
  return (
    <section className='flex flex-col gap-3'>
      <div className='flex items-center gap-2'>
        <Bookmark className='size-4' aria-hidden='true' />
        <h2 className='text-base font-semibold'>{t('Saved')}</h2>
      </div>
      {props.skills.length === 0 ? (
        <div className='text-muted-foreground rounded-lg border px-4 py-6 text-sm'>
          {t('Saved Skills appear here.')}
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
          {props.skills.map((skill) => (
            <Card key={skill.skill_id} size='sm'>
              <CardHeader>
                <div className='flex items-start justify-between gap-3'>
                  <CardTitle className='line-clamp-1 text-base'>
                    {skill.name}
                  </CardTitle>
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
                <div className='flex items-center justify-between gap-3'>
                  <PlanBadge plan={skill.required_plan} />
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() => props.onOpen(skill)}
                  >
                    <Home data-icon='inline-start' />
                    {t('Open')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}

function UserHomeSkeleton() {
  return (
    <div className='flex flex-col gap-5'>
      <div className='grid grid-cols-1 gap-3 lg:grid-cols-3'>
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className='h-32 w-full' />
        ))}
      </div>
      <div className='grid grid-cols-1 gap-3 xl:grid-cols-3'>
        {Array.from({ length: 3 }).map((_, index) => (
          <SkillCardSkeleton key={index} />
        ))}
      </div>
      <div className='grid grid-cols-1 gap-3 xl:grid-cols-3'>
        {Array.from({ length: 3 }).map((_, index) => (
          <SkillCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}
