import {
  hashStringToSeed,
  randomInRange,
  randomIntInRange,
  seededRandom,
} from '@/features/pricing/lib/seed'
import type {
  AppCategory,
  AppListing,
  CategorySection,
  ModelHistoryPoint,
  ModelHistorySeries,
  ModelRanking,
  NewModelEntry,
  RankingCategory,
  RankingCategoryId,
  RankingMover,
  RankingPeriod,
  RankingsSnapshot,
  VendorRanking,
  VendorSharePoint,
  VendorShareSeries,
} from '../types'

// ----------------------------------------------------------------------------
// Catalogue: categories + canonical model & app fixtures
// ----------------------------------------------------------------------------
//
// All ranking data is derived from these fixtures plus a deterministic PRNG
// seeded by `${period}:${category}`. Every call with the same arguments
// returns the same numbers, while different (period, category) pairs render
// visibly distinct data. When the backend ships real analytics, these
// fixtures stay only as fallbacks.

export const RANKING_CATEGORIES: RankingCategory[] = [
  {
    id: 'all',
    label: 'All categories',
    description: 'Aggregate traffic across every category',
  },
  {
    id: 'programming',
    label: 'Programming',
    description: 'Code generation, refactoring, autocomplete',
  },
  {
    id: 'roleplay',
    label: 'Roleplay',
    description: 'Character chat, storytelling, persona',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description: 'Copywriting, ad creative, SEO',
  },
  {
    id: 'translation',
    label: 'Translation',
    description: 'Multilingual translation and localisation',
  },
  {
    id: 'science',
    label: 'Science',
    description: 'Research, analysis, scientific reasoning',
  },
  {
    id: 'finance',
    label: 'Finance',
    description: 'Trading insights, accounting, advisory',
  },
  {
    id: 'health',
    label: 'Health',
    description: 'Medical Q&A, mental health support',
  },
  {
    id: 'legal',
    label: 'Legal',
    description: 'Contract review, compliance, summarisation',
  },
  {
    id: 'education',
    label: 'Education',
    description: 'Tutoring, learning aids, assessment',
  },
  {
    id: 'productivity',
    label: 'Productivity',
    description: 'Email, summarisation, knowledge work',
  },
  {
    id: 'multimodal',
    label: 'Multimodal',
    description: 'Vision, image / video, document chat',
  },
]

type ModelFixture = {
  name: string
  vendor: string
  vendor_icon: string
  release_date: string
  /** Categories this model commonly serves. First entry is the primary. */
  categories: RankingCategoryId[]
  /** Relative popularity weight (0..1). */
  weight: number
}

