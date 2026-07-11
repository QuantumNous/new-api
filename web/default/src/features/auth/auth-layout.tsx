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

import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  return (
    <div className='auth-page'>
      <div className='auth-card'>
        <Link to='/' className='auth-brand'>
          {loading ? (
            <Skeleton className='auth-brand-logo' />
          ) : (
            <img
              src={logo}
              alt={t('Logo')}
              className='auth-brand-logo'
            />
          )}
          {loading ? (
            <Skeleton className='h-5 w-24' />
          ) : (
            <span className='auth-brand-name'>{systemName}</span>
          )}
        </Link>
        {children}
      </div>
    </div>
  )
}
