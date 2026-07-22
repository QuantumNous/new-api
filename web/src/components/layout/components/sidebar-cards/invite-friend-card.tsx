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
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { mascotInvite } from '@/assets/mascots'

/**
 * Sidebar invite card — encourages users to share their referral code,
 * decorated with the chibi mascot in the bottom-right corner.
 * Hidden when the sidebar collapses to icon-only mode.
 */
export function InviteFriendCard() {
  const { t } = useTranslation()
  const affCode = useAuthStore((s) => s.auth.user?.aff_code)

  return (
    <Link
      to='/profile'
      aria-label={t('Invite Friends')}
      className='card-glass group-data-[collapsible=icon]:hidden relative block overflow-visible rounded-xl px-3 py-3 transition hover:shadow-[0_4px_18px_var(--ring-glow)]'
    >
      <div className='relative z-10 max-w-[7.5rem]'>
        <div className='text-sm font-semibold leading-snug'>
          {t('Invite Friends')}
        </div>
        <div className='mt-0.5 text-[11px] text-muted-foreground leading-snug'>
          {affCode
            ? t('Earn free quota')
            : t('Set up your referral code')}
        </div>
      </div>
      <img
        src={mascotInvite}
        alt=''
        aria-hidden
        className='pointer-events-none absolute -bottom-4 -right-3 h-24 w-24 object-contain select-none drop-shadow-sm'
        draggable={false}
      />
    </Link>
  )
}
