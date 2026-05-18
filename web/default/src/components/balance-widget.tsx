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
import { Link } from '@tanstack/react-router'
import { Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

interface BalanceWidgetProps {
  className?: string
}

/**
 * Top-bar balance chip — onboarding-v2 §5.2 wants the user's current
 * balance visible from every authenticated page so they never have to
 * dig for it. Clicking takes them to /wallet to top up.
 *
 * Reads quota from auth-store (kept fresh by the /api/user/self call in
 * the _authenticated route loader). No standalone polling here.
 */
export function BalanceWidget({ className }: BalanceWidgetProps) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  if (!user) return null
  const quota = user.quota ?? 0
  return (
    <Link
      to='/wallet'
      title={t('Go to wallet')}
      className={cn(
        'border-border bg-card hover:bg-accent flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
        className
      )}
    >
      <Wallet className='text-muted-foreground h-3.5 w-3.5' />
      <span className='font-medium tabular-nums'>{formatQuota(quota)}</span>
    </Link>
  )
}
