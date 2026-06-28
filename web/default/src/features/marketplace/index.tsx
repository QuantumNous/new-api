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
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Bookmark,
  Download,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SectionPageLayout } from '@/components/layout'
import {
  emitMarketplaceEvent,
  getMarketplaceRailSkills,
  getDownloadLeaderboardSkills,
  getMarketplaceSkills,
  recordMarketplaceSkillEvent,
  saveSkill,
  unsaveSkill,
} from './api'
import {
  EmptyState,
  ErrorBanner,
  NewSkillBanner,
  SkillCard,
} from './components'
import {
  filterMarketplaceSkills,
  marketplaceEmptyState,
  resolveMarketplaceSkill,
} from './lib'
import type {
  DownloadLeaderboardSkill,
  MarketplaceFilters,
  MarketplaceSkill,
  MarketplaceStatusFilter,
  SkillGrowthEntryPoint,
  SkillPlan,
} from './types'

const ALL_VALUE = '__all__'
const SEARCH_DEBOUNCE_MS = 300
const NEW_SKILL_BANNER_DISMISS_KEY = 'dr78_new_skill_banner_dismissed'

const initialFilters: MarketplaceFilters = {
  query: '',
  category: '',
  plan: 'all',
  status: 'all',
  kidsSafeOnly: false,
}

const kidsFilterEnabled =
  import.meta.env.VITE_SKILL_KIDS_FILTER === 'true' ||
  import.meta.env.VITE_DEEPROUTER_KIDS_MARKETPLACE === 'true'

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

function labelForPlan(plan: SkillPlan) {
  if (plan === 'free') return 'Free'
  if (plan === 'pro') return 'Pro'
  return 'Enterprise'
}

function labelForStatus(status: MarketplaceStatusFilter) {
  switch (status) {
    case 'available':
      return 'Available'
    case 'enabled':
      return 'Enabled'
    case 'locked':
      return 'Locked'
    case 'unavailable':
      return 'Unavailable'
    case 'all':
      return 'All statuses'
  }
}

export { SkillDetail } from './skill-detail'

