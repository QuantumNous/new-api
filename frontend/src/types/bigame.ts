/* Mock data for 无趣大游戏 (game welfare system). */

// ── types ───────────────────────────────────────────────
export interface GameWallet {
  balance: number // current game coins
  total_earned: number // lifetime earned
  total_spent: number // lifetime spent
}

export interface MilestoneItem {
  id: string
  label: string // e.g. "消耗满 1 万 Token"
  target: number // quota needed (in quota units)
  current: number // user's current quota consume (same units)
  reward: number // game coins awarded
  claimed: boolean
}

export type SpinPrizeType = 'quota' | 'coins' | 'special' | 'nothing'

export interface SpinPrize {
  id: string
  label: string
  type: SpinPrizeType
  value: number // quota/coins amount; 0 for 'nothing'
  weight: number // relative probability weight
  color_token: string // semantic token name e.g. 'accent', 'signal', 'support', 'status-success', 'status-warning'
}

export type BoxRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface BlindBoxPrize {
  id: string
  label: string
  rarity: BoxRarity
  type: 'quota' | 'coins' | 'special'
  value: number
  weight: number // relative probability weight for this rarity pool
  emoji: string
}

export interface PrizeRecord {
  id: number
  source: 'spin' | 'box'
  prize_label: string
  rarity: BoxRarity
  value: number
  type: 'quota' | 'coins' | 'special'
  created: number // epoch seconds
}
