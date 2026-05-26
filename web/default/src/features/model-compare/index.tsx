import { useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  Bot,
  Clock3,
  DollarSign,
  Layers,
  Send,
  Settings,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

type ModelRegion = 'us' | 'cn'
type ModelTier = 'high' | 'medium' | 'low'
type Difficulty = 'easy' | 'medium' | 'hard'
type RegionFilter = 'all' | ModelRegion

interface CompareModel {
  id: string
  name: string
  company: string
  region: ModelRegion
  tier: ModelTier
  basePrice: number
}

interface CompareResult {
  modelId: string
  modelName: string
  company: string
  responseTimeMs: number
  tokens: number
  priceUsd: number
  answerPreview: string
  answerFull: string
}

interface CompareRound {
  id: string
  prompt: string
  difficulty: Difficulty
  results: CompareResult[]
}

const MODELS: CompareModel[] = [
  { id: 'gpt-4o', name: 'GPT-4o', company: 'OpenAI', region: 'us', tier: 'high', basePrice: 0.02 },
  { id: 'claude-opus-4', name: 'Claude Opus 4', company: 'Anthropic', region: 'us', tier: 'high', basePrice: 0.024 },
  { id: 'gemini-2-5-pro', name: 'Gemini 2.5 Pro', company: 'Google', region: 'us', tier: 'high', basePrice: 0.019 },
  { id: 'gpt-4-1', name: 'GPT-4.1', company: 'OpenAI', region: 'us', tier: 'high', basePrice: 0.018 },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', company: 'Anthropic', region: 'us', tier: 'medium', basePrice: 0.011 },
  { id: 'gemini-2-5-flash', name: 'Gemini 2.5 Flash', company: 'Google', region: 'us', tier: 'medium', basePrice: 0.009 },
  { id: 'deepseek-v3', name: 'DeepSeek V3', company: 'DeepSeek', region: 'cn', tier: 'medium', basePrice: 0.008 },
  { id: 'qwen-max', name: 'Qwen Max', company: 'Alibaba', region: 'cn', tier: 'medium', basePrice: 0.0075 },
  { id: 'glm-4-air', name: 'GLM-4 Air', company: 'Zhipu', region: 'cn', tier: 'low', basePrice: 0.0035 },
  { id: 'kimi-k2', name: 'Kimi K2', company: 'Moonshot AI', region: 'cn', tier: 'low', basePrice: 0.0032 },
  { id: 'minimax-abab6', name: 'MiniMax abab6', company: 'MiniMax', region: 'cn', tier: 'low', basePrice: 0.0031 },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', company: 'OpenAI', region: 'us', tier: 'low', basePrice: 0.0038 },
]

const QUICK_PROMPTS: Record<Difficulty, string> = {
  easy: '请解释什么是 REST API，并给出一个简单示例。',
  medium: '请设计一个可扩展的多租户权限系统，并说明数据模型与接口策略。',
  hard: '请给出一个面向高并发 AI 网关的架构方案，包含限流、降级、可观测性与成本优化。',
}

const TIER_ORDER: ModelTier[] = ['high', 'medium', 'low']

function toTierWeight(tier: ModelTier) {
  if (tier === 'high') return 1
  if (tier === 'medium') return 0.72
  return 0.45
}

function toDifficultyWeight(difficulty: Difficulty) {
  if (difficulty === 'hard') return 1
  if (difficulty === 'medium') return 0.72
  return 0.48
}

function detectDifficultyByPrompt(prompt: string): Difficulty {
  if (prompt.length > 90) return 'hard'
  if (prompt.length > 36) return 'medium'
  return 'easy'
}

function buildAnswer(
  modelName: string,
  company: string,
  difficulty: Difficulty,
  prompt: string
) {
  const base =
    difficulty === 'hard'
      ? '该模型给出分层架构、风险治理、性能瓶颈分析，以及可落地的迭代步骤。'
      : difficulty === 'medium'
        ? '该模型给出结构化方案，覆盖核心模块、数据流与关键权衡点。'
        : '该模型给出简明解释，配合可直接上手的最小示例。'

  const full = `${modelName}（${company}）针对问题“${prompt}”的完整回答：${base} 同时附上可执行建议、边界条件和下一步验证清单。`
  return {
    preview: `${base} 重点强调可读性与执行效率。`,
    full,
  }
}

function generateResult(model: CompareModel, prompt: string, difficulty: Difficulty): CompareResult {
  const tierWeight = toTierWeight(model.tier)
  const difficultyWeight = toDifficultyWeight(difficulty)
  const responseTimeMs = Math.round(580 + (1 - tierWeight) * 760 + difficultyWeight * 420 + Math.random() * 210)
  const tokens = Math.round(220 + difficultyWeight * 520 + tierWeight * 180 + Math.random() * 90)
  const priceUsd = Number(((tokens / 1000) * model.basePrice).toFixed(4))
  const answer = buildAnswer(model.name, model.company, difficulty, prompt)

  return {
    modelId: model.id,
    modelName: model.name,
    company: model.company,
    responseTimeMs,
    tokens,
    priceUsd,
    answerPreview: answer.preview,
    answerFull: answer.full,
  }
}

export function ModelComparePanel() {
  const { t } = useTranslation()
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all')
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([])
  const [promptInput, setPromptInput] = useState('')
  const [rounds, setRounds] = useState<CompareRound[]>([])
  const [detailRoundId, setDetailRoundId] = useState<string | null>(null)

  const selectedModels = useMemo(
    () => MODELS.filter((model) => selectedModelIds.includes(model.id)),
    [selectedModelIds]
  )

  const groupedModels = useMemo(() => {
    const visible = MODELS.filter((model) =>
      regionFilter === 'all' ? true : model.region === regionFilter
    )

    return TIER_ORDER.map((tier) => ({
      tier,
      models: visible.filter((model) => model.tier === tier),
    }))
  }, [regionFilter])

  const detailRound = useMemo(
    () => rounds.find((round) => round.id === detailRoundId) ?? null,
    [detailRoundId, rounds]
  )

  const canConfirmSelection = selectedModelIds.length >= 3
  const canSend = selectedModelIds.length >= 3 && promptInput.trim().length > 0

  const toggleModel = (modelId: string) => {
    setSelectedModelIds((current) =>
      current.includes(modelId)
        ? current.filter((id) => id !== modelId)
        : [...current, modelId]
    )
  }

  const applyQuickPrompt = (difficulty: Difficulty) => {
    setPromptInput(QUICK_PROMPTS[difficulty])
  }

  const openDetail = (roundId: string) => {
    setDetailRoundId(roundId)
    setDetailOpen(true)
  }

  const sendPrompt = () => {
    const normalizedPrompt = promptInput.trim()
    if (!normalizedPrompt || selectedModels.length < 3) return

    const difficulty = detectDifficultyByPrompt(normalizedPrompt)
    const results = selectedModels.map((model) =>
      generateResult(model, normalizedPrompt, difficulty)
    )

    const nextRound: CompareRound = {
      id: `${Date.now()}`,
      prompt: normalizedPrompt,
      difficulty,
      results,
    }

    setRounds((current) => [...current, nextRound])
    setPromptInput('')
  }

  const tierLabels: Record<ModelTier, string> = {
    high: t('High Tier'),
    medium: t('Medium Tier'),
    low: t('Low Tier'),
  }

  const tierDescriptions: Record<ModelTier, string> = {
    high: t('For complex coding, long-horizon agent, and architecture design'),
    medium: t('For daily coding and code review, recommended by default'),
    low: t('For high-frequency calls, completion, and lightweight tasks'),
  }

  const difficultyLabels: Record<Difficulty, string> = {
    easy: t('Easy'),
    medium: t('Medium'),
    hard: t('Hard'),
  }

  return (
    <div className='rounded-xl border bg-card'>
      <div className='grid min-h-[70vh] grid-cols-1 md:grid-cols-[76px_1fr]'>
        <aside className='border-b p-3 md:border-r md:border-b-0 md:p-2.5'>
          <div className='flex flex-row gap-2 md:flex-col'>
            <Button className='flex-1 md:flex-none' variant='default' size='icon'>
              <Layers />
            </Button>
            <Button className='flex-1 md:flex-none' variant='outline' size='icon' disabled>
              <Bot />
            </Button>
            <Button className='flex-1 md:flex-none' variant='outline' size='icon' disabled>
              <Activity />
            </Button>
            <Button className='flex-1 md:flex-none' variant='outline' size='icon' disabled>
              <Settings />
            </Button>
          </div>
        </aside>

        <section className='flex min-h-0 flex-col'>
          <header className='border-b px-4 py-3 sm:px-5'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div>
                <h3 className='text-base font-semibold'>{t('AI Model Compare Platform')}</h3>
                <p className='text-muted-foreground mt-1 text-xs sm:text-sm'>
                  {t('Compare latency, token usage, price, and answer quality across selected models')}
                </p>
              </div>
              <Button variant='outline' onClick={() => setSelectorOpen(true)}>
                {t('Select Models')}
                <Badge className='ml-1' variant='secondary'>
                  {selectedModelIds.length}
                </Badge>
              </Button>
            </div>
          </header>

          <div className='min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5'>
            {rounds.length === 0 ? (
              <div className='flex h-[44vh] items-center justify-center rounded-xl border border-dashed p-6 text-center'>
                <div className='max-w-xl space-y-3'>
                  <p className='text-lg font-semibold'>{t('Welcome to model comparison')}</p>
                  <p className='text-muted-foreground text-sm'>
                    {t('Please select at least 3 models, then ask a question to start multi-model comparison.')}
                  </p>
                </div>
              </div>
            ) : (
              rounds.map((round) => {
                const previewResults = round.results.slice(0, 3)
                const hasMore = round.results.length > 3
                return (
                  <div key={round.id} className='space-y-3'>
                    <div className='flex justify-end'>
                      <div className='max-w-[88%] rounded-2xl bg-blue-500 px-4 py-2 text-sm text-white'>
                        {round.prompt}
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                        <span>{t('Difficulty')}:</span>
                        <Badge variant='outline'>{difficultyLabels[round.difficulty]}</Badge>
                      </div>

                      <div className='grid gap-3 md:grid-cols-3'>
                        {previewResults.map((result) => (
                          <article key={result.modelId} className='rounded-xl border p-3'>
                            <div className='mb-2'>
                              <p className='text-sm font-semibold'>{result.modelName}</p>
                              <p className='text-xs text-muted-foreground'>{result.company}</p>
                            </div>
                            <div className='mb-2 grid grid-cols-3 gap-2 text-xs'>
                              <div>
                                <p className='text-muted-foreground'>{t('Latency')}</p>
                                <p className='font-medium'>{result.responseTimeMs}ms</p>
                              </div>
                              <div>
                                <p className='text-muted-foreground'>{t('Tokens')}</p>
                                <p className='font-medium'>{result.tokens}</p>
                              </div>
                              <div>
                                <p className='text-muted-foreground'>{t('Price')}</p>
                                <p className='font-medium'>${result.priceUsd}</p>
                              </div>
                            </div>
                            <p className='line-clamp-4 text-xs text-muted-foreground'>
                              {result.answerPreview}
                            </p>
                          </article>
                        ))}
                      </div>

                      {hasMore && (
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => openDetail(round.id)}
                        >
                          {t('View full comparison for {{count}} models', {
                            count: round.results.length,
                          })}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <footer className='space-y-3 border-t px-4 py-3 sm:px-5'>
            {selectedModelIds.length >= 3 && (
              <div className='flex flex-wrap gap-2'>
                <Button variant='outline' size='sm' onClick={() => applyQuickPrompt('easy')}>
                  {t('Default Easy Question')}
                </Button>
                <Button variant='outline' size='sm' onClick={() => applyQuickPrompt('medium')}>
                  {t('Default Medium Question')}
                </Button>
                <Button variant='outline' size='sm' onClick={() => applyQuickPrompt('hard')}>
                  {t('Default Hard Question')}
                </Button>
              </div>
            )}
            <div className='flex items-end gap-2'>
              <Textarea
                value={promptInput}
                onChange={(event) => setPromptInput(event.target.value)}
                placeholder={t('Type your custom question...')}
                rows={2}
              />
              <Button onClick={sendPrompt} disabled={!canSend}>
                <Send />
                {t('Send')}
              </Button>
            </div>
          </footer>
        </section>
      </div>

      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className='sm:max-w-4xl'>
          <DialogHeader>
            <DialogTitle>{t('Select Models')}</DialogTitle>
            <DialogDescription>
              {t('Please select at least 3 models to enable comparison')}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='flex flex-wrap gap-2'>
              <Button
                variant={regionFilter === 'all' ? 'default' : 'outline'}
                size='sm'
                onClick={() => setRegionFilter('all')}
              >
                {t('All')}
              </Button>
              <Button
                variant={regionFilter === 'us' ? 'default' : 'outline'}
                size='sm'
                onClick={() => setRegionFilter('us')}
              >
                {t('US Models')}
              </Button>
              <Button
                variant={regionFilter === 'cn' ? 'default' : 'outline'}
                size='sm'
                onClick={() => setRegionFilter('cn')}
              >
                {t('China Models')}
              </Button>
            </div>

            <div className='max-h-[56vh] space-y-4 overflow-y-auto pr-1'>
              {groupedModels.map((group) => (
                <section key={group.tier} className='space-y-2'>
                  <div>
                    <p className='text-sm font-semibold'>{tierLabels[group.tier]}</p>
                    <p className='text-muted-foreground text-xs'>
                      {tierDescriptions[group.tier]}
                    </p>
                  </div>
                  <div className='grid gap-2 sm:grid-cols-2'>
                    {group.models.map((model) => {
                      const selected = selectedModelIds.includes(model.id)
                      return (
                        <button
                          key={model.id}
                          type='button'
                          onClick={() => toggleModel(model.id)}
                          className={`rounded-lg border p-3 text-left transition ${
                            selected
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/60 border-border'
                          }`}
                        >
                          <p className='text-sm font-medium'>{model.name}</p>
                          <p className='text-xs text-muted-foreground'>{model.company}</p>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <DialogFooter>
            <div className='flex w-full items-center justify-between'>
              <p className='text-xs text-muted-foreground'>
                {t('Selected {{count}} models', { count: selectedModelIds.length })}
              </p>
              <Button disabled={!canConfirmSelection} onClick={() => setSelectorOpen(false)}>
                {t('Confirm')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className='flex h-[90vh] max-w-[calc(100%-2rem)] flex-col overflow-hidden p-0 sm:max-w-[calc(100%-2rem)]'>
          <DialogHeader className='shrink-0 border-b px-5 pt-5 pb-4'>
            <DialogTitle>{t('Detailed Model Comparison')}</DialogTitle>
            <DialogDescription>
              {t('Review full responses and metrics for each selected model')}
            </DialogDescription>
          </DialogHeader>

          <div className='min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-5 py-4'>
            <div className='flex h-full gap-3'>
              {(detailRound?.results ?? []).map((result) => (
                <article
                  key={result.modelId}
                  className='flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-xl border'
                >
                  <header className='shrink-0 border-b p-3'>
                    <p className='truncate font-semibold'>{result.modelName}</p>
                    <p className='truncate text-xs text-muted-foreground'>{result.company}</p>
                  </header>
                  <div className='shrink-0 border-b p-3 text-xs'>
                    <div className='flex items-center gap-1.5 py-0.5'>
                      <Clock3 className='size-3.5 shrink-0' />
                      <span className='text-muted-foreground'>{t('Latency')}:</span>
                      <span className='font-medium'>{result.responseTimeMs}ms</span>
                    </div>
                    <div className='flex items-center gap-1.5 py-0.5'>
                      <BarChart3 className='size-3.5 shrink-0' />
                      <span className='text-muted-foreground'>{t('Tokens')}:</span>
                      <span className='font-medium'>{result.tokens}</span>
                    </div>
                    <div className='flex items-center gap-1.5 py-0.5'>
                      <DollarSign className='size-3.5 shrink-0' />
                      <span className='text-muted-foreground'>{t('Cost')}:</span>
                      <span className='font-medium'>${result.priceUsd}</span>
                    </div>
                  </div>
                  <div className='min-h-0 flex-1 overflow-y-auto p-3'>
                    <p className='break-words text-sm leading-6 text-muted-foreground'>
                      {result.answerFull}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <p className='shrink-0 border-t px-5 py-3 text-center text-xs text-muted-foreground'>
            {t('Slide left to view more model comparisons')}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
