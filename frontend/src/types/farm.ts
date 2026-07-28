/* Mock data for RT农家乐 (farm activity system). */

// ── types ───────────────────────────────────────────────
export type SeedType = '玉米' | '番茄' | '草莓' | '向日葵' | '胡萝卜'

export type PlotStage = 'empty' | 'growing' | 'ready'

export type AnimalType = 'cow' | 'chicken' | 'sheep'

export type PetType = 'robot' | 'cat' | 'dragon'

export type CatchRarity = 'common' | 'rare' | 'legendary'

export type LeaderPeriod = 'day' | 'week' | 'all'

export interface FarmState {
  level: number
  exp: number
  exp_next: number
  coins: number // 金币
  ore: number // 矿石
  feed: number // 饲料
}

export interface FarmPlot {
  id: number
  seed: SeedType | null
  planted_at: number | null // epoch seconds
  harvest_at: number | null // epoch seconds when ready
  stage: PlotStage
  yield_quota: number // quota reward on harvest
}

export interface RanchAnimal {
  id: number
  type: AnimalType
  name: string
  mood: number // 0-100
  fed_at: number | null
  yield_ready: boolean
  yield_quota: number
}

export interface FishingState {
  daily_left: number
  last_catch: {
    name: string
    quota: number
    rarity: CatchRarity
    emoji: string
  } | null
}

export interface FarmPet {
  id: number
  type: PetType
  name: string
  level: number
  energy: number // 0-100, decreases; ≤20 = needs feeding
  fed_today: boolean
  skill: string // a short description of the pet's bonus
}

export interface MineState {
  today_calls: number // API calls made today (each = 1 mine action)
  today_ore: number // ore earned today
  total_ore: number // all-time
  bonus_active: boolean // streak bonus
}

export interface LeaderEntry {
  rank: number
  uid: number
  display_name: string
  avatar_seed: string // initials or emoji seed for avatar
  consume_quota: number // quota consumed in the period
  is_self: boolean
}

export interface RebateTier {
  label: string // e.g. "青铜"
  min_quota: number // minimum cumulative consume to reach this tier
  rate: number // rebate rate 0..1, e.g. 0.02 = 2%
  badge: string // emoji badge
}

export interface RebateState {
  current_consume: number // user's current period consume
  current_tier_index: number // which tier they're in (0-based)
  earned_total: number // total rebate earned (quota units)
  last_rebate_at: number // epoch seconds
  history: Array<{
    date: string // e.g. "2026-07"
    amount: number // quota rebated
    rate: number
  }>
}
