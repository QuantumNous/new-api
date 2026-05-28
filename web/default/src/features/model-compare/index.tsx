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
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  Clock3,
  DollarSign,
  Loader2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  PromptInput,
  PromptInputFooter,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
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
import { useSystemConfigStore } from '@/stores/system-config-store'
import { callModelWithSession, fetchAvailableModels, fetchAvailableGroups } from './api'
import type { GroupOption } from './api'

// ─── types ────────────────────────────────────────────────────────────────────

type ModelRegion = 'us' | 'cn' | 'other'
type ModelTier = 'high' | 'medium' | 'low'
type Difficulty = 'easy' | 'medium' | 'hard'
type RegionFilter = 'all' | ModelRegion
type ResultStatus = 'loading' | 'done' | 'error'

interface CompareModel {
  id: string
  name: string
  company: string
  region: ModelRegion
  tier: ModelTier
  pricePerKToken: number
}

interface CompareResult {
  modelId: string
  modelName: string
  company: string
  status: ResultStatus
  /** Frontend round-trip ms (always available) */
  responseTimeMs: number
  /** Backend model processing time in ms — from usage log (preferred) */
  useTimeMs: number | null
  totalTokens: number
  /** Raw quota in internal units — divide by quotaPerUnit for display */
  quotaRaw: number | null
  answerPreview: string
  answerFull: string
  errorMessage?: string
}

interface CompareRound {
  id: string
  prompt: string
  difficulty: Difficulty
  results: CompareResult[]
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = 'model_compare_rounds'
const MAX_STORED_ROUNDS = 50

function loadRoundsFromStorage(): CompareRound[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []
    // Only downgrade "loading" on cold start (page refresh) — same-session
    // in-flight requests are handled by the module store, not localStorage.
    return (parsed as CompareRound[]).map((round) => ({
      ...round,
      results: round.results.map((r) =>
        r.status === 'loading'
          ? { ...r, status: 'error' as ResultStatus, errorMessage: '__interrupted__' }
          : r,
      ),
    }))
  } catch {
    return []
  }
}

function saveRoundsToStorage(rounds: CompareRound[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(rounds.slice(-MAX_STORED_ROUNDS)),
    )
  } catch {
    // Ignore quota errors silently
  }
}

// ─── module-level store ── persists across route changes / unmounts ───────────
//
// Requests update this store directly. Components subscribe and receive updates
// even if they were unmounted while the request was in-flight.

type StoreListener = (rounds: CompareRound[]) => void

const _store = {
  rounds: loadRoundsFromStorage() as CompareRound[],
  listeners: new Set<StoreListener>(),
}

function storeGet(): CompareRound[] {
  return _store.rounds
}

function storeSet(updater: (prev: CompareRound[]) => CompareRound[]): void {
  _store.rounds = updater(_store.rounds)
  saveRoundsToStorage(_store.rounds)
  _store.listeners.forEach((l) => l(_store.rounds))
}

function storeSubscribe(listener: StoreListener): () => void {
  _store.listeners.add(listener)
  return () => { _store.listeners.delete(listener) }
}

// ─── static metadata registry ─────────────────────────────────────────────────

const MODEL_REGISTRY: Record<
  string,
  { name: string; company: string; region: ModelRegion; tier: ModelTier; pricePerKToken: number }
