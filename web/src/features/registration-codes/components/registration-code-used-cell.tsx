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
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'

import { REGISTRATION_CODE_STATUS } from '../constants'
import type { RegistrationCode } from '../types'

type RegistrationCodeUsedCellProps = {
  registrationCode: RegistrationCode
}

export function RegistrationCodeUsedCell(props: RegistrationCodeUsedCellProps) {
  const { t } = useTranslation()
  const registrationCode = props.registrationCode

  if (registrationCode.status !== REGISTRATION_CODE_STATUS.USED) {
    return <span className='text-muted-foreground text-sm'>{t('Unused')}</span>
  }

  const username = registrationCode.used_username ?? ''

  // User may have been deleted; fall back to the numeric user ID
  if (!username) {
    return (
      <span className='text-muted-foreground text-sm'>
        {t('User {{id}}', { id: registrationCode.used_user_id })}
      </span>
    )
  }

  return (
    <div className='flex items-center gap-1.5'>
      <Avatar className='ring-border/60 size-6 ring-1'>
        <AvatarFallback
          className='text-[11px] font-semibold'
          style={getUserAvatarStyle(username)}
        >
          {getUserAvatarFallback(username)}
        </AvatarFallback>
      </Avatar>
      <span className='text-muted-foreground max-w-[100px] truncate text-sm'>
        {username}
      </span>
    </div>
  )
}
