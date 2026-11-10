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
import { useQueryClient } from '@tanstack/react-query'
import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  usePluginSiteStore,
  type PluginSiteChoice,
} from '@/stores/plugin-site-store'

/** Picks the site this browser downloads plugins from. */
export function PluginSiteSelect() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const site = usePluginSiteStore((state) => state.site)
  const fallbackUntil = usePluginSiteStore((state) => state.fallbackUntil)
  const setSite = usePluginSiteStore((state) => state.setSite)
  // "Auto" names the site it is using right now.
  const autoSite =
    fallbackUntil > Date.now() ? 'www.newapi.pro' : 'www.newapi.ai'
  const items: { value: PluginSiteChoice; label: string }[] = [
    { value: 'auto', label: t('Auto ({{site}})', { site: autoSite }) },
    {
      value: 'pro',
      label: t('Mainland China ({{site}})', { site: 'www.newapi.pro' }),
    },
  ]

  return (
    <Select
      value={site}
      items={items}
      onValueChange={(value) => {
        const next = items.find((item) => item.value === value)
        if (!next) return
        setSite(next.value)
        void queryClient.invalidateQueries({
          queryKey: ['task-plugin-marketplace'],
        })
      }}
    >
      <SelectTrigger size='sm' aria-label={t('Plugin download site')}>
        <Globe />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
