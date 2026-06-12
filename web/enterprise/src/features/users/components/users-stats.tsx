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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Users,
  Activity,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { User } from '../types'
import { USER_STATUS } from '../constants'

interface UsersStatsProps {
  users: User[]
  total: number
  isLoading: boolean
}

export function UsersStats({ users, total, isLoading }: UsersStatsProps) {
  const { t } = useTranslation()

  const stats = useMemo(() => {
    if (!users.length && !total) {
      return {
        total: 0,
        active: 0,
        newToday: 0,
        totalBalance: 0,
      }
    }

    const active = users.filter(
      (u) => u.status === USER_STATUS.ENABLED
    ).length
    const disabled = users.filter(
      (u) => u.status === USER_STATUS.DISABLED
    ).length
    const totalBalance = users.reduce((sum, u) => sum + (u.quota || 0), 0)

    return {
      total,
      active,
      disabled,
      totalBalance,
    }
  }, [users, total])

  const cards = [
    {
      label: t('Total Users'),
      value: stats.total,
      icon: Users,
      tone: 'blue' as const,
      sub: null,
    },
    {
      label: t('Active'),
      value: stats.active,
      icon: Activity,
      tone: 'green' as const,
      sub:
        total > 0
          ? `${((stats.active / total) * 100).toFixed(1)}% ${t('active')}`
          : null,
    },
    {
      label: t('Disabled'),
      value: stats.disabled,
      icon: UserPlus,
      tone: 'amber' as const,
      sub: null,
    },
    {
      label: t('Total Balance'),
      value: stats.totalBalance,
      icon: Wallet,
      tone: 'blue' as const,
      sub: null,
    },
  ]

  if (isLoading) {
    return (
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className='rounded-lg border border-border bg-card p-5'
          >
            <Skeleton className='mb-3 h-8 w-8 rounded-sm' />
            <Skeleton className='mb-2 h-4 w-20' />
            <Skeleton className='h-8 w-16' />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {cards.map((card) => {
        const Icon = card.icon
        const toneClasses = {
          blue: 'bg-primary/[0.08] text-primary',
          green: 'bg-success/[0.08] text-success',
          amber: 'bg-warning/[0.08] text-warning',
          red: 'bg-destructive/[0.08] text-destructive',
        }
        return (
          <div
            key={card.label}
            className='rounded-lg border border-border bg-card p-5'
          >
            <div
              className={`mb-3 flex h-8 w-8 items-center justify-center rounded-md ${toneClasses[card.tone]}`}
            >
              <Icon className='size-[18px]' strokeWidth={2} />
            </div>
            <div className='text-sm text-muted-foreground'>
              {card.label}
            </div>
            <div className='font-mono text-2xl font-semibold tracking-tight text-foreground'>
              {card.value}
            </div>
            {card.sub && (
              <div className='mt-1 text-[11px] text-muted-foreground'>
                {card.sub}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
