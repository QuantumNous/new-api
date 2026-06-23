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
import { Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { emitMarketplaceEvent, getAllMarketplaceSkills } from './api'
import {
  EmptyState,
  ErrorBanner,
  KidsBadge,
  PlanBadge,
  SkillCard,
  SkillCTA,
} from './components'
import {
  filterMarketplaceSkills,
  marketplaceEmptyState,
  resolveMarketplaceSkill,
  skillStatusFilterValue,
  type ResolvedMarketplaceSkill,
} from './lib'
import type {
  MarketplaceFilters,
  MarketplaceStatusFilter,
  SkillCTAAction,
  SkillPlan,
} from './types'

const ALL_VALUE = '__all__'

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

export function Marketplace() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const [filters, setFilters] = useState<MarketplaceFilters>(initialFilters)
  const [selectedSkill, setSelectedSkill] =
    useState<ResolvedMarketplaceSkill | null>(null)
  const observedCards = useRef(new Map<string, HTMLDivElement>())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const emittedImpressions = useRef(new Set<string>())

  const serverFilters = useMemo(
    () => ({
      query: filters.query,
      category: filters.category,
      plan: filters.plan,
      kidsSafeOnly: filters.kidsSafeOnly,
    }),
    [filters.category, filters.kidsSafeOnly, filters.plan, filters.query]
  )

  const skillsQuery = useQuery({
    queryKey: ['marketplace-skills', serverFilters],
    queryFn: () => getAllMarketplaceSkills(serverFilters),
    placeholderData: (prev) => prev,
  })

  const { mutate: emitEvent } = useMutation({
    mutationFn: emitMarketplaceEvent,
    retry: false,
  })

  const skills = useMemo(
    () =>
      (skillsQuery.data?.data ?? []).map((skill) =>
        resolveMarketplaceSkill(skill, user)
      ),
    [skillsQuery.data?.data, user]
  )
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
  const filterSignature = useMemo(
    () =>
      JSON.stringify({
        query: filters.query.trim(),
        category: filters.category,
        plan: filters.plan,
        status: filters.status,
        kidsSafeOnly: filters.kidsSafeOnly,
      }),
    [filters]
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
  }, [filterSignature])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      filteredSkills.forEach((skill, index) => {
        const key = `${filterSignature}:${skill.id}`
        if (emittedImpressions.current.has(key)) return
        emittedImpressions.current.add(key)
        emitEvent({
          event_type: 'skill_impression',
          skill_id: skill.id,
          entry_point: 'marketplace_card',
          metadata: {
            surface_id: 'marketplace_grid',
            card_position: index,
            schema_version: '1.0',
            producer: 'frontend',
            client_event_time: new Date().toISOString(),
          },
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
          const position = Number(
            (entry.target as HTMLElement).dataset.skillPosition ?? '0'
          )
          if (!skillId) return
          const key = `${filterSignature}:${skillId}`
          if (emittedImpressions.current.has(key)) return
          emittedImpressions.current.add(key)
          emitEvent({
            event_type: 'skill_impression',
            skill_id: skillId,
            entry_point: 'marketplace_card',
            metadata: {
              surface_id: 'marketplace_grid',
              card_position: position,
              schema_version: '1.0',
              producer: 'frontend',
              client_event_time: new Date().toISOString(),
            },
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
  }

  function clearFilters() {
    setFilters(initialFilters)
  }

  function handleOpenSkill(skill: ResolvedMarketplaceSkill) {
    setSelectedSkill(skill)
    emitEvent({
      event_type: 'skill_detail_view',
      skill_id: skill.id,
      entry_point: 'marketplace_card',
      metadata: {
        source_entry_point: 'marketplace_card',
        schema_version: '1.0',
        producer: 'frontend',
        client_event_time: new Date().toISOString(),
      },
    })
  }

  function handleCTA(skill: ResolvedMarketplaceSkill) {
    const action = (skill.availability.cta ?? 'enable') as SkillCTAAction
    switch (action) {
      case 'login':
        window.location.assign('/sign-in')
        break
      case 'upgrade':
      case 'renew':
        window.location.assign('/wallet')
        break
      case 'contact_sales':
        window.location.href = 'mailto:support@deeprouter.co'
        break
      case 'enable':
      case 'download':
        window.location.href = `/api/v1/marketplace/skills/${encodeURIComponent(
          skill.slug || skill.id
        )}/download`
        break
      case 'use':
        toast.info(t('Download the Skill package and use it in your tool.'))
        break
      case 'unavailable':
      default:
        break
    }
  }

  function cardRef(skillId: string, index: number) {
    return (node: HTMLDivElement | null) => {
      if (node == null) {
        observedCards.current.delete(skillId)
        return
      }
      node.dataset.skillId = skillId
      node.dataset.skillPosition = String(index)
      observedCards.current.set(skillId, node)
      observerRef.current?.observe(node)
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Skill Marketplace')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Browse and enable skills to enhance your AI experience')}
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
                onClick={clearFilters}
              >
                <SlidersHorizontal data-icon='inline-start' />
                {t('Clear filters')}
              </Button>
            </div>
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
              {filteredSkills.map((skill, index) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onOpen={(cardSkill) =>
                    handleOpenSkill(cardSkill as ResolvedMarketplaceSkill)
                  }
                  onCTA={(cardSkill) =>
                    handleCTA(cardSkill as ResolvedMarketplaceSkill)
                  }
                  cardRef={cardRef(skill.id, index)}
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
        </div>
      </SectionPageLayout.Content>
      <Dialog
        open={selectedSkill != null}
        onOpenChange={(open) => {
          if (!open) setSelectedSkill(null)
        }}
      >
        {selectedSkill != null && (
          <DialogContent className='sm:max-w-lg'>
            <DialogHeader>
              <div className='flex flex-wrap items-center gap-2'>
                <PlanBadge plan={selectedSkill.required_plan} />
                {selectedSkill.is_kids_safe && <KidsBadge state='kids_safe' />}
                {selectedSkill.is_kids_exclusive && (
                  <KidsBadge state='kids_exclusive' />
                )}
              </div>
              <DialogTitle>{selectedSkill.name}</DialogTitle>
              <DialogDescription>
                {selectedSkill.short_description ||
                  selectedSkill.description ||
                  t('No description provided.')}
              </DialogDescription>
            </DialogHeader>
            <div className='grid gap-3 text-sm'>
              <div className='flex items-center justify-between rounded-lg border p-3'>
                <span className='text-muted-foreground'>{t('Category')}</span>
                <span>{selectedSkill.category || t('Uncategorized')}</span>
              </div>
              <div className='flex items-center justify-between rounded-lg border p-3'>
                <span className='text-muted-foreground'>{t('Status')}</span>
                <span>
                  {t(labelForStatus(skillStatusFilterValue(selectedSkill)))}
                </span>
              </div>
            </div>
            <DialogFooter>
              <SkillCTA
                action={
                  (selectedSkill.availability.cta ?? 'enable') as SkillCTAAction
                }
                onClick={() => handleCTA(selectedSkill)}
              />
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </SectionPageLayout>
  )
}
