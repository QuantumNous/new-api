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
import { ChevronDown, Globe, Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  usePluginSiteStore,
  type PluginSiteChoice,
} from '@/stores/plugin-site-store'

import { followsPluginSite } from '../lib/plugin-site'
import type { MarketplaceSource } from '../types'

type MarketplaceSourceMenuProps = {
  /** The lists of the chosen market (official or community). */
  sources: MarketplaceSource[]
  selected: MarketplaceSource
  onSelect: (source: MarketplaceSource) => void
  onManage: () => void
}

type SourceChoice = {
  value: string
  label: string
  source: MarketplaceSource
  site?: PluginSiteChoice
}

/**
 * Where plugins are downloaded from: the main site www.newapi.ai, the backup
 * site www.newapi.pro, or another list such as GitHub. Managing the lists sits
 * at the bottom.
 */
export function MarketplaceSourceMenu(props: MarketplaceSourceMenuProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const site = usePluginSiteStore((state) => state.site)
  const setSite = usePluginSiteStore((state) => state.setSite)
  const siteSources = props.sources.filter((source) =>
    followsPluginSite(source.index_url)
  )
  const choices = props.sources.flatMap((source): SourceChoice[] => {
    if (!followsPluginSite(source.index_url)) {
      return [{ value: source.index_url, label: t(source.name), source }]
    }
    // Two lists on www.newapi.ai would read the same without their names.
    const prefix = siteSources.length > 1 ? `${t(source.name)} · ` : ''
    return [
      {
        value: `${source.index_url}|ai`,
        label: prefix + t('Main site ({{site}})', { site: 'www.newapi.ai' }),
        source,
        site: 'ai',
      },
      {
        value: `${source.index_url}|pro`,
        label: prefix + t('Backup site ({{site}})', { site: 'www.newapi.pro' }),
        source,
        site: 'pro',
      },
    ]
  })
  const current = followsPluginSite(props.selected.index_url)
    ? `${props.selected.index_url}|${site}`
    : props.selected.index_url
  const currentLabel =
    choices.find((choice) => choice.value === current)?.label ??
    t(props.selected.name)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant='outline'
            size='sm'
            aria-label={t('Plugin download site')}
            className='max-w-full'
          />
        }
      >
        <Globe aria-hidden='true' />
        <span className='truncate'>{currentLabel}</span>
        <ChevronDown aria-hidden='true' className='text-muted-foreground' />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-auto min-w-56'>
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) => {
            const choice = choices.find((item) => item.value === value)
            if (!choice) return
            if (choice.site) {
              setSite(choice.site)
              void queryClient.invalidateQueries({
                queryKey: ['task-plugin-marketplace'],
              })
            }
            if (choice.source.index_url !== props.selected.index_url) {
              props.onSelect(choice.source)
            }
          }}
        >
          {choices.map((choice) => (
            <DropdownMenuRadioItem
              closeOnClick
              key={choice.value}
              value={choice.value}
            >
              {choice.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={props.onManage}>
          <Settings2 aria-hidden='true' />
          {t('Manage sources')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