> = {
  'gpt-4o':            { name: 'GPT-4o',            company: 'OpenAI',      region: 'us', tier: 'high',   pricePerKToken: 0.020  },
  'gpt-4o-mini':       { name: 'GPT-4o mini',        company: 'OpenAI',      region: 'us', tier: 'low',    pricePerKToken: 0.0038 },
  'gpt-4.1':           { name: 'GPT-4.1',            company: 'OpenAI',      region: 'us', tier: 'high',   pricePerKToken: 0.018  },
  'claude-opus-4-5':   { name: 'Claude Opus 4.5',   company: 'Anthropic',   region: 'us', tier: 'high',   pricePerKToken: 0.024  },
  'claude-sonnet-4-5': { name: 'Claude Sonnet 4.5', company: 'Anthropic',   region: 'us', tier: 'medium', pricePerKToken: 0.011  },
  'claude-haiku-3-5':  { name: 'Claude Haiku 3.5',  company: 'Anthropic',   region: 'us', tier: 'low',    pricePerKToken: 0.004  },
  'gemini-2.5-pro':    { name: 'Gemini 2.5 Pro',    company: 'Google',      region: 'us', tier: 'high',   pricePerKToken: 0.019  },
  'gemini-2.5-flash':  { name: 'Gemini 2.5 Flash',  company: 'Google',      region: 'us', tier: 'medium', pricePerKToken: 0.009  },
  'deepseek-v3':       { name: 'DeepSeek V3',        company: 'DeepSeek',    region: 'cn', tier: 'medium', pricePerKToken: 0.008  },
  'deepseek-r1':       { name: 'DeepSeek R1',        company: 'DeepSeek',    region: 'cn', tier: 'high',   pricePerKToken: 0.014  },
  'qwen-max':          { name: 'Qwen Max',           company: 'Alibaba',     region: 'cn', tier: 'medium', pricePerKToken: 0.0075 },
  'qwen-turbo':        { name: 'Qwen Turbo',         company: 'Alibaba',     region: 'cn', tier: 'low',    pricePerKToken: 0.003  },
  'glm-4-air':         { name: 'GLM-4 Air',          company: 'Zhipu',       region: 'cn', tier: 'low',    pricePerKToken: 0.0035 },
  'moonshot-v1-8k':              { name: 'Kimi v1 8k',             company: 'Moonshot AI', region: 'cn', tier: 'low',    pricePerKToken: 0.003  },
  'doubao-seed-2-0-lite-260428': { name: 'Doubao Seed 2.0 Lite',   company: 'ByteDance',   region: 'cn', tier: 'low',    pricePerKToken: 0.002  },
  'gpt-5.4-mini':                { name: 'GPT-5.4 mini',           company: 'OpenAI',      region: 'us', tier: 'low',    pricePerKToken: 0.003  },
}

const TIER_ORDER: ModelTier[] = ['high', 'medium', 'low']

function toModelMeta(id: string): Omit<CompareModel, 'id'> {
  const reg = MODEL_REGISTRY[id]
  if (reg) return reg
  const name = id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return { name, company: '', region: 'other', tier: 'medium', pricePerKToken: 0 }
}

// ─── prompt helpers ────────────────────────────────────────────────────────────

const QUICK_PROMPTS: Record<Difficulty, string> = {
  easy:   '我需要洗车。洗车场在100米远的地方。我应该开车去还是走着去？',
  medium: '农夫带着狼、羊和白菜过河，小船一次只能载农夫和一样东西。狼会吃羊，羊会吃白菜。怎么安全过河？',
  hard:   '请给出一个面向高并发 AI 网关的架构方案，包含限流、降级、可观测性与成本优化。',
}

const MIN_MODELS = 2
const MAX_MODELS = 4
const DEFAULT_MODEL_IDS = ['doubao-seed-2-0-lite-260428', 'gpt-5.4-mini']

function detectDifficulty(prompt: string): Difficulty {
  if (prompt.length > 90) return 'hard'
  if (prompt.length > 36) return 'medium'
  return 'easy'
}

// ─── component ────────────────────────────────────────────────────────────────

