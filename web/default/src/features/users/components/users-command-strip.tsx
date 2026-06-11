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
import { ShieldCheck, UserCog, UsersRound, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OperationalMetricCard } from '@/components/operational-metric-card'

export function UsersCommandStrip() {
  const { t } = useTranslation()

  return (
    <section className='grid gap-3 md:grid-cols-4'>
      <OperationalMetricCard
        label={t('Lifecycle')}
        value={t('Managed')}
        description={t('Create, disable, recover, and audit users from one table surface.')}
        icon={<UsersRound className='size-4' aria-hidden='true' />}
        tone='info'
      />
      <OperationalMetricCard
        label={t('Access control')}
        value={t('Roles')}
        description={t('Role and group filters expose who can operate the gateway.')}
        icon={<ShieldCheck className='size-4' aria-hidden='true' />}
        tone='success'
      />
      <OperationalMetricCard
        label={t('Quota risk')}
        value={t('Visible')}
        description={t('Balance, usage, and user state stay scannable during review.')}
        icon={<WalletCards className='size-4' aria-hidden='true' />}
        tone='warning'
      />
      <OperationalMetricCard
        label={t('Admin action')}
        value={t('Fast')}
        description={t('Bulk operations stay close to selection without crowding rows.')}
        icon={<UserCog className='size-4' aria-hidden='true' />}
        tone='neutral'
      />
    </section>
  )
}
