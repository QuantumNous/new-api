import {
  CalendarClock,
  FileText,
  Layers,
  Maximize2,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  formatTokenCount,
  formatYearMonth,
  type ModelMetadata,
} from '../lib/model-metadata'
import type { Modality } from '../types'
import { ModalityIcons } from './model-details-modalities'

type QuickStatsProps = {
  metadata: ModelMetadata
}

type Stat = {
  key: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  hint?: string
}

function buildStats(
  metadata: ModelMetadata,
  t: (key: string) => string
): Stat[] {
  const stats: Stat[] = [
    {
      key: 'context',
      icon: Layers,
      label: t('Context'),
      value: formatTokenCount(metadata.context_length),
      hint: t('Maximum input window'),
    },
  ]

  if (metadata.max_output_tokens > 0) {
    stats.push({
      key: 'max-output',
      icon: Maximize2,
      label: t('Max output'),
      value: formatTokenCount(metadata.max_output_tokens),
      hint: t('Maximum tokens per response'),
    })
  }

  stats.push({
    key: 'modalities',
    icon: FileText,
    label: t('Modalities'),
    value: (
      <ModalityFlow
        input={metadata.input_modalities}
        output={metadata.output_modalities}
      />
    ),
  })

  if (metadata.knowledge_cutoff) {
    stats.push({
      key: 'knowledge',
      icon: Sparkles,
      label: t('Knowledge cutoff'),
      value: formatYearMonth(metadata.knowledge_cutoff),
    })
  }

  if (metadata.release_date) {
    stats.push({
      key: 'release',
      icon: CalendarClock,
      label: t('Released'),
      value: formatYearMonth(metadata.release_date),
    })
  }

  return stats
}

function ModalityFlow(props: { input: Modality[]; output: Modality[] }) {
  return (
    <span className='inline-flex items-center gap-1 align-middle'>
      <ModalityIcons modalities={props.input} className='size-3.5' />
      <span className='text-muted-foreground/40'>→</span>
      <ModalityIcons modalities={props.output} className='size-3.5' />
    </span>
  )
}

export function ModelDetailsQuickStats(props: QuickStatsProps) {
  const { t } = useTranslation()
  const stats = buildStats(props.metadata, t)

  return (
    <div className='bg-muted/20 grid grid-cols-2 gap-px overflow-hidden rounded-lg border @md/details:grid-cols-3 @2xl/details:grid-cols-5'>
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div
            key={stat.key}
            className={cn(
              'bg-background flex min-w-0 flex-col gap-0.5 px-3 py-2.5'
            )}
          >
            <span className='text-muted-foreground inline-flex min-w-0 items-center gap-1 text-[10px] font-medium tracking-wider uppercase'>
              <Icon className='size-3 shrink-0' />
              <span className='truncate'>{stat.label}</span>
            </span>
            <span className='text-foreground truncate text-sm font-semibold tabular-nums'>
              {stat.value}
            </span>
            {stat.hint && (
              <span className='text-muted-foreground/60 truncate text-[10px]'>
                {stat.hint}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
