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
  monochrome?: boolean
}) {
  const { t } = useTranslation()
  if (props.method === 'antom') {
    return (
      <img
        src='/antom-logo.svg'
        alt='Antom'
        width={87}
        height={36}
        className={cn(
          'inline-block h-7 w-auto shrink-0 bg-transparent object-contain align-middle',
          props.className
        )}
      />
    )
  }
  return (
    <span
      className={cn(
        'text-foreground inline-flex items-center gap-1.5 align-middle',
        props.monochrome
          ? 'text-inherit'
          : getPaymentBrandClassName(props.method),
        props.className
      )}
    >
      <span
        aria-hidden='true'
        className={cn(
          'inline-flex shrink-0',
          props.monochrome &&
            props.method !== 'mixpay' &&
            props.method !== 'webmoney' &&
            'brightness-0 invert'
        )}
      >
        {getPaymentIcon(props.method, 'size-4', props.icon, props.name)}
      </span>
      <span>{props.name ?? getPaymentMethodName(props.method, t)}</span>
    </span>
  )
}
