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

import { StatusBadge } from '@/components/status-badge'

import type { SiteOrder } from './api'

export function OrderStatus(props: { order: SiteOrder }) {
  const { t } = useTranslation()
  const labels: Record<string, string> = {
    pending: t('Awaiting payment'),
    paid: t('Paid, awaiting credit'),
    success: t('Completed'),
    expired: t('Closed'),
    failed: t('Failed'),
  }
  if (
    props.order.order_status === 'pending' &&
    (props.order.cancel_requested || props.order.close_requested_at)
  ) {
    labels.pending = t('Closing order')
  }
  let variant: 'success' | 'warning' | 'danger' = 'warning'
  if (props.order.order_status === 'success') variant = 'success'
  if (props.order.order_status === 'failed') variant = 'danger'
  return (
    <div className='flex flex-wrap gap-1'>
      <StatusBadge
        label={labels[props.order.order_status] ?? props.order.order_status}
        variant={variant}
        copyable={false}
      />
      {props.order.cache_pending && (
        <StatusBadge
          label={t('Balance sync pending')}
          variant='warning'
          copyable={false}
        />
      )}
      {(props.order.last_error || props.order.review_required) && (
        <StatusBadge
          label={t('Payment requires attention')}
          variant='danger'
          copyable={false}
        />
      )}
    </div>
  )
}