export function ModelComparePanel() {
  const { t } = useTranslation()
  const quotaPerUnit = useSystemConfigStore((s) => s.config.currency.quotaPerUnit)

  // ── Group (分组) selector ─────────────────────────────────────────────────
  const [groups, setGroups]           = useState<GroupOption[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState<string>('default')

  useEffect(() => {
    fetchAvailableGroups()
      .then((gs) => {
        setGroups(gs)
        if (gs.length > 0) setSelectedGroup(gs[0].value)
      })
      .catch(() => setGroups([]))
      .finally(() => setGroupsLoading(false))
  }, [])

  // Available models from backend
  const [availableModelIds, setAvailableModelIds] = useState<string[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)

  // Selector state
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all')
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(DEFAULT_MODEL_IDS)

  // Conversation — backed by module-level store (survives route changes)
  const [rounds, setLocalRounds] = useState<CompareRound[]>(() => storeGet())
  const [isSending, setIsSending] = useState(false)

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRoundId, setDetailRoundId] = useState<string | null>(null)

  // Subscribe to store on mount; sync immediately in case requests completed
  // while this component was unmounted.
  useEffect(() => {
    setLocalRounds(storeGet())
    return storeSubscribe(setLocalRounds)
  }, [])

  // Auto-scroll to bottom
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [rounds])

  // Fetch real model list on mount; keep only available defaults
  useEffect(() => {
    fetchAvailableModels()
      .then((ids) => {
        setAvailableModelIds(ids)
        // Retain defaults that exist on the backend; fall back to first N available
        setSelectedModelIds((prev) => {
          const valid = prev.filter((id) => ids.includes(id))
          if (valid.length > 0) return valid
          return ids.slice(0, MIN_MODELS)
        })
      })
      .catch(() => setAvailableModelIds([]))
      .finally(() => setModelsLoading(false))
  }, [])

  const allModels: CompareModel[] = useMemo(
    () => availableModelIds.map((id) => ({ id, ...toModelMeta(id) })),
    [availableModelIds],
  )

  const selectedModels = useMemo(
    () => allModels.filter((m) => selectedModelIds.includes(m.id)),
    [allModels, selectedModelIds],
  )

  const groupedModels = useMemo(() => {
    const visible = allModels.filter(
      (m) => regionFilter === 'all' || m.region === regionFilter,
    )
    return TIER_ORDER
      .map((tier) => ({ tier, models: visible.filter((m) => m.tier === tier) }))
      .filter((g) => g.models.length > 0)
  }, [allModels, regionFilter])

  const detailRound = useMemo(
    () => rounds.find((r) => r.id === detailRoundId) ?? null,
    [detailRoundId, rounds],
  )

  const [promptInput, setPromptInput] = useState('')

  const canSend =
    !isSending &&
    selectedModelIds.length >= MIN_MODELS &&
    selectedModelIds.length <= MAX_MODELS &&
    promptInput.trim().length > 0

  // ─── interactions ─────────────────────────────────────────────────────────

  const toggleModel = (id: string) =>
    setSelectedModelIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_MODELS) return prev   // silently block when at max
      return [...prev, id]
    })

  const applyQuickPrompt = (d: Difficulty) => setPromptInput(QUICK_PROMPTS[d])

  const openDetail = (roundId: string) => {
    setDetailRoundId(roundId)
    setDetailOpen(true)
  }

  const sendPrompt = async (text?: string) => {
    const prompt = (text ?? promptInput).trim()
    if (!prompt || selectedModels.length < MIN_MODELS || selectedModels.length > MAX_MODELS || isSending) return

    setPromptInput('')
    setIsSending(true)

    const roundId = String(Date.now())
    const difficulty = detectDifficulty(prompt)

    // Add round with per-model loading placeholders immediately
    const loadingResults: CompareResult[] = selectedModels.map((m) => ({
      modelId:        m.id,
      modelName:      m.name,
      company:        m.company,
      status:         'loading',
      responseTimeMs: 0,
      useTimeMs:      null,
      totalTokens:    0,
      quotaRaw:       null,
      answerPreview:  '',
      answerFull:     '',
    }))

    storeSet((prev) => [...prev, { id: roundId, prompt, difficulty, results: loadingResults }])

    // Fire all model calls in parallel; each card updates as its call resolves.
    // storeSet writes through to localStorage and notifies all subscribers,
    // so results are delivered even if this component is currently unmounted.
    await Promise.allSettled(
      selectedModels.map(async (model) => {
        try {
          const result = await callModelWithSession(model.id, prompt, selectedGroup)

          storeSet((prev) =>
            prev.map((round) => {
              if (round.id !== roundId) return round
              return {
                ...round,
                results: round.results.map((r) =>
                  r.modelId !== model.id
                    ? r
                    : {
                        ...r,
                        status:           'done' as ResultStatus,
                        responseTimeMs:   result.responseTimeMs,
                        useTimeMs:        result.useTimeMs,
                        promptTokens:     result.promptTokens,
                        completionTokens: result.completionTokens,
                        totalTokens:      result.totalTokens,
                        quotaRaw:         result.quotaRaw,
                        answerPreview:    result.content.slice(0, 300),
                        answerFull:       result.content,
                      },
                ),
              }
            }),
          )
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : t('Request failed')
          storeSet((prev) =>
            prev.map((round) => {
              if (round.id !== roundId) return round
              return {
                ...round,
                results: round.results.map((r) =>
                  r.modelId !== model.id
                    ? r
                    : { ...r, status: 'error' as ResultStatus, errorMessage },
                ),
              }
            }),
          )
        }
      }),
    )

    setIsSending(false)
  }

  // ─── labels ───────────────────────────────────────────────────────────────

  const tierLabels: Record<ModelTier, string> = {
    high:   t('High Tier'),
    medium: t('Medium Tier'),
    low:    t('Low Tier'),
  }

  const tierDescriptions: Record<ModelTier, string> = {
    high:   t('For complex coding, long-horizon agent, and architecture design'),
    medium: t('For daily coding and code review, recommended by default'),
    low:    t('For high-frequency calls, completion, and lightweight tasks'),
  }

  const difficultyLabels: Record<Difficulty, string> = {
    easy:   t('Easy'),
    medium: t('Medium'),
    hard:   t('Hard'),
  }

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className='flex h-full flex-col rounded-xl border bg-card'>
      <div className='flex min-h-0 flex-1 flex-col'>
        <section className='flex min-h-0 flex-1 flex-col'>

          {/* Header */}
          <header className='border-b px-4 py-3 sm:px-5'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div className='min-w-0'>
                <h3 className='text-base font-semibold'>{t('AI Model Compare Platform')}</h3>
                <p className='text-muted-foreground mt-1 text-xs sm:text-sm'>
                  {t('Compare latency, token usage, price, and answer quality across selected models')}
                  {' · '}
                  <span className='italic'>{t('Each question is sent independently with no conversation context.')}</span>
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

          {/* Conversation area */}
          <div className='min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5'>
            {rounds.length === 0 ? (
              <div className='flex h-full items-center justify-center rounded-xl border border-dashed p-6 text-center'>
                <div className='max-w-xl space-y-3'>
                  <p className='text-lg font-semibold'>{t('Welcome to model comparison')}</p>
                  <p className='text-muted-foreground text-sm'>
                    {t('Select 2–4 models, then ask a question to start comparison.')}
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
                          <ResultCard key={result.modelId} result={result} t={t} quotaPerUnit={quotaPerUnit} />
                        ))}
                      </div>

                      {hasMore && (
                        <Button
                          variant='outline'
                          size='sm'
                          disabled={round.results.some((r) => r.status === 'loading')}
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
            <div ref={bottomRef} />
          </div>

          {/* Footer / input — sticky at bottom of scroll container */}
          <footer className='sticky bottom-0 z-10 border-t bg-card px-3 py-3 sm:px-4'>
            {/* Quick-prompt chips — above the input, only when ≥3 models selected */}
            {selectedModelIds.length >= 3 && (
              <div className='mb-2 flex flex-wrap gap-1.5'>
                <button
                  type='button'
                  disabled={isSending}
                  onClick={() => applyQuickPrompt('easy')}
                  className='text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed'
                >
                  {t('Default Easy Question')}
                </button>
                <button
                  type='button'
                  disabled={isSending}
                  onClick={() => applyQuickPrompt('medium')}
                  className='text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed'
                >
                  {t('Default Medium Question')}
                </button>
              </div>
            )}

            <PromptInput
              groupClassName='rounded-xl border shadow-sm'
              onSubmit={(msg: PromptInputMessage) => {
                const text = msg.text?.trim()
                if (!text) return
                setPromptInput(text)
                Promise.resolve().then(() => {
                  void sendPrompt(text)
                })
              }}
            >
              <PromptInputTextarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder={
                  selectedModelIds.length < MIN_MODELS
                    ? t('Please select 2–4 models to enable comparison')
                    : t('Type your custom question...')
                }
                disabled={isSending}
                className='min-h-[60px] px-4 text-sm'
                autoComplete='off'
                autoCorrect='off'
                spellCheck={false}
              />

              <PromptInputFooter className='p-2'>
                {/* Group (项目分组) selector */}
                <PromptInputTools>
                  <PromptInputModelSelect
                    value={selectedGroup}
                    onValueChange={(v) => setSelectedGroup(v as string)}
                    disabled={groupsLoading}
                  >
                    <PromptInputModelSelectTrigger className='max-w-[180px]'>
                      <span className='truncate'>
                        {groupsLoading ? t('Loading...') : selectedGroup || t('Default Group')}
                      </span>
                    </PromptInputModelSelectTrigger>
                    <PromptInputModelSelectContent>
                      {groups.length === 0 && !groupsLoading && (
                        <div className='text-muted-foreground px-2 py-1.5 text-xs'>
                          {t('No groups available')}
                        </div>
                      )}
                      {groups.map((g) => (
                        <PromptInputModelSelectItem key={g.value} value={g.value}>
                          {g.label}
                        </PromptInputModelSelectItem>
                      ))}
                    </PromptInputModelSelectContent>
                  </PromptInputModelSelect>
                </PromptInputTools>

                <PromptInputSubmit
                  disabled={!canSend}
                  status={isSending ? 'submitted' : 'ready'}
                  variant='default'
                />
              </PromptInputFooter>
            </PromptInput>
          </footer>
        </section>
      </div>

      {/* Model selector dialog */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className='sm:max-w-4xl'>
          <DialogHeader>
            <DialogTitle>{t('Select Models')}</DialogTitle>
            <DialogDescription>
              {t('Select 2–4 models to compare. Defaults are pre-selected for you.')}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='flex flex-wrap gap-2'>
              {(['all', 'us', 'cn', 'other'] as const).map((r) => (
                <Button
                  key={r}
                  variant={regionFilter === r ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => setRegionFilter(r)}
                >
                  {r === 'all'
                    ? t('All')
                    : r === 'us'
                      ? t('US Models')
                      : r === 'cn'
                        ? t('China Models')
                        : t('Other')}
                </Button>
              ))}
            </div>

            {modelsLoading ? (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='text-muted-foreground size-6 animate-spin' />
              </div>
            ) : availableModelIds.length === 0 ? (
              <p className='text-muted-foreground py-8 text-center text-sm'>
                {t('No models available')}
              </p>
            ) : (
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
                        const atMax = !selected && selectedModelIds.length >= MAX_MODELS
                        return (
                          <button
                            key={model.id}
                            type='button'
                            disabled={atMax}
                            onClick={() => toggleModel(model.id)}
                            className={`rounded-lg border p-3 text-left transition ${
                              selected
                                ? 'border-primary bg-primary/5'
                                : atMax
                                  ? 'border-border opacity-40 cursor-not-allowed'
                                  : 'hover:bg-muted/60 border-border'
                            }`}
                          >
                            <p className='text-sm font-medium'>{model.name}</p>
                            <p className='text-xs text-muted-foreground'>
                              {model.company || model.id}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <div className='flex w-full items-center justify-between'>
              <p className='text-xs text-muted-foreground'>
                {t('Selected {{count}} / {{max}} models', { count: selectedModelIds.length, max: MAX_MODELS })}
                {selectedModelIds.length >= MAX_MODELS && (
                  <span className='text-warning ml-1'>{t('(Maximum reached)')}</span>
                )}
              </p>
              <Button
                disabled={selectedModelIds.length < MIN_MODELS || selectedModelIds.length > MAX_MODELS}
                onClick={() => setSelectorOpen(false)}
              >
                {t('Confirm')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
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
                      <span className='font-medium'>{(result.useTimeMs ?? result.responseTimeMs)}ms</span>
                    </div>
                    <div className='flex items-center gap-1.5 py-0.5'>
                      <BarChart3 className='size-3.5 shrink-0' />
                      <span className='text-muted-foreground'>{t('Tokens')}:</span>
                      <span className='font-medium'>{result.promptTokens} / {result.completionTokens}</span>
                    </div>
                    <div className='flex items-center gap-1.5 py-0.5'>
                      <DollarSign className='size-3.5 shrink-0' />
                      <span className='text-muted-foreground'>{t('Cost')}:</span>
                      <span className='font-medium'>
                        {result.quotaRaw != null && result.quotaRaw > 0 && quotaPerUnit > 0
                          ? `$${(result.quotaRaw / quotaPerUnit).toFixed(6)}`
                          : '—'}
                      </span>
                    </div>
                  </div>
                  <div className='min-h-0 flex-1 overflow-y-auto p-3'>
                    {result.status === 'loading' ? (
                      <div className='flex items-center gap-2 text-muted-foreground'>
                        <Loader2 className='size-4 animate-spin' />
                        <span className='text-sm'>{t('Loading...')}</span>
                      </div>
                    ) : result.status === 'error' ? (
                      <p className='text-destructive text-sm'>
                        {result.errorMessage === '__interrupted__'
                          ? t('Request was interrupted')
                          : result.errorMessage}
                      </p>
                    ) : (
                      <p className='break-words text-sm leading-6 text-muted-foreground'>
                        {result.answerFull}
                      </p>
                    )}
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

// ─── ResultCard ───────────────────────────────────────────────────────────────

function ResultCard({
  result,
  t,
  quotaPerUnit,
}: {
  result: CompareResult
  t: (key: string) => string
  quotaPerUnit: number
}) {
  // Prefer backend log time; fall back to frontend round-trip
  const displayTimeMs = result.useTimeMs ?? result.responseTimeMs

  // Cost from actual usage log quota; quotaPerUnit converts to USD
  const costDisplay =
    result.quotaRaw != null && result.quotaRaw > 0 && quotaPerUnit > 0
      ? `$${(result.quotaRaw / quotaPerUnit).toFixed(6)}`
      : '—'

  if (result.status === 'loading') {
    return (
      <article className='rounded-xl border p-3'>
        <div className='mb-2'>
          <p className='text-sm font-semibold'>{result.modelName}</p>
          <p className='text-xs text-muted-foreground'>{result.company}</p>
        </div>
        <div className='flex h-20 items-center justify-center'>
          <Loader2 className='text-muted-foreground size-5 animate-spin' />
        </div>
      </article>
    )
  }

  if (result.status === 'error') {
    return (
      <article className='rounded-xl border p-3'>
        <div className='mb-2'>
          <p className='text-sm font-semibold'>{result.modelName}</p>
          <p className='text-xs text-muted-foreground'>{result.company}</p>
        </div>
        <div className='text-destructive flex items-start gap-1.5 text-xs'>
          <AlertCircle className='mt-0.5 size-3.5 shrink-0' />
          <span className='line-clamp-4 break-all'>
            {result.errorMessage === '__interrupted__'
              ? t('Request was interrupted')
              : result.errorMessage}
          </span>
        </div>
      </article>
    )
  }

  return (
    <article className='flex flex-col gap-2 rounded-xl border p-3'>
      <div>
        <p className='text-sm font-semibold'>{result.modelName}</p>
        <p className='text-xs text-muted-foreground'>{result.company}</p>
      </div>
      {/* Answer content — primary emphasis */}
      <p className='flex-1 whitespace-pre-wrap text-sm leading-relaxed'>{result.answerPreview}</p>
      {/* Metrics — from usage log (authoritative), same source as Usage Log dashboard */}
      <div className='flex items-center gap-3 border-t pt-2 text-xs text-muted-foreground'>
        <span>{displayTimeMs}ms</span>
        <span className='text-border'>·</span>
        <span>{result.promptTokens} / {result.completionTokens}</span>
        <span className='text-border'>·</span>
        <span>{costDisplay}</span>
      </div>
    </article>
  )
}
