import { Route } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { StatusBadge } from '@/components/status-badge'

interface ModelBadgeProps {
  modelName: string
  actualModel?: string
  className?: string
}

interface ModelProvider {
  icon: string
  label: string
}

function resolveModelProvider(modelName: string): ModelProvider | null {
  const model = modelName.toLowerCase()
  const hasAny = (keywords: string[]) =>
    keywords.some((keyword) => model.includes(keyword))

  if (
    hasAny([
      'gpt-',
      'chatgpt-',
      'text-embedding-',
      'omni-moderation',
      'dall-e',
      'whisper',
      'tts-',
    ]) ||
    /\bo[134](?:-|$)/.test(model)
  ) {
    return { icon: 'OpenAI.Color', label: 'OpenAI' }
  }
  if (hasAny(['claude-', 'anthropic'])) {
    return { icon: 'Claude.Color', label: 'Claude' }
  }
  if (hasAny(['gemini-', 'learnlm-'])) {
    return { icon: 'Gemini.Color', label: 'Gemini' }
  }
  if (hasAny(['grok-', 'xai-'])) {
    return { icon: 'Grok.Color', label: 'Grok' }
  }
  if (hasAny(['deepseek-'])) {
    return { icon: 'DeepSeek.Color', label: 'DeepSeek' }
  }
  if (hasAny(['qwen', 'qwq-'])) {
    return { icon: 'Qwen.Color', label: 'Qwen' }
  }
  if (hasAny(['doubao-', 'volcengine'])) {
    return { icon: 'Doubao.Color', label: 'Doubao' }
  }
  if (hasAny(['moonshot-', 'kimi-'])) {
    return { icon: 'Moonshot.Color', label: 'Moonshot' }
  }
  if (hasAny(['mistral-', 'mixtral-'])) {
    return { icon: 'Mistral.Color', label: 'Mistral' }
  }
  if (hasAny(['llama-', 'meta-'])) {
    return { icon: 'Meta.Color', label: 'Meta' }
  }
  if (hasAny(['command-', 'cohere-'])) {
    return { icon: 'Cohere.Color', label: 'Cohere' }
  }

  return null
}

function ModelBadgeContent(props: ModelBadgeProps) {
  const provider = resolveModelProvider(props.modelName)

  return (
    <StatusBadge
      copyText={props.modelName}
      size='sm'
      showDot={!provider}
      autoColor={provider ? undefined : props.modelName}
      className={cn(
        'rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 font-mono',
        provider && 'text-foreground',
        props.className
      )}
    >
      <span className='flex items-center gap-1.5'>
        {provider && (
          <span
            className='flex size-3.5 shrink-0 items-center justify-center'
            title={provider.label}
            aria-label={provider.label}
          >
            {getLobeIcon(provider.icon, 14)}
          </span>
        )}
        <span>{props.modelName}</span>
      </span>
    </StatusBadge>
  )
}

export function ModelBadge(props: ModelBadgeProps) {
  const { t } = useTranslation()

  if (!props.actualModel) {
    return <ModelBadgeContent {...props} />
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type='button' className='inline-flex items-center gap-1'>
          <ModelBadgeContent {...props} />
          <Route className='text-muted-foreground size-3 shrink-0' />
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-72'>
        <div className='space-y-2'>
          <div className='flex items-start justify-between gap-3'>
            <span className='text-muted-foreground text-xs'>
              {t('Request Model:')}
            </span>
            <span className='truncate font-mono text-xs font-medium'>
              {props.modelName}
            </span>
          </div>
          <div className='flex items-start justify-between gap-3'>
            <span className='text-muted-foreground text-xs'>
              {t('Actual Model:')}
            </span>
            <span className='truncate font-mono text-xs font-medium'>
              {props.actualModel}
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
