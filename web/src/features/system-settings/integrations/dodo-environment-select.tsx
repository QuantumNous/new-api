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

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { DodoEnvironment } from '../types'

type DodoEnvironmentSelectProps = {
  value: DodoEnvironment
  onValueChange: (value: DodoEnvironment) => void
}

export function DodoEnvironmentSelect(props: DodoEnvironmentSelectProps) {
  const { t } = useTranslation()
  const items = [
    { value: 'test_mode' as const, label: t('Test mode') },
    { value: 'live_mode' as const, label: t('Live mode') },
  ]

  return (
    <Select
      items={items}
      value={props.value}
      onValueChange={(value) => value && props.onValueChange(value)}
    >
      <SelectTrigger className='w-full' aria-label={t('Dodo environment')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
