import {
  BookOpenCheck,
  Braces,
  Code2,
  Database,
  FileCode,
  Globe,
  type LucideIcon,
  PanelTopOpen,
  ScanEye,
  Settings2,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { ModelCapability } from '../types'

type CapabilityMeta = {
  icon: LucideIcon
  labelKey: string
  descriptionKey: string
}

const CAPABILITY_META: Record<ModelCapability, CapabilityMeta> = {
  function_calling: {
    icon: Workflow,
    labelKey: 'Function calling',
    descriptionKey:
      'Invoke developer-defined functions with structured arguments',
  },
  streaming: {
    icon: Zap,
    labelKey: 'Streaming',
    descriptionKey: 'Stream tokens incrementally as they are generated',
  },
  vision: {
    icon: ScanEye,
    labelKey: 'Vision',
    descriptionKey: 'Understand image inputs alongside text',
  },
  json_mode: {
    icon: Braces,
    labelKey: 'JSON mode',
    descriptionKey: 'Force a syntactically valid JSON response',
  },
  structured_output: {
    icon: FileCode,
    labelKey: 'Structured output',
    descriptionKey: 'Return data conforming to a JSON schema',
  },
  reasoning: {
    icon: Sparkles,
    labelKey: 'Reasoning',
    descriptionKey: 'Multi-step thinking before final answer',
  },
  tools: {
    icon: Settings2,
    labelKey: 'Tools',
    descriptionKey: 'Use external tools to extend capabilities',
  },
  system_prompt: {
    icon: PanelTopOpen,
    labelKey: 'System prompt',
    descriptionKey: 'Steer behaviour with a system instruction',
  },
  web_search: {
    icon: Globe,
    labelKey: 'Web search',
    descriptionKey: 'Search the public web at inference time',
  },
  code_interpreter: {
    icon: Code2,
    labelKey: 'Code interpreter',
    descriptionKey: 'Execute code in a sandbox during the response',
  },
  caching: {
    icon: Database,
    labelKey: 'Prompt caching',
    descriptionKey: 'Cache repeated prompt prefixes for cheaper, faster reuse',
  },
  embeddings: {
    icon: BookOpenCheck,
    labelKey: 'Embeddings',
    descriptionKey: 'Return vector embeddings for inputs',
  },
}

/**
 * Order capabilities for display. We put the most user-facing capabilities
 * first, then the rest. Anything not listed sinks to the bottom in a stable
 * order so the layout looks tidy across models.
 */
const CAPABILITY_ORDER: ModelCapability[] = [
  'streaming',
  'function_calling',
  'tools',
  'json_mode',
  'structured_output',
  'vision',
  'reasoning',
  'caching',
  'system_prompt',
  'web_search',
  'code_interpreter',
  'embeddings',
]

function orderCapabilities(capabilities: ModelCapability[]): ModelCapability[] {
  const set = new Set(capabilities)
  const ordered = CAPABILITY_ORDER.filter((c) => set.has(c))
  for (const c of capabilities) {
    if (!ordered.includes(c)) ordered.push(c)
  }
  return ordered
}

export function ModelDetailsCapabilities(props: {
  capabilities: ModelCapability[]
}) {
  const { t } = useTranslation()
  const ordered = orderCapabilities(props.capabilities)

  if (ordered.length === 0) {
    return (
      <p className='text-muted-foreground text-sm'>
        {t('No capabilities reported for this model.')}
      </p>
    )
  }

  return (
    <div className='grid grid-cols-2 gap-2 @md/details:grid-cols-3 @2xl/details:grid-cols-4'>
      {ordered.map((capability) => {
        const meta = CAPABILITY_META[capability]
        if (!meta) return null
        const Icon = meta.icon
        return (
          <div
            key={capability}
            className={cn(
              'group flex items-start gap-2 rounded-lg border p-3 transition-colors',
              'hover:bg-muted/30'
            )}
          >
            <span className='bg-muted text-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors group-hover:bg-emerald-100 group-hover:text-emerald-700 dark:group-hover:bg-emerald-500/20 dark:group-hover:text-emerald-300'>
              <Icon className='size-3.5' />
            </span>
            <div className='min-w-0 flex-1'>
              <div className='text-foreground truncate text-xs font-semibold'>
                {t(meta.labelKey)}
              </div>
              <p className='text-muted-foreground mt-0.5 line-clamp-2 text-[11px] leading-snug'>
                {t(meta.descriptionKey)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