const MODEL_FIXTURES: ModelFixture[] = [
  {
    name: 'gpt-5',
    vendor: 'OpenAI',
    vendor_icon: 'OpenAI.Color',
    release_date: '2025-10-12',
    categories: ['programming', 'productivity', 'science'],
    weight: 1.0,
  },
  {
    name: 'claude-sonnet-4-5',
    vendor: 'Anthropic',
    vendor_icon: 'Claude.Color',
    release_date: '2025-09-08',
    categories: ['programming', 'productivity', 'legal'],
    weight: 0.96,
  },
  {
    name: 'gemini-2.5-pro',
    vendor: 'Google',
    vendor_icon: 'Gemini.Color',
    release_date: '2025-06-15',
    categories: ['multimodal', 'science', 'education'],
    weight: 0.88,
  },
  {
    name: 'deepseek-v3.2',
    vendor: 'DeepSeek',
    vendor_icon: 'DeepSeek.Color',
    release_date: '2025-08-22',
    categories: ['programming', 'science'],
    weight: 0.84,
  },
  {
    name: 'gpt-5-mini',
    vendor: 'OpenAI',
    vendor_icon: 'OpenAI.Color',
    release_date: '2025-10-12',
    categories: ['productivity', 'roleplay', 'translation'],
    weight: 0.78,
  },
  {
    name: 'claude-opus-4-5',
    vendor: 'Anthropic',
    vendor_icon: 'Claude.Color',
    release_date: '2025-08-04',
    categories: ['legal', 'science', 'finance'],
    weight: 0.7,
  },
  {
    name: 'qwen3-235b-a22b',
    vendor: 'Alibaba',
    vendor_icon: 'Qwen.Color',
    release_date: '2025-05-30',
    categories: ['programming', 'translation', 'science'],
    weight: 0.66,
  },
  {
    name: 'grok-4',
    vendor: 'xAI',
    vendor_icon: 'XAI',
    release_date: '2025-04-18',
    categories: ['roleplay', 'science', 'marketing'],
    weight: 0.62,
  },
  {
    name: 'llama-4-maverick',
    vendor: 'Meta',
    vendor_icon: 'Meta.Color',
    release_date: '2025-04-05',
    categories: ['programming', 'productivity'],
    weight: 0.58,
  },
  {
    name: 'kimi-k2',
    vendor: 'Moonshot',
    vendor_icon: 'Moonshot',
    release_date: '2025-07-19',
    categories: ['productivity', 'translation'],
    weight: 0.55,
  },
  {
    name: 'glm-4.6',
    vendor: 'Zhipu',
    vendor_icon: 'Zhipu.Color',
    release_date: '2025-09-26',
    categories: ['programming', 'productivity'],
    weight: 0.52,
  },
  {
    name: 'gemini-2.5-flash',
    vendor: 'Google',
    vendor_icon: 'Gemini.Color',
    release_date: '2025-06-15',
    categories: ['productivity', 'translation', 'multimodal'],
    weight: 0.49,
  },
  {
    name: 'mistral-large-3',
    vendor: 'Mistral',
    vendor_icon: 'Mistral.Color',
    release_date: '2025-03-12',
    categories: ['programming', 'finance'],
    weight: 0.46,
  },
  {
    name: 'doubao-1.6-pro',
    vendor: 'ByteDance',
    vendor_icon: 'Doubao.Color',
    release_date: '2025-07-02',
    categories: ['marketing', 'roleplay'],
    weight: 0.44,
  },
  {
    name: 'hunyuan-turbos',
    vendor: 'Tencent',
    vendor_icon: 'Hunyuan.Color',
    release_date: '2025-05-08',
    categories: ['productivity', 'translation'],
    weight: 0.4,
  },
  {
    name: 'gpt-image-2',
    vendor: 'OpenAI',
    vendor_icon: 'OpenAI.Color',
    release_date: '2025-06-04',
    categories: ['multimodal', 'marketing'],
    weight: 0.38,
  },
  {
    name: 'sora-2',
    vendor: 'OpenAI',
    vendor_icon: 'OpenAI.Color',
    release_date: '2025-09-30',
    categories: ['multimodal', 'marketing'],
    weight: 0.34,
  },
  {
    name: 'veo-3',
    vendor: 'Google',
    vendor_icon: 'Gemini.Color',
    release_date: '2025-08-15',
    categories: ['multimodal', 'marketing'],
    weight: 0.31,
  },
  {
    name: 'qwen3-vl-plus',
    vendor: 'Alibaba',
    vendor_icon: 'Qwen.Color',
    release_date: '2025-06-20',
    categories: ['multimodal', 'education'],
    weight: 0.3,
  },
  {
    name: 'minimax-m2',
    vendor: 'MiniMax',
    vendor_icon: 'Minimax.Color',
    release_date: '2025-07-25',
    categories: ['roleplay', 'translation'],
    weight: 0.28,
  },
  {
    name: 'cohere-command-r-plus',
    vendor: 'Cohere',
    vendor_icon: 'Cohere.Color',
    release_date: '2024-11-10',
    categories: ['marketing', 'productivity'],
    weight: 0.26,
  },
  {
    name: 'ernie-x1-turbo',
    vendor: 'Baidu',
    vendor_icon: 'Baidu.Color',
    release_date: '2025-04-30',
    categories: ['translation', 'productivity'],
    weight: 0.22,
  },
]

type AppFixture = {
  name: string
  description: string
  category: AppCategory
  url?: string
  weight: number
  /** Bias toward these models (model_name). */
  prefers: string[]
}

