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
  ShieldCheck,
  XCircle,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { KidsBadgeState, SkillPlan } from '../types'

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
