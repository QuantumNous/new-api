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
  Baby,
  Building2,
  CheckCircle2,
  Clock3,
  Download,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { KidsBadgeState, RatingSummary, SkillPlan } from '../types'

interface PlanBadgeProps {
  plan: SkillPlan
}

const planIcon = {
  free: CheckCircle2,
  pro: Zap,
  enterprise: Building2,
} satisfies Record<SkillPlan, typeof CheckCircle2>

export function PlanBadge({ plan }: PlanBadgeProps) {
  const { t } = useTranslation()
  const Icon = planIcon[plan]
  const label =
    plan === 'free' ? t('Free') : plan === 'pro' ? t('Pro') : t('Enterprise')

  return (
    <Badge
      variant={plan === 'free' ? 'secondary' : 'outline'}
      aria-label={t('Required plan: {{plan}}', { plan: label })}
    >
      <Icon data-icon='inline-start' />
      {label}
    </Badge>
  )
}

interface KidsBadgeProps {
  state: KidsBadgeState
}

const kidsBadgeConfig = {
  kids_safe: { icon: ShieldCheck, label: 'Kids Safe', variant: 'secondary' },
  kids_exclusive: { icon: Baby, label: 'Kids Exclusive', variant: 'secondary' },
  pending: { icon: Clock3, label: 'Kids Review Pending', variant: 'outline' },
  blocked: { icon: XCircle, label: 'Kids Blocked', variant: 'destructive' },
} as const

export function KidsBadge({ state }: KidsBadgeProps) {
  const { t } = useTranslation()
  const config = kidsBadgeConfig[state]
  const Icon = config.icon

  return (
    <Badge variant={config.variant} aria-label={t(config.label)}>
      <Icon data-icon='inline-start' />
      {t(config.label)}
    </Badge>
  )
}

const socialBadgeConfig = {
  new: { icon: Sparkles, label: 'New', variant: 'secondary' },
  trending: { icon: TrendingUp, label: 'Trending', variant: 'outline' },
  popular: { icon: Star, label: 'Popular', variant: 'outline' },
  plus_exclusive: { icon: Zap, label: 'PLUS-exclusive', variant: 'outline' },
} as const

interface MarketplaceTrustBadgesProps {
  badges?: string[]
}

export function MarketplaceTrustBadges(props: MarketplaceTrustBadgesProps) {
  const { t } = useTranslation()
  const visibleBadges = (props.badges ?? []).filter(
    (badge): badge is keyof typeof socialBadgeConfig =>
      badge === 'new' ||
      badge === 'trending' ||
      badge === 'popular' ||
      badge === 'plus_exclusive'
  )

  if (visibleBadges.length === 0) return null

  return (
    <>
      {visibleBadges.map((badge) => {
        const config = socialBadgeConfig[badge]
        const Icon = config.icon
        return (
          <Badge
            key={badge}
            variant={config.variant}
            aria-label={t(config.label)}
          >
            <Icon data-icon='inline-start' />
            {t(config.label)}
          </Badge>
        )
      })}
    </>
  )
}

interface SocialProofRowProps {
  rating?: RatingSummary
  downloadCount?: number
  className?: string
}

export function SocialProofRow(props: SocialProofRowProps) {
  const { t } = useTranslation()
  const reviewCount = Math.max(0, Math.floor(props.rating?.count ?? 0))
  const average = reviewCount > 0 ? clampRating(props.rating?.average ?? 0) : 0
  const roundedStars = Math.round(average)
  const downloadCount = Math.max(0, Math.floor(props.downloadCount ?? 0))

  return (
    <div
      className={cn(
        'text-muted-foreground flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums',
        props.className
      )}
    >
      <span
        className='inline-flex items-center gap-1'
        aria-label={
          reviewCount > 0
            ? t('{{rating}} out of 5 stars from {{count}} reviews', {
                rating: average.toFixed(1),
                count: reviewCount,
              })
            : t('No approved reviews yet')
        }
      >
        <span className='text-warning inline-flex'>
          {Array.from({ length: 5 }, (_, index) => (
            <Star
              key={index}
              className={cn('size-3.5', index < roundedStars && 'fill-current')}
              aria-hidden='true'
            />
          ))}
        </span>
        <span>
          {reviewCount > 0
            ? `${average.toFixed(1)} (${reviewCount})`
            : t('No reviews')}
        </span>
      </span>
      <span
        className='inline-flex items-center gap-1'
        aria-label={t('{{count}} downloads', { count: downloadCount })}
      >
        <Download className='size-3.5' aria-hidden='true' />
        {formatDownloadCount(downloadCount)} {t('downloads')}
      </span>
    </div>
  )
}

export function formatDownloadCount(count: number): string {
  if (count >= 1000000) return `${trimTrailingZero(count / 1000000)}m`
  if (count >= 1000) return `${trimTrailingZero(count / 1000)}k`
  return `${Math.max(0, Math.floor(count))}`
}

function trimTrailingZero(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}

function clampRating(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 5) return 5
  return value
}
