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
import {
  FileText,
  Image as ImageIcon,
  Mic2,
  Type as TypeIcon,
  Video,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Modality } from '../types'

type IconComponent = React.ComponentType<{ className?: string }>

const MODALITY_META: Record<
  Modality,
  { icon: IconComponent; labelKey: string }
> = {
  text: { icon: TypeIcon, labelKey: 'Text' },
  image: { icon: ImageIcon, labelKey: 'Image' },
  audio: { icon: Mic2, labelKey: 'Audio' },
  video: { icon: Video, labelKey: 'Video' },
  file: { icon: FileText, labelKey: 'File' },
}

const ALL_MODALITIES: Modality[] = ['text', 'image', 'audio', 'video', 'file']

/** Inline modality icons (used by the quick-stats flow). */
export function ModalityIcons(props: {
  modalities: Modality[]
  className?: string
}) {
  const { t } = useTranslation()
  if (props.modalities.length === 0) {
    return <span className='text-muted-foreground text-xs'>—</span>
  }
  return (
    <span className='inline-flex items-center gap-1'>
      {props.modalities.map((modality) => {
        const meta = MODALITY_META[modality]
        const Icon = meta.icon
        return (
          <Tooltip key={modality}>
            <TooltipTrigger
              render={
                <span
                  aria-label={t(meta.labelKey)}
                  className='text-foreground/80 inline-flex'
                />
              }
            >
              <Icon className={cn('size-3.5', props.className)} />
            </TooltipTrigger>
            <TooltipContent side='top' className='text-xs'>
              {t(meta.labelKey)}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </span>
  )
}

/**
 * 2 × N matrix showing which modalities are supported as input vs output.
 * Cells with a checkmark indicate support; empty cells show a dash.
 */
export function ModalitiesMatrix(props: {
  input: Modality[]
  output: Modality[]
}) {
  const { t } = useTranslation()
  const inputSet = new Set(props.input)
  const outputSet = new Set(props.output)

  const renderRow = (label: string, set: Set<Modality>) => (
    <tr>
      <th
        scope='row'
        className='text-muted-foreground bg-muted/30 px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase'
      >
        {label}
      </th>
      {ALL_MODALITIES.map((modality) => {
        const enabled = set.has(modality)
        const Icon = MODALITY_META[modality].icon
        return (
          <td
            key={modality}
            className={cn(
              'border-l px-3 py-2 text-center',
              enabled
                ? 'bg-emerald-50/40 dark:bg-emerald-500/10'
                : 'bg-background'
            )}
          >
            <span
              className={cn(
                'inline-flex items-center justify-center',
                enabled
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-muted-foreground/40'
              )}
              aria-label={
                enabled
                  ? t('{{modality}} supported', {
                      modality: t(MODALITY_META[modality].labelKey),
                    })
                  : t('{{modality}} not supported', {
                      modality: t(MODALITY_META[modality].labelKey),
                    })
              }
            >
              <Icon className='size-4' />
            </span>
          </td>
        )
      })}
    </tr>
  )

  return (
    <div className='overflow-x-auto rounded-lg border'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='bg-muted/40'>
            <th
              scope='col'
              className='text-muted-foreground px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase'
            >
              {t('Modality')}
            </th>
            {ALL_MODALITIES.map((modality) => (
              <th
                key={modality}
                scope='col'
                className='text-muted-foreground border-l px-3 py-2 text-center text-[11px] font-medium tracking-wider uppercase'
              >
                {t(MODALITY_META[modality].labelKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {renderRow(t('Input'), inputSet)}
          {renderRow(t('Output'), outputSet)}
        </tbody>
      </table>
    </div>
  )
}
