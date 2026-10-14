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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { getChannelOps } from '@/features/channels/api'
import { ROLE } from '@/lib/roles'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { policyLabel } from './policy-label'

export function RelatedPolicyLink(props: { section: 'routing' | 'health' }) {
  const { t } = useTranslation()
  const isRoot = useAuthStore(
    (state) => state.auth.user?.role === ROLE.SUPER_ADMIN
  )
  if (!isRoot) return null
  return (
    <Link
      className='text-primary ml-1 underline underline-offset-4'
      to='/system-settings/request-policies/$section'
      params={{ section: props.section }}
    >
      {t('Request policies')}
    </Link>
  )
}

export function ChannelHealthSource(props: { autoBan: boolean }) {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['channel-ops', { autoBan: props.autoBan }],
    queryFn: async () =>
      requireServerSuccess(await getChannelOps(props.autoBan)),
    retry: false,
    staleTime: 60000,
    meta: { errorToast: false },
  })
  const policy = query.data?.data?.request_policy
  return (
    <>
      {policy ? (
        <span>
          {policy.automatic_disable
            ? t('Auto-disable enabled')
            : t('Auto-disable disabled')}{' '}
          · {t('Source')}: {policyLabel(t, policy.source)}
        </span>
      ) : (
        t('Requires global auto-disable and this channel option.')
      )}
      <RelatedPolicyLink section='health' />
    </>
  )
}