export function Marketplace() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const [filters, setFilters] = useState<MarketplaceFilters>(initialFilters)
  const [debouncedQuery, setDebouncedQuery] = useState(initialFilters.query)
  const [page, setPage] = useState(1)
  const [newSkillBannerDismissed, setNewSkillBannerDismissed] = useState(() =>
    readDismissed(NEW_SKILL_BANNER_DISMISS_KEY)
  )
  const observedCards = useRef(new Map<string, HTMLDivElement>())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const emittedImpressions = useRef(new Set<string>())
  const emittedLeaderboardImpressions = useRef(new Set<string>())

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(filters.query)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [filters.query])

  const serverFilters = useMemo(
    () => ({
      query: debouncedQuery,
      category: filters.category,
      plan: filters.plan,
      kidsSafeOnly: filters.kidsSafeOnly,
    }),
    [debouncedQuery, filters.category, filters.kidsSafeOnly, filters.plan]
  )

  const skillsQuery = useQuery({
    queryKey: ['marketplace-skills', serverFilters, page],
    queryFn: () => getMarketplaceSkills(serverFilters, page),
    placeholderData: (prev) => prev,
  })
  const newWeekQuery = useQuery({
    queryKey: ['marketplace-rail', 'new_week', serverFilters],
    queryFn: () => getMarketplaceRailSkills('new_week', serverFilters),
  })
  const trendingQuery = useQuery({
    queryKey: ['marketplace-rail', 'trending', serverFilters],
    queryFn: () => getMarketplaceRailSkills('trending', serverFilters),
  })
  const weeklyLeaderboardQuery = useQuery({
    queryKey: ['marketplace-download-leaderboard', '7d', filters.category],
    queryFn: () =>
      getDownloadLeaderboardSkills({
        window: '7d',
        category: filters.category,
        limit: 6,
      }),
    retry: false,
  })
  const monthlyLeaderboardQuery = useQuery({
    queryKey: ['marketplace-download-leaderboard', '30d', filters.category],
    queryFn: () =>
      getDownloadLeaderboardSkills({
        window: '30d',
        category: filters.category,
        limit: 6,
      }),
    retry: false,
  })

  const { mutate: emitEvent } = useMutation({
    mutationFn: emitMarketplaceEvent,
    retry: false,
  })

  const saveMutation = useMutation({
    mutationFn: (skill: MarketplaceSkill) =>
      skill.saved === true
        ? unsaveSkill(skill.slug || skill.id, 'marketplace_card')
        : saveSkill(skill.slug || skill.id, 'marketplace_card'),
    onSuccess: async () => {
      await skillsQuery.refetch()
    },
  })

  const skills = useMemo(
    () =>
      (skillsQuery.data?.data ?? []).map((skill) =>
        resolveMarketplaceSkill(skill, user)
      ),
    [skillsQuery.data?.data, user]
  )
  const newWeekSkills = useMemo(
    () =>
      (newWeekQuery.data?.data ?? []).map((skill) =>
        resolveMarketplaceSkill(skill, user)
      ),
    [newWeekQuery.data?.data, user]
  )
  const trendingSkills = useMemo(
    () =>
      (trendingQuery.data?.data ?? []).map((skill) =>
        resolveMarketplaceSkill(skill, user)
      ),
    [trendingQuery.data?.data, user]
  )
  const newSkill = useMemo(
    () => skills.find((skill) => skill.featured === true) ?? skills[0],
    [skills]
  )
  const showNewSkillBanner = newSkill != null && !newSkillBannerDismissed
  const categories = useMemo(
    () =>
      Array.from(
        new Set(skills.map((skill) => skill.category).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [skills]
  )
  const filteredSkills = useMemo(
    () => filterMarketplaceSkills(skills, filters),
    [filters, skills]
  )
  const pagination = skillsQuery.data?.pagination
  const filterSignature = useMemo(
    () =>
      JSON.stringify({
        query: debouncedQuery.trim(),
        category: filters.category,
        plan: filters.plan,
        status: filters.status,
        kidsSafeOnly: filters.kidsSafeOnly,
      }),
    [
      debouncedQuery,
      filters.category,
      filters.kidsSafeOnly,
      filters.plan,
      filters.status,
    ]
  )
  const emptyKind = marketplaceEmptyState(
    skills.length,
    filteredSkills.length,
    filters,
    skillsQuery.isError
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

  useEffect(() => {
    emittedImpressions.current.clear()
    emittedLeaderboardImpressions.current.clear()
  }, [filterSignature])

  useEffect(() => {
    const groups: Array<{
      entryPoint: SkillGrowthEntryPoint
      skills: DownloadLeaderboardSkill[]
    }> = [
      {
        entryPoint: 'leaderboard_weekly',
        skills: weeklyLeaderboardQuery.data?.data ?? [],
      },
      {
        entryPoint: 'leaderboard_monthly',
        skills: monthlyLeaderboardQuery.data?.data ?? [],
      },
    ]
    groups.forEach((group) => {
      group.skills.forEach((skill) => {
        const key = `${filterSignature}:${group.entryPoint}:${skill.id}`
        if (emittedLeaderboardImpressions.current.has(key)) return
        emittedLeaderboardImpressions.current.add(key)
        void recordMarketplaceSkillEvent(skill.slug || skill.id, {
          event_type: 'skill_impression',
          entry_point: group.entryPoint,
        }).catch(() => undefined)
      })
    })
  }, [
    filterSignature,
    monthlyLeaderboardQuery.data?.data,
    weeklyLeaderboardQuery.data?.data,
  ])

  useEffect(() => {
    if (!newSkill || newSkillBannerDismissed) return
    void recordMarketplaceSkillEvent(newSkill.slug || newSkill.id, {
      event_type: 'skill_impression',
      entry_point: 'new',
    }).catch(() => undefined)
  }, [newSkill, newSkillBannerDismissed])

  useEffect(() => {
    newWeekSkills.forEach((skill) => {
      void recordMarketplaceSkillEvent(skill.slug || skill.id, {
        event_type: 'skill_impression',
        entry_point: 'new_week',
      }).catch(() => undefined)
    })
  }, [filterSignature, newWeekSkills])

  useEffect(() => {
    trendingSkills.forEach((skill) => {
      void recordMarketplaceSkillEvent(skill.slug || skill.id, {
        event_type: 'skill_impression',
        entry_point: 'trending',
      }).catch(() => undefined)
    })
  }, [filterSignature, trendingSkills])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      filteredSkills.forEach((skill) => {
        const key = `${filterSignature}:${skill.id}`
        if (emittedImpressions.current.has(key)) return
        emittedImpressions.current.add(key)
        emitEvent({
          event_type: 'skill_impression',
          skill_id: skill.id,
          entry_point: 'marketplace_card',
        })
      })
      return
    }

    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const skillId = (entry.target as HTMLElement).dataset.skillId
          if (!skillId) return
          const key = `${filterSignature}:${skillId}`
          if (emittedImpressions.current.has(key)) return
          emittedImpressions.current.add(key)
          emitEvent({
            event_type: 'skill_impression',
            skill_id: skillId,
            entry_point: 'marketplace_card',
          })
        })
      },
      { threshold: 0.5 }
    )

    observedCards.current.forEach((node) => observerRef.current?.observe(node))
    return () => observerRef.current?.disconnect()
  }, [emitEvent, filterSignature, filteredSkills])

  function updateFilter<K extends keyof MarketplaceFilters>(
    key: K,
    value: MarketplaceFilters[K]
  ) {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  function clearFilters() {
    setFilters(initialFilters)
    setPage(1)
  }

  function cardRef(skillId: string) {
    return (node: HTMLDivElement | null) => {
      if (node == null) {
        observedCards.current.delete(skillId)
        return
      }
      node.dataset.skillId = skillId
      observedCards.current.set(skillId, node)
      observerRef.current?.observe(node)
    }
  }

  const goToSkillDetail = (
    skill: MarketplaceSkill,
    entryPoint: SkillGrowthEntryPoint
  ) => {
    if (entryPoint === 'marketplace_card') {
      emitEvent({
        event_type: 'skill_detail_view',
        skill_id: skill.id,
        entry_point: 'marketplace_card',
      })
    } else {
      void recordMarketplaceSkillEvent(skill.slug || skill.id, {
        event_type: 'skill_detail_view',
        entry_point: entryPoint,
      }).catch(() => undefined)
    }
    void navigate({
      to: '/skills/$slug',
      params: { slug: skill.slug || skill.id },
    })
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
          <div className='bg-card grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(220px,1fr)_auto]'>
            <InputGroup className='bg-background/50 h-10'>
              <InputGroupAddon>
                <Search className='size-4' aria-hidden='true' />
              </InputGroupAddon>
              <InputGroupInput
                value={filters.query}
                onChange={(event) => updateFilter('query', event.target.value)}
                placeholder={t('Search Skills by name or description')}
                aria-label={t('Search Skills')}
              />
              {filters.query && (
                <InputGroupAddon align='inline-end'>
                  <InputGroupButton
                    size='icon-xs'
                    aria-label={t('Clear search')}
                    onClick={() => updateFilter('query', '')}
                  >
                    <X className='size-3.5' aria-hidden='true' />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
            <div className='flex flex-wrap items-center gap-2'>
              <Select
                value={filters.category || ALL_VALUE}
                onValueChange={(value) => {
                  if (value == null) return
                  updateFilter('category', value === ALL_VALUE ? '' : value)
                }}
              >
                <SelectTrigger className='bg-background/50 h-10 min-w-36'>
                  <SelectValue placeholder={t('Category')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>
                      {t('All categories')}
                    </SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {t(category)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select
                value={filters.plan}
                onValueChange={(value) =>
                  updateFilter('plan', value as MarketplaceFilters['plan'])
                }
              >
                <SelectTrigger className='bg-background/50 h-10 min-w-32'>
                  <SelectValue placeholder={t('Plan')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value='all'>{t('All plans')}</SelectItem>
                    {(['free', 'pro', 'enterprise'] as const).map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {t(labelForPlan(plan))}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  updateFilter('status', value as MarketplaceFilters['status'])
                }
              >
                <SelectTrigger className='bg-background/50 h-10 min-w-36'>
                  <SelectValue placeholder={t('Status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(
                      [
                        'all',
                        'available',
                        'enabled',
                        'locked',
                        'unavailable',
                      ] as const
                    ).map((status) => (
                      <SelectItem key={status} value={status}>
                        {t(labelForStatus(status))}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {kidsFilterEnabled && (
                <Label className='border-input bg-background/50 h-10 rounded-lg border px-3'>
                  <ShieldCheck className='size-4' aria-hidden='true' />
                  <span>{t('Kids Safe')}</span>
                  <Switch
                    size='sm'
                    checked={filters.kidsSafeOnly}
                    onCheckedChange={(checked) =>
                      updateFilter('kidsSafeOnly', checked)
                    }
                    aria-label={t('Show Kids Safe Skills only')}
                  />
                </Label>
              )}
              <Button
                type='button'
                variant='outline'
                className='h-10'
                onClick={() => void navigate({ to: '/skills/saved' })}
              >
                <Bookmark data-icon='inline-start' />
                {t('Saved Skills')}
              </Button>
              <Button
                type='button'
                variant='outline'
                className='h-10'
                onClick={clearFilters}
              >
                <SlidersHorizontal data-icon='inline-start' />
                {t('Clear filters')}
              </Button>
            </div>
          </div>

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
          <MarketplaceRail
            title={t('New this week')}
            skills={newWeekSkills}
            loading={newWeekQuery.isLoading}
            entryPoint='new_week'
            onOpen={goToSkillDetail}
          />
          <MarketplaceRail
            title={t('Trending')}
            skills={trendingSkills}
            loading={trendingQuery.isLoading}
            entryPoint='trending'
            onOpen={goToSkillDetail}
          />
          <div className='grid gap-3 lg:grid-cols-2'>
            <DownloadLeaderboardRail
              title={t('This Week')}
              skills={weeklyLeaderboardQuery.data?.data ?? []}
              isLoading={weeklyLeaderboardQuery.isLoading}
              entryPoint='leaderboard_weekly'
              onOpen={goToSkillDetail}
            />
            <DownloadLeaderboardRail
              title={t('This Month')}
              skills={monthlyLeaderboardQuery.data?.data ?? []}
              isLoading={monthlyLeaderboardQuery.isLoading}
              entryPoint='leaderboard_monthly'
              onOpen={goToSkillDetail}
            />
          </div>
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
          ) : filteredSkills.length > 0 ? (
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
              {filteredSkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onOpen={(cardSkill) =>
                    goToSkillDetail(cardSkill, 'marketplace_card')
                  }
                  onCTA={(cardSkill) =>
                    goToSkillDetail(cardSkill, 'marketplace_card')
                  }
                  onSaveToggle={(cardSkill) => saveMutation.mutate(cardSkill)}
                  cardRef={cardRef(skill.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              kind={emptyKind}
              action={
                emptyKind === 'search' ||
                emptyKind === 'category' ||
                emptyKind === 'kids' ||
                emptyKind === 'filters'
                  ? 'view'
                  : undefined
              }
              onAction={clearFilters}
            />
          )}
          {pagination != null &&
            (pagination.page > 1 || pagination.has_next) && (
              <div className='flex items-center justify-end gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  disabled={pagination.page <= 1 || skillsQuery.isFetching}
                  onClick={() =>
                    setPage((currentPage) => Math.max(1, currentPage - 1))
                  }
                >
                  {t('Previous')}
                </Button>
                <span className='text-muted-foreground min-w-16 text-center text-sm tabular-nums'>
                  {t('Page')} {pagination.page}
                </span>
                <Button
                  type='button'
                  variant='outline'
                  disabled={!pagination.has_next || skillsQuery.isFetching}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                >
                  {t('Next')}
                </Button>
              </div>
            )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function MarketplaceRail(props: {
  title: string
  skills: MarketplaceSkill[]
  loading: boolean
  entryPoint: Extract<SkillGrowthEntryPoint, 'new_week' | 'trending'>
  onOpen: (skill: MarketplaceSkill, entryPoint: SkillGrowthEntryPoint) => void
}) {
  if (!props.loading && props.skills.length === 0) return null

  return (
    <section className='space-y-3' aria-label={props.title}>
      <div className='flex items-center justify-between gap-3'>
        <h2 className='text-foreground text-base font-semibold'>
          {props.title}
        </h2>
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
        {props.loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <SkillCard key={index} variant='loading' />
            ))
          : props.skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onOpen={(cardSkill) =>
                  props.onOpen(cardSkill, props.entryPoint)
                }
                onCTA={(cardSkill) => props.onOpen(cardSkill, props.entryPoint)}
              />
            ))}
      </div>
    </section>
  )
}

interface DownloadLeaderboardRailProps {
  title: string
  skills: DownloadLeaderboardSkill[]
  isLoading: boolean
  entryPoint: SkillGrowthEntryPoint
  onOpen: (skill: MarketplaceSkill, entryPoint: SkillGrowthEntryPoint) => void
}

function DownloadLeaderboardRail(props: DownloadLeaderboardRailProps) {
  const { t } = useTranslation()

  if (!props.isLoading && props.skills.length === 0) {
    return null
  }

  return (
    <section className='bg-card rounded-[7px] border p-3'>
      <div className='mb-3 flex items-center justify-between gap-2'>
        <h3 className='text-sm font-semibold'>{props.title}</h3>
        <Download className='text-muted-foreground size-4' aria-hidden='true' />
      </div>
      <div className='grid gap-2'>
        {props.isLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className='bg-background/60 h-12 animate-pulse rounded-[7px]'
              />
            ))
          : props.skills.map((skill) => (
              <button
                key={skill.id}
                type='button'
                className='hover:bg-background/70 focus-visible:ring-ring bg-background/40 flex h-14 items-center gap-3 rounded-[7px] border px-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none'
                onClick={() => props.onOpen(skill, props.entryPoint)}
              >
                <span className='bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums'>
                  {skill.rank}
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-sm font-medium'>
                    {skill.name}
                  </span>
                  <span className='text-muted-foreground block truncate text-xs'>
                    {t('{{count}} downloads', {
                      count: skill.download_count,
                    })}
                  </span>
                </span>
              </button>
            ))}
      </div>
    </section>
  )
}
