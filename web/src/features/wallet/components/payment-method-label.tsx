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

import { getPaymentMethodName } from '@/features/wallet/lib/billing'
import {
  getPaymentBrandClassName,
  getPaymentIcon,
} from '@/features/wallet/lib/ui'
import { cn } from '@/lib/utils'

export function PaymentMethodLabel(props: {
  method: string
  name?: string
  icon?: string
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'text-foreground inline-flex items-center gap-1.5 align-middle',
        getPaymentBrandClassName(props.method),
        props.className
      )}
    >
      <span aria-hidden='true' className='inline-flex shrink-0'>
        {getPaymentIcon(props.method, 'size-4', props.icon, props.name)}
      </span>
      <span>{props.name ?? getPaymentMethodName(props.method, t)}</span>
    </span>
  )
}
