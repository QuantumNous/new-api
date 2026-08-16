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

import { StatusBadge, type StatusVariant } from '@/components/status-badge'

import type {
  ChannelContributionRevisionStatus,
  ChannelContributionStatus,
  ChannelContributionTestRunStatus,
} from '../types'

const contributionStatusMeta: Record<
  ChannelContributionStatus,
  { label: string; variant: StatusVariant }
> = {
  draft: { label: 'Draft', variant: 'neutral' },
  pending: { label: 'Pending review', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Review rejected', variant: 'danger' },
  unavailable: { label: 'Unavailable', variant: 'danger' },
  deleted: { label: 'Deleted', variant: 'danger' },
}

const testRunStatusMeta: Record<
  ChannelContributionTestRunStatus,
  { label: string; variant: StatusVariant }
> = {
  queued: { label: 'Queued', variant: 'info' },
  running: { label: 'Testing...', variant: 'info' },
  succeeded: { label: 'All tests passed', variant: 'success' },
  passed: { label: 'All tests passed', variant: 'success' },
  failed: { label: 'Tests failed', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
  stale: { label: 'Test expired', variant: 'warning' },
}

const contributionRevisionStatusMeta: Record<
  Extract<ChannelContributionRevisionStatus, 'draft' | 'pending' | 'rejected'>,
  { label: string; variant: StatusVariant }
> = {
  draft: { label: 'Draft', variant: 'neutral' },
  pending: { label: 'Pending review', variant: 'warning' },
  rejected: { label: 'Review rejected', variant: 'danger' },
}

export function ContributionStatusBadge(props: {
  status: ChannelContributionStatus
}) {
  const { t } = useTranslation()
  const meta = contributionStatusMeta[props.status]
  return (
    <StatusBadge
      label={t(meta.label)}
      variant={meta.variant}
      copyable={false}
      showDot
    />
  )
}

export function ContributionRevisionStatusBadge(props: {
  status: Extract<
    ChannelContributionRevisionStatus,
    'draft' | 'pending' | 'rejected'
  >
}) {
  const { t } = useTranslation()
  const meta = contributionRevisionStatusMeta[props.status]
  return (
    <StatusBadge
      label={t(meta.label)}
      variant={meta.variant}
      copyable={false}
      showDot
    />
  )
}

export function ContributionTestRunStatusBadge(props: {
  status: ChannelContributionTestRunStatus
}) {
  const { t } = useTranslation()
  const meta = testRunStatusMeta[props.status]
  return (
    <StatusBadge
      label={t(meta.label)}
      variant={meta.variant}
      copyable={false}
      pulse={props.status === 'running' || props.status === 'queued'}
      showDot
    />
  )
}
