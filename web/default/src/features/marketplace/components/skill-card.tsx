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
import {
  CheckCircle2,
  LockKeyhole,
  PackageOpen,
  Bookmark,
  Star,
  TriangleAlert,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { MarketplaceSkill, SkillCTAAction } from '../types'
import {
  KidsBadge,
  MarketplaceTrustBadges,
  PlanBadge,
  SocialProofRow,
} from './badges'
import { LockState } from './lock-state'
import { normalizeLockState } from './lock-state-utils'
import { SkillCTA } from './skill-cta'

export type SkillCardVariant =
  | 'default'
  | 'enabled'
  | 'locked'
  | 'deprecated'
  | 'kids-safe'
  | 'loading'

interface SkillCardProps {
  skill?: MarketplaceSkill
  variant?: SkillCardVariant
  cta?: SkillCTAAction
  onCTA?: (skill: MarketplaceSkill) => void
  onPlusCTA?: (skill: MarketplaceSkill) => void
  onOpen?: (skill: MarketplaceSkill) => void
  onSaveToggle?: (skill: MarketplaceSkill) => void
  cardRef?: (node: HTMLDivElement | null) => void
  className?: string
  ctaDisabled?: boolean
}

function getSkillVariant(
  skill: MarketplaceSkill
): Exclude<SkillCardVariant, 'loading'> {
  if (skill.status === 'deprecated') return 'deprecated'
  if (skill.availability?.enabled === true) return 'enabled'
  if (skill.availability?.locked === true) return 'locked'
  if (skill.is_kids_safe) return 'kids-safe'
  return 'default'
}

function getSkillCTA(skill: MarketplaceSkill): SkillCTAAction {
  const action = skill.availability?.cta
  if (
    action === 'download' ||
    action === 'enable' ||
    action === 'use' ||
    action === 'upgrade' ||
    action === 'renew' ||
    action === 'contact_sales' ||
    action === 'login' ||
    action === 'remove' ||
    action === 'unavailable'
  ) {
    return action
  }
  if (skill.status === 'deprecated') return 'unavailable'
  return 'view'
}

export function SkillCard({
  skill,
  variant,
  cta,
  onCTA,
  onPlusCTA,
  onOpen,
  onSaveToggle,
  cardRef,
  className,
  ctaDisabled,
}: SkillCardProps) {
  const { t } = useTranslation()
  const resolvedVariant =
    variant ?? (skill ? getSkillVariant(skill) : 'loading')

  if (resolvedVariant === 'loading' || skill == null) {
    return <SkillCardSkeleton className={className} />
  }

  const lockState = normalizeLockState(skill.availability?.lock_code)
  const action = cta ?? getSkillCTA(skill)
  const showPaywallCTA =
    resolvedVariant === 'locked' && (action === 'upgrade' || action === 'renew')
  const statusLabel =
    resolvedVariant === 'enabled'
      ? t('Enabled')
      : resolvedVariant === 'locked'
        ? t('Locked')
        : resolvedVariant === 'deprecated'
          ? t('Deprecated')
          : resolvedVariant === 'kids-safe'
            ? t('Kids Safe')
            : t('Available')

  return (
    <Card
      ref={cardRef}
      size='sm'
      className={cn(
        'hover:bg-card/80 focus-within:ring-ring/30 min-h-[272px] cursor-pointer transition-colors focus-within:ring-3',
        resolvedVariant === 'locked' && 'opacity-85',
        resolvedVariant === 'deprecated' && 'border-dashed',
        className
      )}
      role='button'
      tabIndex={0}
      onClick={() => onOpen?.(skill)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen?.(skill)
        }
      }}
      aria-label={t('Skill {{name}}, {{plan}} plan, {{status}}', {
        name: skill.name,
        plan: t(
          skill.required_plan === 'free'
            ? 'Free'
            : skill.required_plan === 'pro'
              ? 'Pro'
              : 'Enterprise'
        ),
        status: statusLabel,
      })}
    >
      <CardHeader>
        <div className='flex min-w-0 items-start gap-3'>
          <div className='bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg'>
            <PackageOpen className='size-5' aria-hidden='true' />
          </div>
          <div className='min-w-0'>
            <CardTitle className='line-clamp-2 min-h-10'>
              {skill.name}
            </CardTitle>
            <CardDescription className='truncate'>
              {skill.category || t('Uncategorized')}
            </CardDescription>
          </div>
        </div>
        <CardAction>
          {skill.saved != null && (
            <button
              type='button'
              className='text-muted-foreground hover:text-foreground focus-visible:ring-ring bg-background inline-flex size-8 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none'
              aria-label={skill.saved ? t('Unsave Skill') : t('Save Skill')}
              aria-pressed={skill.saved === true}
              onClick={(event) => {
                event.stopPropagation()
                onSaveToggle?.(skill)
              }}
            >
              <Bookmark
                className={cn(
                  'size-4',
                  skill.saved === true && 'text-primary fill-current'
                )}
                aria-hidden='true'
              />
            </button>
          )}
          {resolvedVariant === 'enabled' && (
            <Badge variant='secondary'>
              <CheckCircle2 data-icon='inline-start' />
              {t('Enabled')}
            </Badge>
          )}
          {resolvedVariant === 'locked' && (
            <Badge variant='outline'>
              <LockKeyhole data-icon='inline-start' />
              {t('Locked')}
            </Badge>
          )}
          {resolvedVariant === 'deprecated' && (
            <Badge variant='destructive'>
              <TriangleAlert data-icon='inline-start' />
              {t('Deprecated')}
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col gap-3'>
        <p className='text-muted-foreground line-clamp-2 min-h-10 text-sm'>
          {skill.short_description ||
            skill.description ||
            t('No description provided.')}
        </p>
        <SocialProofRow
          rating={skill.rating_summary}
          downloadCount={skill.download_count}
        />
        <div className='flex min-h-14 flex-wrap content-start items-start gap-1.5'>
          <PlanBadge plan={skill.required_plan} />
          <MarketplaceTrustBadges badges={skill.badges} />
          {skill.featured_flag === true || skill.featured === true ? (
            <Badge variant='outline'>
              <Star data-icon='inline-start' />
              {t('Featured')}
            </Badge>
          ) : null}
          {skill.is_kids_safe === true && <KidsBadge state='kids_safe' />}
          {skill.is_kids_exclusive === true && (
            <KidsBadge state='kids_exclusive' />
          )}
        </div>
        <div className='min-h-5'>
          {lockState != null && <LockState state={lockState} />}
        </div>
      </CardContent>
      <CardFooter className='justify-between gap-3'>
        <span className='text-muted-foreground min-w-0 truncate text-xs'>
          {showPaywallCTA ? t('$2 unlock') : statusLabel}
        </span>
        {showPaywallCTA ? (
          <div className='flex shrink-0 items-center gap-2'>
            <SkillCTA
              action='upgrade'
              label={t('Unlock $2')}
              disabled={ctaDisabled}
              onClick={(event) => {
                event.stopPropagation()
                onCTA?.(skill)
              }}
            />
            <SkillCTA
              action='upgrade'
              label={t('Get PLUS')}
              variant='outline'
              disabled={ctaDisabled}
              onClick={(event) => {
                event.stopPropagation()
                onPlusCTA?.(skill)
              }}
            />
          </div>
        ) : (
          <SkillCTA
            action={action}
            disabled={ctaDisabled}
            onClick={(event) => {
              event.stopPropagation()
              onCTA?.(skill)
            }}
          />
        )}
      </CardFooter>
    </Card>
  )
}

export function SkillCardSkeleton({ className }: { className?: string }) {
  return (
    <Card size='sm' className={cn('min-h-[272px]', className)} aria-busy='true'>
      <CardHeader>
        <div className='flex items-start gap-3'>
          <Skeleton className='size-10 shrink-0 rounded-lg' />
          <div className='flex min-w-0 flex-1 flex-col gap-2'>
            <Skeleton className='h-5 w-3/4' />
            <Skeleton className='h-4 w-1/2' />
          </div>
        </div>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col gap-3'>
        <div className='flex min-h-10 flex-col gap-2'>
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-5/6' />
        </div>
        <div className='flex min-h-14 gap-2'>
          <Skeleton className='h-5 w-16 rounded-4xl' />
          <Skeleton className='h-5 w-24 rounded-4xl' />
        </div>
        <Skeleton className='h-4 w-28' />
      </CardContent>
      <CardFooter className='justify-between gap-3'>
        <Skeleton className='h-4 w-20' />
        <Skeleton className='h-7 w-28' />
      </CardFooter>
    </Card>
  )
}
