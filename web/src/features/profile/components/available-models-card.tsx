import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Copy, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
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
import { api } from '@/lib/api'

const MODEL_CATEGORIES = [
  { key: 'all', label: 'All', filter: () => true },
  { key: 'gpt', label: 'GPT', filter: (m: string) => /^(gpt|o[0-9]|chatgpt)/i.test(m) },
  { key: 'claude', label: 'Claude', filter: (m: string) => /claude/i.test(m) },
  { key: 'gemini', label: 'Gemini', filter: (m: string) => /gemini|gemma/i.test(m) },
  { key: 'llama', label: 'Llama', filter: (m: string) => /llama/i.test(m) },
  { key: 'mistral', label: 'Mistral', filter: (m: string) => /mistral|mixtral/i.test(m) },
  { key: 'deepseek', label: 'DeepSeek', filter: (m: string) => /deepseek/i.test(m) },
  { key: 'qwen', label: 'Qwen', filter: (m: string) => /qwen/i.test(m) },
  { key: 'embedding', label: 'Embedding', filter: (m: string) => /embed/i.test(m) },
  { key: 'image', label: 'Image', filter: (m: string) => /dall-e|stable-diffusion|midjourney|sd[x3]|flux|imagen/i.test(m) },
  { key: 'tts', label: 'TTS', filter: (m: string) => /tts|whisper|speech/i.test(m) },
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
    toast.success(t('已复制: {{model}}', { model }))
  }

  const categoriesWithCounts = useMemo(
    () =>
      MODEL_CATEGORIES.map((cat) => ({
        ...cat,
        count: cat.key === 'all'
          ? models.length
          : models.filter(cat.filter).length,
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
            {t('可用模型')}
          </CardTitle>
          <CardDescription>{t('查看当前可用的所有模型')}</CardDescription>
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
            {t('可用模型')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>{t('没有可用模型')}</p>
        </CardContent>
      </Card>
    )
  }

  const needsExpand = filteredModels.length > MODELS_DISPLAY_COUNT
  const displayModels = needsExpand && !isExpanded
    ? filteredModels.slice(0, MODELS_DISPLAY_COUNT)
    : filteredModels

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Settings className='h-4 w-4' />
          {t('可用模型')}
        </CardTitle>
        <CardDescription>
          {t('查看当前可用的所有模型')} · {models.length} {t('个模型')}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className='h-auto flex-wrap'>
            {categoriesWithCounts.map((cat) => (
              <TabsTrigger key={cat.key} value={cat.key} className='text-xs'>
                {cat.label}
                <Badge
                  variant={activeCategory === cat.key ? 'default' : 'secondary'}
                  className='ml-1 h-4 px-1 text-[10px]'
                >
                  {cat.count}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className='flex flex-wrap gap-1.5'>
          {displayModels.map((model) => (
            <Badge
              key={model}
              variant='outline'
              className={cn(
                'cursor-pointer gap-1 transition-colors hover:bg-accent',
                'text-xs font-normal'
              )}
              onClick={() => copyModel(model)}
            >
              <Copy className='h-2.5 w-2.5 opacity-50' />
              {model}
            </Badge>
          ))}

          {needsExpand && !isExpanded && (
            <Button
              variant='ghost'
              size='sm'
              className='h-6 gap-1 text-xs'
              onClick={() => toggleExpand(true)}
            >
              <ChevronDown className='h-3 w-3' />
              {t('更多')} {filteredModels.length - MODELS_DISPLAY_COUNT}{' '}
              {t('个模型')}
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
              {t('收起')}
            </Button>
          )}
        </div>

        {filteredModels.length === 0 && (
          <p className='py-4 text-center text-sm text-muted-foreground'>
            {t('该分类下没有可用模型')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
