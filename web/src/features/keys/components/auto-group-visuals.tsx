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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { GroupBadge } from '@/components/group-badge'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type GroupRatio = number | string | null | undefined

export const AUTO_GROUP_FRAME_CLASS_NAME =
  'border-primary/40 relative overflow-visible border shadow-sm shadow-primary/10'

type AutoGroupFlowBorderProps = {
  shouldReduceMotion: boolean
}

export function AutoGroupFlowBorder(props: AutoGroupFlowBorderProps) {
  if (props.shouldReduceMotion) return null

  return (
    <span
      aria-hidden='true'
      data-auto-group-flow-border='true'
      className='auto-group-flow-border pointer-events-none absolute -inset-px'
    />
  )
}

type AutoGroupFrameProps = {
  children: ReactNode
  className?: string
  effect: 'badge' | 'ratio'
  shouldReduceMotion: boolean
}

export function AutoGroupFrame(props: AutoGroupFrameProps) {
  return (
    <span
      data-auto-group-frame='true'
      data-auto-group-effect={props.effect}
      className={cn(
        AUTO_GROUP_FRAME_CLASS_NAME,
        'inline-flex max-w-full shrink-0 rounded-4xl p-px',
        props.className
      )}
    >
      <AutoGroupFlowBorder shouldReduceMotion={props.shouldReduceMotion} />
      {props.children}
    </span>
  )
}

function getRatioBadgeClassName(ratio: GroupRatio, isAuto: boolean): string {
  if (isAuto || typeof ratio !== 'number') {
    return 'border-primary/30 bg-primary/10 text-primary'
  }
  if (ratio > 5) {
    return 'border-destructive/30 bg-destructive/10 text-destructive'
  }
  if (ratio > 3) {
    return 'border-warning/30 bg-warning/10 text-warning'
  }
  if (ratio > 1) {
    return 'border-info/30 bg-info/10 text-info'
  }
  return 'border-success/30 bg-success/10 text-success'
}

type GroupRatioBadgeProps = {
  isAuto?: boolean
  ratio: GroupRatio
  shouldReduceMotion?: boolean
}

export function GroupRatioBadge(props: GroupRatioBadgeProps) {
  const { t } = useTranslation()

  if (props.ratio === undefined || props.ratio === null || props.ratio === '') {
    return null
  }

  const label =
    typeof props.ratio === 'number'
      ? `${props.ratio}x ${t('Ratio')}`
      : `${t('Auto')} ${t('Ratio')}`
  const badge = (
    <Badge
      variant='outline'
      className={cn(
        'max-w-full truncate text-[10px] sm:text-xs',
        getRatioBadgeClassName(props.ratio, props.isAuto === true)
      )}
    >
      {label}
    </Badge>
  )

  if (!props.isAuto) {
    return <span className='max-w-24 shrink-0 sm:max-w-none'>{badge}</span>
  }

  return (
    <AutoGroupFrame
      effect='ratio'
      shouldReduceMotion={props.shouldReduceMotion ?? false}
      className='max-w-24 sm:max-w-none'
    >
      {badge}
    </AutoGroupFrame>
  )
}

export function AutoGroupBadge(props: AutoGroupFlowBorderProps) {
  return (
    <AutoGroupFrame
      effect='badge'
      shouldReduceMotion={props.shouldReduceMotion}
    >
      <GroupBadge group='auto' />
    </AutoGroupFrame>
  )
}
