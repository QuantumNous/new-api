import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Copy, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/status-badge'

const MODEL_CATEGORIES = [
  { key: 'all', label: 'All', filter: () => true },
  {
    key: 'gpt',
    label: 'GPT',
    filter: (m: string) => /^(gpt|o[0-9]|chatgpt)/i.test(m),
  },
  { key: 'claude', label: 'Claude', filter: (m: string) => /claude/i.test(m) },
  {
    key: 'gemini',
    label: 'Gemini',
    filter: (m: string) => /gemini|gemma/i.test(m),
  },
  { key: 'llama', label: 'Llama', filter: (m: string) => /llama/i.test(m) },
  {
    key: 'mistral',
    label: 'Mistral',
    filter: (m: string) => /mistral|mixtral/i.test(m),
  },
  {
    key: 'deepseek',
    label: 'DeepSeek',
    filter: (m: string) => /deepseek/i.test(m),
  },
  { key: 'qwen', label: 'Qwen', filter: (m: string) => /qwen/i.test(m) },
  {
    key: 'embedding',
    label: 'Embedding',
    filter: (m: string) => /embed/i.test(m),
  },
  {
    key: 'image',
    label: 'Image',
    filter: (m: string) =>
      /dall-e|stable-diffusion|midjourney|sd[x3]|flux|imagen/i.test(m),
  },
  {
    key: 'tts',
    label: 'TTS',
    filter: (m: string) => /tts|whisper|speech/i.test(m),
  },
] as const

const MODELS_DISPLAY_COUNT = 25

export function AvailableModelsCard() {
  const { t } = useTranslation()
  const [activeCategory, setActiveCategory] = useState('all')
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('modelsExpanded') ?? 'false')
    } catch {
      return false
    }
  })

  const { data: models = [], isLoading } = useQuery({
    queryKey: ['user-available-models'],
    queryFn: async () => {
      const res = await api.get('/api/user/models')
      if (!res.data.success || !Array.isArray(res.data.data)) return []
      return res.data.data as string[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const toggleExpand = (val: boolean) => {
    setIsExpanded(val)
    localStorage.setItem('modelsExpanded', JSON.stringify(val))
  }

  const copyModel = (model: string) => {
    navigator.clipboard.writeText(model)
    toast.success(t('Copied: {{model}}', { model }))
  }

  const categoriesWithCounts = useMemo(
    () =>
      MODEL_CATEGORIES.map((cat) => ({
        ...cat,
        count:
          cat.key === 'all' ? models.length : models.filter(cat.filter).length,
      })).filter((cat) => cat.key === 'all' || cat.count > 0),
    [models]
  )

  const filteredModels = useMemo(() => {
    const cat = MODEL_CATEGORIES.find((c) => c.key === activeCategory)
    if (!cat || cat.key === 'all') return models
    return models.filter(cat.filter)
  }, [models, activeCategory])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Settings className='h-4 w-4' />
            {t('Available Models')}
          </CardTitle>
          <CardDescription>
            {t('View all currently available models')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex flex-wrap gap-2'>
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className='h-7 w-24 rounded-full' />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (models.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Settings className='h-4 w-4' />
            {t('Available Models')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground text-sm'>
            {t('No available models')}
          </p>
        </CardContent>
      </Card>
    )
  }

  const needsExpand = filteredModels.length > MODELS_DISPLAY_COUNT
  const displayModels =
    needsExpand && !isExpanded
      ? filteredModels.slice(0, MODELS_DISPLAY_COUNT)
      : filteredModels

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Settings className='h-4 w-4' />
          {t('Available Models')}
        </CardTitle>
        <CardDescription>
          {t('View all currently available models')} · {models.length}{' '}
          {t('models')}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className='h-auto flex-wrap'>
            {categoriesWithCounts.map((cat) => (
              <TabsTrigger key={cat.key} value={cat.key} className='text-xs'>
                {cat.label}
                <StatusBadge
                  label={String(cat.count)}
                  variant={activeCategory === cat.key ? 'info' : 'neutral'}
                  className='ml-1'
                  copyable={false}
                />
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className='flex flex-wrap gap-1.5'>
          {displayModels.map((model) => (
            <StatusBadge
              key={model}
              variant='neutral'
              className='cursor-pointer font-normal transition-opacity hover:opacity-70'
              onClick={() => copyModel(model)}
              copyable={false}
            >
              <Copy className='h-2.5 w-2.5 opacity-50' />
              {model}
            </StatusBadge>
          ))}

          {needsExpand && !isExpanded && (
            <Button
              variant='ghost'
              size='sm'
              className='h-6 gap-1 text-xs'
              onClick={() => toggleExpand(true)}
            >
              <ChevronDown className='h-3 w-3' />
              {t('More')} {filteredModels.length - MODELS_DISPLAY_COUNT}{' '}
              {t('models')}
            </Button>
          )}
          {needsExpand && isExpanded && (
            <Button
              variant='ghost'
              size='sm'
              className='h-6 gap-1 text-xs'
              onClick={() => toggleExpand(false)}
            >
              <ChevronUp className='h-3 w-3' />
              {t('Collapse')}
            </Button>
          )}
        </div>

        {filteredModels.length === 0 && (
          <p className='text-muted-foreground py-4 text-center text-sm'>
            {t('No models available in this category')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
