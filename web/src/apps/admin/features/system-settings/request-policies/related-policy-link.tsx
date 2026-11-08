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
/**
 * Channel health source label plus the link to the related request policy.
 *
 * The link itself is shared with the client portal; reading channel operations
 * is admin-only, so this module keeps only the admin-specific half.
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { RelatedPolicyLink } from '@/shared/features/request-policies/related-policy-link'

export { RelatedPolicyLink }

import { getChannelOps } from '@/apps/admin/features/channels/api'
import { policyLabel } from '@/shared/features/request-policies/policy-label'
import { requireServerSuccess } from '@/shared/lib/server-error-message'

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
