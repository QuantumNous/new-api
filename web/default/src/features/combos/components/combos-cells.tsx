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
import type { Combo } from '../types'

export function StrategyCell({ combo }: { combo: Combo }) {
  const { t } = useTranslation()
  const strategyMap: Record<string, string> = {
    fallback: t('Fallback'),
    random: t('Random'),
    weighted: t('Weighted'),
    round_robin: t('Round Robin'),
  }
  const label = strategyMap[combo.strategy] || combo.strategy
  return (
    <span className='inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium'>
      {label}
    </span>
  )
}

export function StatusCell({ combo }: { combo: Combo }) {
  const { t } = useTranslation() 
  const enabled = combo.status === 1
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${
        enabled
          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300'
          : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
      }`}
    >
      {enabled ? t('Enabled') : t('Disabled')}
    </span>
  )
}