const APP_FIXTURES: AppFixture[] = [
  {
    name: 'Cline',
    description: 'Autonomous coding agent inside the IDE',
    category: 'Coding',
    url: 'https://cline.bot',
    weight: 1.0,
    prefers: ['claude-sonnet-4-5', 'gpt-5'],
  },
  {
    name: 'Roo Code',
    description: 'AI agent for VS Code with multi-step planning',
    category: 'Coding',
    url: 'https://roocode.com',
    weight: 0.9,
    prefers: ['claude-sonnet-4-5', 'deepseek-v3.2'],
  },
  {
    name: 'Cursor',
    description: 'Editor with built-in AI for code generation',
    category: 'Coding',
    url: 'https://cursor.com',
    weight: 0.85,
    prefers: ['gpt-5', 'claude-sonnet-4-5'],
  },
  {
    name: 'Continue',
    description: 'Open-source AI code assistant for editors',
    category: 'Coding',
    url: 'https://continue.dev',
    weight: 0.62,
    prefers: ['deepseek-v3.2', 'qwen3-235b-a22b'],
  },
  {
    name: 'Aider',
    description: 'Pair-programming in your terminal',
    category: 'Coding',
    url: 'https://aider.chat',
    weight: 0.46,
    prefers: ['claude-sonnet-4-5', 'gpt-5'],
  },
  {
    name: 'Open WebUI',
    description: 'Self-hosted ChatGPT-like web interface',
    category: 'Chat',
    url: 'https://openwebui.com',
    weight: 0.74,
    prefers: ['gpt-5-mini', 'qwen3-235b-a22b'],
  },
  {
    name: 'LibreChat',
    description: 'Open-source multi-model chat platform',
    category: 'Chat',
    url: 'https://librechat.ai',
    weight: 0.6,
    prefers: ['gpt-5-mini', 'gemini-2.5-flash'],
  },
  {
    name: 'Lobe Chat',
    description: 'Modern open-source chat UI with plugins',
    category: 'Chat',
    url: 'https://lobehub.com',
    weight: 0.58,
    prefers: ['gpt-5-mini', 'claude-sonnet-4-5'],
  },
  {
    name: 'NextChat',
    description: 'Cross-platform private ChatGPT client',
    category: 'Chat',
    url: 'https://nextchat.dev',
    weight: 0.4,
    prefers: ['gpt-5-mini', 'gemini-2.5-flash'],
  },
  {
    name: 'TypingMind',
    description: 'Better UI for ChatGPT and Claude',
    category: 'Chat',
    url: 'https://typingmind.com',
    weight: 0.34,
    prefers: ['gpt-5', 'claude-sonnet-4-5'],
  },
  {
    name: 'SillyTavern',
    description: 'Roleplay frontend for chat models',
    category: 'Roleplay',
    url: 'https://sillytavernai.com',
    weight: 0.7,
    prefers: ['claude-opus-4-5', 'minimax-m2'],
  },
  {
    name: 'Janitor AI',
    description: 'Roleplay chat with custom characters',
    category: 'Roleplay',
    url: 'https://janitorai.com',
    weight: 0.55,
    prefers: ['minimax-m2', 'doubao-1.6-pro'],
  },
  {
    name: 'Notion AI',
    description: 'AI features inside Notion docs',
    category: 'Productivity',
    url: 'https://notion.so',
    weight: 0.62,
    prefers: ['gpt-5', 'claude-sonnet-4-5'],
  },
  {
    name: 'Reflect',
    description: 'Personal AI knowledge assistant',
    category: 'Productivity',
    url: 'https://reflect.app',
    weight: 0.36,
    prefers: ['gpt-5-mini', 'claude-sonnet-4-5'],
  },
  {
    name: 'Mem',
    description: 'AI-first note-taking app',
    category: 'Productivity',
    url: 'https://mem.ai',
    weight: 0.32,
    prefers: ['gpt-5-mini'],
  },
  {
    name: 'Khanmigo',
    description: 'Tutor for Khan Academy learners',
    category: 'Education',
    url: 'https://khanmigo.ai',
    weight: 0.48,
    prefers: ['gpt-5', 'claude-sonnet-4-5'],
  },
  {
    name: 'Quizlet AI',
    description: 'Personalised study & flashcards',
    category: 'Education',
    url: 'https://quizlet.com',
    weight: 0.36,
    prefers: ['gemini-2.5-flash'],
  },
  {
    name: 'Perplexity',
    description: 'Conversational answer engine',
    category: 'Research',
    url: 'https://perplexity.ai',
    weight: 0.78,
    prefers: ['gpt-5', 'claude-sonnet-4-5'],
  },
  {
    name: 'Elicit',
    description: 'AI research assistant for papers',
    category: 'Research',
    url: 'https://elicit.com',
    weight: 0.42,
    prefers: ['claude-opus-4-5', 'gemini-2.5-pro'],
  },
  {
    name: 'Jasper',
    description: 'Marketing copywriting platform',
    category: 'Marketing',
    url: 'https://jasper.ai',
    weight: 0.5,
    prefers: ['gpt-5', 'claude-sonnet-4-5'],
  },
  {
    name: 'Copy.ai',
    description: 'AI sales & marketing automation',
    category: 'Marketing',
    url: 'https://copy.ai',
    weight: 0.4,
    prefers: ['gpt-5-mini'],
  },
  {
    name: 'DeepL Write',
    description: 'AI rewriting & translation',
    category: 'Translation',
    url: 'https://deepl.com',
    weight: 0.36,
    prefers: ['gpt-5-mini', 'qwen3-235b-a22b'],
  },
  {
    name: 'Wordtune',
    description: 'AI rewriting & paraphrasing',
    category: 'Translation',
    url: 'https://wordtune.com',
    weight: 0.3,
    prefers: ['gpt-5-mini'],
  },
  {
    name: 'Harvey',
    description: 'AI assistant for law firms',
    category: 'Other',
    url: 'https://harvey.ai',
    weight: 0.42,
    prefers: ['claude-opus-4-5', 'gpt-5'],
  },
  {
    name: 'Hippocratic',
    description: 'Healthcare-focused AI agents',
    category: 'Health',
    url: 'https://hippocratic.ai',
    weight: 0.32,
    prefers: ['claude-opus-4-5'],
  },
  {
    name: 'Cleo',
    description: 'AI personal finance assistant',
    category: 'Finance',
    url: 'https://meetcleo.com',
    weight: 0.28,
    prefers: ['gpt-5-mini'],
  },
]

