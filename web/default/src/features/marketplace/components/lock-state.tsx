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
import { AlertTriangle, LockKeyhole, RefreshCcw, ShieldOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { LockStateKind } from './lock-state-utils'

interface LockStateProps {
  state: LockStateKind
  className?: string
}

const lockStateIcon = {
  plan_required: LockKeyhole,
  subscription_inactive: RefreshCcw,
  quota_exceeded: AlertTriangle,
  kids_blocked: ShieldOff,
  unavailable: AlertTriangle,
} satisfies Record<LockStateKind, typeof LockKeyhole>

const lockStateLabel = {
  plan_required: 'Plan required',
  subscription_inactive: 'Subscription inactive',
  quota_exceeded: 'Quota exceeded',
  kids_blocked: 'Blocked in Kids Mode',
  unavailable: 'Unavailable',
} satisfies Record<LockStateKind, string>

export function LockState({ state, className }: LockStateProps) {
  const { t } = useTranslation()
  const Icon = lockStateIcon[state]

  return (
    <div
      className={cn(
        'text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs',
        className
      )}
      aria-label={t('Locked: {{reason}}', {
        reason: t(lockStateLabel[state]),
      })}
    >
      <Icon className='size-3.5 shrink-0' aria-hidden='true' />
      <span className='truncate'>{t(lockStateLabel[state])}</span>
    </div>
  )
}
