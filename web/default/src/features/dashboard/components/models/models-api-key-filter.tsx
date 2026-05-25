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
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Combobox } from '@/components/ui/combobox'
import type { DashboardFilters } from '@/features/dashboard/types'
import { getApiKeyOptions } from '@/features/keys/api'
import { API_KEY_STATUSES } from '@/features/keys/constants'

interface ModelsApiKeyFilterProps {
  className?: string
  filters: DashboardFilters
  onFilterChange: (filters: DashboardFilters) => void
}

export function ModelsApiKeyFilter(props: ModelsApiKeyFilterProps) {
  const { className, filters, onFilterChange } = props
  const { t } = useTranslation()

  const tokenOptionsQuery = useQuery({
    queryKey: ['dashboard', 'api-key-options'],
    queryFn: async () => {
      const result = await getApiKeyOptions()
      if (!result.success) {
        throw new Error(result.message || t('Failed to load API keys'))
      }
      return result.data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  const apiKeyOptions = tokenOptionsQuery.data ?? []
  const apiKeySelectOptions = useMemo(
    () => [
      { value: 'all', label: t('All API Keys') },
      ...apiKeyOptions.map((apiKey) => {
        const status = API_KEY_STATUSES[apiKey.status]
        const statusLabel = status ? t(status.label) : String(apiKey.status)
        return {
          value: String(apiKey.id),
          label: `${apiKey.name} · ${apiKey.key} · ${statusLabel}`,
        }
      }),
    ],
    [apiKeyOptions, t]
  )

  const handleTokenChange = (value: string | null) => {
    if (!value || value === 'all') {
      onFilterChange({
        ...filters,
        token_id: undefined,
        token_name: undefined,
      })
      return
    }

    const tokenId = Number(value)
    const token = apiKeyOptions.find((item) => item.id === tokenId)
    onFilterChange({
      ...filters,
      token_id: Number.isFinite(tokenId) ? tokenId : undefined,
      token_name: token?.name,
    })
  }

  return (
    <div className={cn('relative min-w-0 max-sm:flex-1 sm:w-72', className)}>
      <KeyRound className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 z-1 h-4 w-4 -translate-y-1/2' />
      <Combobox
        id='dashboard_api_key_filter'
        options={apiKeySelectOptions}
        value={filters.token_id ? String(filters.token_id) : 'all'}
        onValueChange={handleTokenChange}
        placeholder={
          tokenOptionsQuery.isLoading
            ? t('Loading API keys...')
            : t('Select API key')
        }
        emptyText='No API keys found'
        className='pl-8'
      />
    </div>
  )
}