// ----------------------------------------------------------------------------
// PRNG seeding helpers
// ----------------------------------------------------------------------------

const PERIOD_FACTOR: Record<RankingPeriod, number> = {
  today: 0.04,
  week: 0.25,
  month: 1.0,
  year: 11.5,
  all: 38.0,
}

function periodSeed(
  period: RankingPeriod,
  category: RankingCategoryId
): number {
  return hashStringToSeed(`rankings:${period}:${category}`)
}

/** Pick a previous_rank for a model that's currently at `rank`. */
function makePreviousRank(rand: () => number, rank: number, total: number) {
  if (rand() < 0.08) return undefined
  const delta = randomIntInRange(rand, -3, 3)
  const prev = Math.max(1, Math.min(total + 4, rank + delta))
  if (prev === rank) return undefined
  return prev
}

// ----------------------------------------------------------------------------
// Leaderboard builders
// ----------------------------------------------------------------------------

function buildModelRankings(
  period: RankingPeriod,
  category: RankingCategoryId
): ModelRanking[] {
  const seed = periodSeed(period, category)
  const periodFactor = PERIOD_FACTOR[period]

  const filtered =
    category === 'all'
      ? MODEL_FIXTURES
      : MODEL_FIXTURES.filter((m) => m.categories.includes(category))

  // Slight per-call jitter on weights so the leaderboard re-orders a bit
  // between periods/categories.
  const ranked = filtered
    .map((m) => ({
      fixture: m,
      score:
        m.weight *
        (0.85 + seededRandom(seed ^ hashStringToSeed(m.name))() * 0.4),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)

  if (ranked.length === 0) return []

  const totalScore = ranked.reduce((s, r) => s + r.score, 0)
  const baseTokens = 240_000_000 * periodFactor

  return ranked.map(({ fixture, score }, idx) => {
    const rowSeed = seed ^ hashStringToSeed(fixture.name)
    const rowRand = seededRandom(rowSeed)
    const share = score / totalScore
    const totalTokens = Math.round(baseTokens * share * (0.9 + rowRand() * 0.2))
    const growth = randomInRange(seededRandom(rowSeed ^ 0x11), -22, 96)
    return {
      rank: idx + 1,
      previous_rank: makePreviousRank(
        seededRandom(rowSeed ^ 0x22),
        idx + 1,
        ranked.length
      ),
      model_name: fixture.name,
      vendor: fixture.vendor,
      vendor_icon: fixture.vendor_icon,
      category: fixture.categories[0],
      total_tokens: totalTokens,
      share,
      growth_pct: Math.round(growth * 10) / 10,
    }
  })
}

function buildAppListings(
  period: RankingPeriod,
  category: RankingCategoryId,
  models: ModelRanking[]
): AppListing[] {
  const seed = periodSeed(period, category) ^ 0xa11
  const periodFactor = PERIOD_FACTOR[period]

  // Map "all" category to all apps; otherwise filter by a soft mapping. We
  // keep the list large and let weights distribute naturally.
  const filtered = APP_FIXTURES.filter((app) => {
    if (category === 'all') return true
    if (category === 'programming') return app.category === 'Coding'
    if (category === 'roleplay') return app.category === 'Roleplay'
    if (category === 'marketing') return app.category === 'Marketing'
    if (category === 'translation') return app.category === 'Translation'
    if (category === 'education') return app.category === 'Education'
    if (category === 'productivity')
      return app.category === 'Productivity' || app.category === 'Chat'
    if (category === 'science') return app.category === 'Research'
    if (category === 'health') return app.category === 'Health'
    if (category === 'finance') return app.category === 'Finance'
    if (category === 'multimodal')
      return ['Creative', 'Marketing'].includes(app.category)
    return true
  })

  const ranked = filtered
    .map((app) => ({
      app,
      score:
        app.weight *
        (0.85 + seededRandom(seed ^ hashStringToSeed(app.name))() * 0.4),
    }))
    .sort((a, b) => b.score - a.score)

  if (ranked.length === 0) return []

  const totalScore = ranked.reduce((s, r) => s + r.score, 0)
  const baseTokens = 84_000_000 * periodFactor
  const modelNames = new Set(models.map((m) => m.model_name))

  return ranked.slice(0, 14).map(({ app, score }, idx) => {
    const rowSeed = seed ^ hashStringToSeed(app.name)
    const share = score / totalScore
    const totalTokens = Math.round(
      baseTokens * share * (0.9 + seededRandom(rowSeed)() * 0.25)
    )
    const growth = randomInRange(seededRandom(rowSeed ^ 0xab), -28, 130)
    const topModel =
      app.prefers.find((m) => modelNames.has(m)) ??
      app.prefers[0] ??
      models[0]?.model_name ??
      'gpt-5'
    return {
      rank: idx + 1,
      previous_rank: makePreviousRank(
        seededRandom(rowSeed ^ 0xcd),
        idx + 1,
        ranked.length
      ),
      name: app.name,
      description: app.description,
      category: app.category,
      url: app.url,
      total_tokens: totalTokens,
      growth_pct: Math.round(growth * 10) / 10,
      top_model: topModel,
      initial: app.name.charAt(0).toUpperCase(),
    }
  })
}

function buildVendorRankings(models: ModelRanking[]): VendorRanking[] {
  if (models.length === 0) return []
  const totals = new Map<
    string,
    {
      tokens: number
      icon?: string
      count: number
      growthSum: number
      topModel: { name: string; tokens: number }
    }
  >()
  for (const m of models) {
    const cur = totals.get(m.vendor)
    if (!cur) {
      totals.set(m.vendor, {
        tokens: m.total_tokens,
        icon: m.vendor_icon,
        count: 1,
        growthSum: m.growth_pct,
        topModel: { name: m.model_name, tokens: m.total_tokens },
      })
    } else {
      cur.tokens += m.total_tokens
      cur.count += 1
      cur.growthSum += m.growth_pct
      if (m.total_tokens > cur.topModel.tokens) {
        cur.topModel = { name: m.model_name, tokens: m.total_tokens }
      }
    }
  }

  const grand = [...totals.values()].reduce((s, v) => s + v.tokens, 0)
  const sorted = [...totals.entries()]
    .map(([vendor, v]) => ({
      vendor,
      total_tokens: v.tokens,
      vendor_icon: v.icon,
      models_count: v.count,
      top_model: v.topModel.name,
      share: v.tokens / Math.max(grand, 1),
      growth_pct: Math.round((v.growthSum / v.count) * 10) / 10,
    }))
    .sort((a, b) => b.total_tokens - a.total_tokens)

  return sorted.map((row, idx) => ({ rank: idx + 1, ...row }))
}

function buildMovers(models: ModelRanking[]): {
  movers: RankingMover[]
  droppers: RankingMover[]
} {
  const withDelta = models
    .filter((m) => m.previous_rank !== undefined)
    .map<RankingMover>((m) => ({
      model_name: m.model_name,
      vendor: m.vendor,
      vendor_icon: m.vendor_icon,
      current_rank: m.rank,
      rank_delta: (m.previous_rank ?? m.rank) - m.rank,
      growth_pct: m.growth_pct,
    }))

  const movers = [...withDelta]
    .filter((x) => x.rank_delta > 0)
    .sort((a, b) => b.rank_delta - a.rank_delta || b.growth_pct - a.growth_pct)
    .slice(0, 5)

  const droppers = [...withDelta]
    .filter((x) => x.rank_delta < 0)
    .sort((a, b) => a.rank_delta - b.rank_delta || a.growth_pct - b.growth_pct)
    .slice(0, 5)

  return { movers, droppers }
}

function buildNewModels(period: RankingPeriod): NewModelEntry[] {
  const seed = periodSeed(period, 'all') ^ 0xfa11
  const rand = seededRandom(seed)
  // "New" = released within the last 90 days for shorter periods, last 12
  // months for "year/all"
  const cutoffDays = period === 'today' || period === 'week' ? 90 : 365
  const cutoffMs = Date.now() - cutoffDays * 86_400_000
  return MODEL_FIXTURES.filter((m) => Date.parse(m.release_date) >= cutoffMs)
    .slice()
    .sort(
      (a, b) =>
        Date.parse(b.release_date) - Date.parse(a.release_date) ||
        b.weight - a.weight
    )
    .slice(0, 6)
    .map((m) => ({
      model_name: m.name,
      vendor: m.vendor,
      vendor_icon: m.vendor_icon,
      category: m.categories[0],
      release_date: m.release_date,
      total_tokens: Math.round(
        220_000_000 * m.weight * PERIOD_FACTOR[period] * (0.85 + rand() * 0.3)
      ),
      growth_pct: Math.round(randomInRange(rand, 35, 220) * 10) / 10,
    }))
}

// ----------------------------------------------------------------------------
// History (stacked bar / 100% stacked area) builders
// ----------------------------------------------------------------------------
//
// These produce a longer time-series than the leaderboard sparklines so the
// charts can render a recognisable growth story across 30+ buckets. Bucket
// granularity scales with the active period.

const HISTORY_BUCKETS: Record<RankingPeriod, number> = {
  today: 24, // hourly
  week: 21, // 3 weeks of daily
  month: 30, // ~30 days
  year: 52, // ~1 year of weekly
  all: 78, // ~18 months of weekly
}

/** Cap stacked series so the chart legend / colour palette stays legible. */
const HISTORY_TOP_MODELS = 18
const HISTORY_TOP_VENDORS = 12
const OTHERS_LABEL = 'Others'

function bucketStepMs(period: RankingPeriod): number {
  if (period === 'today') return 60 * 60 * 1000
  if (period === 'week' || period === 'month') return 24 * 60 * 60 * 1000
  return 7 * 24 * 60 * 60 * 1000
}

function formatBucketLabel(date: Date, period: RankingPeriod): string {
  if (period === 'today') {
    return `${String(date.getHours()).padStart(2, '0')}:00`
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Smooth ramp-up profile in [0..1] for a model that launched at
 * `releaseTs` and is observed at `bucketTs`. Models launched after the
 * bucket return 0; long-established models return 1. The S-curve gives a
 * natural ramp during the first ~6 weeks after launch.
 */
function rampWeight(bucketTs: number, releaseTs: number): number {
  if (!Number.isFinite(releaseTs)) return 1
  const ageMs = bucketTs - releaseTs
  if (ageMs <= 0) return 0
  const sixWeeks = 6 * 7 * 24 * 60 * 60 * 1000
  if (ageMs >= sixWeeks) return 1
  const t = ageMs / sixWeeks
  return 1 - Math.pow(1 - t, 3)
}

function buildModelsHistory(
  period: RankingPeriod,
  models: ModelRanking[]
): ModelHistorySeries {
  const buckets = HISTORY_BUCKETS[period]
  if (buckets === 0 || models.length === 0) {
    return { points: [], models: [], buckets: 0 }
  }

  const stepMs = bucketStepMs(period)
  const now = Date.now()
  const seed = periodSeed(period, 'all') ^ 0x71_57_07_4d
  const top = models.slice(0, Math.min(models.length, HISTORY_TOP_MODELS))

  const points: ModelHistoryPoint[] = []
  const totals = new Map<string, number>()

  for (const model of top) {
    const releaseFixture = MODEL_FIXTURES.find(
      (m) => m.name === model.model_name
    )
    const releaseTs = releaseFixture
      ? Date.parse(releaseFixture.release_date)
      : Number.NaN

    const modelSeed = seed ^ hashStringToSeed(`${model.model_name}:hist`)
    const rand = seededRandom(modelSeed)

    // Per-model average tokens per bucket so the area under the curve roughly
    // matches `total_tokens` (the leaderboard summary).
    const avgPerBucket = model.total_tokens / buckets

    // Drift = how much the model has been growing across the visible window.
    // Newer / faster-growing models (high growth_pct) show a steeper slope.
    const drift = 0.4 + Math.min(2.4, model.growth_pct / 50)
    // Shape factor — most weight near the end for growing models, more even
    // for established ones.
    const skew = 0.8 + rand() * 0.6

    let modelTotal = 0
    for (let i = buckets - 1; i >= 0; i--) {
      const bucketTs = now - i * stepMs
      const date = new Date(bucketTs)
      const t = (buckets - 1 - i) / Math.max(1, buckets - 1)
      const trendShape = Math.pow(t, 1.4 * skew) * drift + 0.4
      const ramp = rampWeight(bucketTs, releaseTs)
      const jitter = 0.78 + rand() * 0.45
      const tokens = Math.max(
        0,
        Math.round(avgPerBucket * trendShape * ramp * jitter)
      )
      modelTotal += tokens
      points.push({
        ts: date.toISOString(),
        label: formatBucketLabel(date, period),
        model: model.model_name,
        vendor: model.vendor,
        tokens,
      })
    }
    totals.set(model.model_name, modelTotal)
  }

  // Stable oldest → newest ordering.
  points.sort((a, b) => a.ts.localeCompare(b.ts))

  const ranked = top
    .map((m) => ({
      name: m.model_name,
      vendor: m.vendor,
      total: totals.get(m.model_name) ?? 0,
    }))
    .sort((a, b) => b.total - a.total)

  return { points, models: ranked, buckets }
}

function buildVendorShareHistory(
  history: ModelHistorySeries
): VendorShareSeries {
  if (history.points.length === 0) {
    return { points: [], vendors: [], buckets: 0 }
  }

  const byBucket = new Map<string, Map<string, number>>()
  const labelByTs = new Map<string, string>()
  for (const point of history.points) {
    if (!byBucket.has(point.ts)) byBucket.set(point.ts, new Map())
    if (!labelByTs.has(point.ts)) labelByTs.set(point.ts, point.label)
    const map = byBucket.get(point.ts)!
    map.set(point.vendor, (map.get(point.vendor) ?? 0) + point.tokens)
  }

  // Use the union of vendors observed across the window so the area chart
  // has stable series even on buckets where a vendor has 0 tokens.
  const vendorTotals = new Map<string, number>()
  for (const [, vendorMap] of byBucket) {
    for (const [vendor, tokens] of vendorMap) {
      vendorTotals.set(vendor, (vendorTotals.get(vendor) ?? 0) + tokens)
    }
  }
  const grand = [...vendorTotals.values()].reduce((s, v) => s + v, 0) || 1

  const sortedVendors = [...vendorTotals.entries()].sort((a, b) => b[1] - a[1])
  const topVendors = sortedVendors
    .slice(0, HISTORY_TOP_VENDORS)
    .map(([name]) => name)
  const otherVendors = new Set(
    sortedVendors.slice(HISTORY_TOP_VENDORS).map(([name]) => name)
  )
  const hasOthers = otherVendors.size > 0

  const points: VendorSharePoint[] = []
  const sortedTimestamps = [...byBucket.keys()].sort()
  for (const ts of sortedTimestamps) {
    const vendorMap = byBucket.get(ts)!
    const label = labelByTs.get(ts) ?? ts
    const totalAtBucket =
      [...vendorMap.values()].reduce((s, v) => s + v, 0) || 1

    for (const vendor of topVendors) {
      const tokens = vendorMap.get(vendor) ?? 0
      points.push({
        ts,
        label,
        vendor,
        share: tokens / totalAtBucket,
        tokens,
      })
    }
    if (hasOthers) {
      let othersTokens = 0
      for (const vendor of otherVendors) {
        othersTokens += vendorMap.get(vendor) ?? 0
      }
      points.push({
        ts,
        label,
        vendor: OTHERS_LABEL,
        share: othersTokens / totalAtBucket,
        tokens: othersTokens,
      })
    }
  }

  const vendors = topVendors
    .map((name) => {
      const total = vendorTotals.get(name) ?? 0
      return { name, total, share: total / grand }
    })
    .sort((a, b) => b.total - a.total)
  if (hasOthers) {
    let othersTotal = 0
    for (const vendor of otherVendors) {
      othersTotal += vendorTotals.get(vendor) ?? 0
    }
    vendors.push({
      name: OTHERS_LABEL,
      total: othersTotal,
      share: othersTotal / grand,
    })
  }

  return { points, vendors, buckets: history.buckets }
}

/**
 * Build a single per-category section. Used by `buildRankingsSnapshot` to
 * eagerly compute every category section the page renders inline (rather
 * than gating them behind a top-level filter).
 */
function buildCategorySection(
  period: RankingPeriod,
  category: RankingCategory
): CategorySection {
  const models = buildModelRankings(period, category.id).slice(0, 12)
  const models_history = buildModelsHistory(period, models)
  const total_tokens = models.reduce((s, m) => s + m.total_tokens, 0)
  return {
    category: category.id,
    label: category.label,
    description: category.description,
    models,
    models_history,
    total_tokens,
  }
}

// ----------------------------------------------------------------------------
// Public entry point
// ----------------------------------------------------------------------------

/**
 * Build a full leaderboard snapshot for the given period.
 *
 * The snapshot bundles the overall (all-categories) view used by the page
 * header sections **and** an independent ranking unit for each non-`all`
 * category — so the page can render every category inline instead of
 * gating the data behind a category filter.
 */
export function buildRankingsSnapshot(period: RankingPeriod): RankingsSnapshot {
  const models = buildModelRankings(period, 'all')
  const apps = buildAppListings(period, 'all', models)
  const vendors = buildVendorRankings(models)
  const { movers, droppers } = buildMovers(models)
  const new_models = buildNewModels(period)
  const models_history = buildModelsHistory(period, models)
  const vendor_share_history = buildVendorShareHistory(models_history)

  const category_sections = RANKING_CATEGORIES.filter(
    (c) => c.id !== 'all'
  ).map((c) => buildCategorySection(period, c))

  return {
    models,
    apps,
    vendors,
    top_movers: movers,
    top_droppers: droppers,
    new_models,
    models_history,
    vendor_share_history,
    category_sections,
  }
}
