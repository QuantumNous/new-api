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

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import {
  PLUGIN_KIND_LABELS,
  PLUGIN_KINDS,
  type PluginKind,
} from '../lib/plugin-kinds'

type PluginKindSwitchProps = {
  value: PluginKind
  counts: Record<PluginKind, number>
  onValueChange: (kind: PluginKind) => void
}

/** A segmented switch: the chosen item is raised on a muted track. */
export const SEGMENTED_SWITCH_CLASS =
  'bg-muted h-8 max-w-full shrink-0 overflow-x-auto rounded-lg p-[3px]'
export const SEGMENTED_SWITCH_ITEM_CLASS =
  'text-muted-foreground hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground dark:aria-pressed:bg-input/40 h-full gap-1.5 rounded-md px-2.5 hover:bg-transparent aria-pressed:shadow-sm'

/** Task / Provider / Request processing, each with its plugin count. */
export function PluginKindSwitch(props: PluginKindSwitchProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  return (
    <ToggleGroup
      value={[props.value]}
      onValueChange={(value) => {
        const next = PLUGIN_KINDS.find(
          (kind) => kind !== props.value && value.includes(kind)
        )
        if (next) props.onValueChange(next)
      }}
      aria-label={t('Plugin kind')}
      spacing={1}
      className={SEGMENTED_SWITCH_CLASS}
    >
      {PLUGIN_KINDS.map((kind) => (
        <ToggleGroupItem
          key={kind}
          value={kind}
          className={SEGMENTED_SWITCH_ITEM_CLASS}
        >
          {t(PLUGIN_KIND_LABELS[kind])}{' '}
          <span className='bg-foreground/[0.06] group-aria-pressed/toggle:bg-primary/10 group-aria-pressed/toggle:text-primary min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums'>
            {formatNumber(props.counts[kind], locale)}
          </span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
