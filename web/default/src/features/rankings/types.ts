// ----------------------------------------------------------------------------
// Rankings types
// ----------------------------------------------------------------------------
//
// Shape of the data shown on the /rankings page. The backend has not yet
// implemented these analytics endpoints, so the helpers in
// `lib/mock-rankings.ts` produce deterministic mock values seeded from the
// (period, category) tuple. When the real APIs land, these types double as
// the response shape the UI expects.

export type RankingPeriod = 'today' | 'week' | 'month' | 'year' | 'all'

export type RankingCategoryId =
  | 'all'
  | 'programming'
  | 'roleplay'
  | 'marketing'
  | 'translation'
  | 'science'
  | 'finance'
  | 'health'
  | 'legal'
  | 'education'
  | 'productivity'
  | 'multimodal'

export type RankingCategory = {
  id: RankingCategoryId
  /** Default English label, fed through i18n at render time. */
  label: string
  description: string
}

export type ModelRanking = {
  rank: number
  /** Previous rank in the same period; undefined means "new". */
  previous_rank?: number
  model_name: string
  vendor: string
  vendor_icon?: string
  category: RankingCategoryId
  /** Total tokens routed through this model in the period. */
  total_tokens: number
  /** Share of all tokens served (0..1). */
  share: number
  /** Period-over-period change in token volume (%). */
  growth_pct: number
}

export type AppCategory =
  | 'Coding'
  | 'Chat'
  | 'Productivity'
  | 'Education'
  | 'Creative'
  | 'Roleplay'
  | 'Translation'
  | 'Marketing'
  | 'Health'
  | 'Finance'
  | 'Research'
  | 'Other'

export type AppListing = {
  rank: number
  previous_rank?: number
  name: string
  description: string
  category: AppCategory
  url?: string
  /** Total tokens this app sent through new-api in the period. */
  total_tokens: number
  /** Period-over-period change. */
  growth_pct: number
  /** Top model used by this app (model_name). */
  top_model: string
  /** Logo letter / initial. */
  initial: string
}

export type VendorRanking = {
  rank: number
  vendor: string
  vendor_icon?: string
  total_tokens: number
  share: number
  growth_pct: number
  /** Number of distinct models from this vendor with traffic. */
  models_count: number
  /** Top model from this vendor in the period. */
  top_model: string
}

export type RankingMover = {
  model_name: string
  vendor: string
  vendor_icon?: string
  /** Positive = climbed, negative = dropped. */
  rank_delta: number
  current_rank: number
  /** Token-volume change percent. */
  growth_pct: number
}

export type NewModelEntry = {
  model_name: string
  vendor: string
  vendor_icon?: string
  category: RankingCategoryId
  release_date: string
  total_tokens: number
  /** % growth since the model launched. */
  growth_pct: number
}

/**
 * One sample of a model's token usage at a given timestamp.
 * Flat shape ready to feed VChart's stacked-bar spec.
 */
export type ModelHistoryPoint = {
  ts: string
  /** Pre-formatted x-axis label (e.g. "May 5", "12:00"). */
  label: string
  /** Model display name shown in tooltip / legend. */
  model: string
  vendor: string
  /** Token count routed through the model in this bucket. */
  tokens: number
}

export type ModelHistorySeries = {
  /** Flat points ready for VChart, ordered oldest → newest. */
  points: ModelHistoryPoint[]
  /** Models that appear in the series, sorted by total tokens desc. */
  models: Array<{ name: string; vendor: string; total: number }>
  /** Bucket count (used for sizing axis ticks). */
  buckets: number
}

/**
 * One sample of a vendor's market share at a given timestamp. `share` is
 * normalised within the bucket (sums to 1.0 across all vendors at the same
 * `ts`); `tokens` is preserved for tooltip use.
 */
export type VendorSharePoint = {
  ts: string
  label: string
  vendor: string
  share: number
  tokens: number
}

export type VendorShareSeries = {
  /** Flat points ready for VChart, ordered oldest → newest. */
  points: VendorSharePoint[]
  /** Vendors that appear in the series, sorted by aggregate tokens desc. */
  vendors: Array<{ name: string; total: number; share: number }>
  buckets: number
}

/**
 * Self-contained ranking unit for a single category. Pairs the small
 * stacked-bar chart with the leaderboard data it summarises so
 * `<CategorySection>` can render both halves from one prop. Every
 * category gets one of these rendered inline on the rankings page.
 */
export type CategorySection = {
  category: RankingCategoryId
  /** English source label, fed through i18n at render time. */
  label: string
  /** English source description, fed through i18n at render time. */
  description: string
  /** Top models in this category, ordered by total tokens desc. */
  models: ModelRanking[]
  /** Stacked-bar history of token usage by model in this category. */
  models_history: ModelHistorySeries
  /** Sum of all `models[].total_tokens` (cached for the section header). */
  total_tokens: number
}

export type RankingsSnapshot = {
  // Overall (all categories) ------------------------------------------------
  models: ModelRanking[]
  apps: AppListing[]
  vendors: VendorRanking[]
  /** Largest rank gainers in this period. */
  top_movers: RankingMover[]
  /** Largest rank losers in this period. */
  top_droppers: RankingMover[]
  /** Newly launched / recently added models. */
  new_models: NewModelEntry[]
  /** Stacked-bar history of token usage by model over the period. */
  models_history: ModelHistorySeries
  /** 100%-stacked area history of token share by vendor over the period. */
  vendor_share_history: VendorShareSeries
  // Per-category sections ---------------------------------------------------
  /** Independent ranking sections, one per non-`all` category. */
  category_sections: CategorySection[]
}
