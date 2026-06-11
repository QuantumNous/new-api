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
import { BellRing, Fingerprint, Languages, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatCompactNumber, formatQuota } from '@/lib/format'
import { OperationalMetricCard } from '@/components/operational-metric-card'
import type { UserProfile } from '../types'

interface ProfileCommandStripProps {
  profile: UserProfile | null
  loading: boolean
  checkinEnabled: boolean
  canConfigureSidebar: boolean
}

export function ProfileCommandStrip({
  profile,
  loading,
  checkinEnabled,
  canConfigureSidebar,
}: ProfileCommandStripProps) {
  const { t } = useTranslation()

  const displayValue = (value: string | number | null | undefined) => {
    if (loading) return '...'
    if (value == null || value === '') return '—'
    return value
  }

  return (
    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
      <OperationalMetricCard
        label={t('Account state')}
        value={displayValue(profile?.status === 1 ? t('Active') : t('Guarded'))}
        description={t('Identity, group, and role are ready for gateway access.')}
        icon={<ShieldCheck className='size-4' />}
        tone={profile?.status === 1 ? 'success' : 'warning'}
      />
      <OperationalMetricCard
        label={t('Quota runway')}
        value={loading ? '...' : profile ? formatQuota(profile.quota) : '—'}
        description={t('Balance available before requests are throttled.')}
        icon={<BellRing className='size-4' />}
        tone='info'
      />
      <OperationalMetricCard
        label={t('Request trail')}
        value={
          loading ? '...' : profile ? formatCompactNumber(profile.request_count) : '—'
        }
        description={t('Personal usage signal for anomaly review.')}
        icon={<Fingerprint className='size-4' />}
        tone='neutral'
      />
      <OperationalMetricCard
        label={t('Workspace control')}
        value={
          canConfigureSidebar
            ? t('Configurable')
            : checkinEnabled
              ? t('Rewards')
              : t('Locked')
        }
        description={t('Sidebar, language, passkey, and 2FA controls stay nearby.')}
        icon={<Languages className='size-4' />}
        tone={canConfigureSidebar ? 'success' : 'neutral'}
      />
    </div>
  )
}
