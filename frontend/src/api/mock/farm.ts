import type {
  FarmState,
  FarmPlot,
  RanchAnimal,
  FishingState,
  FarmPet,
  MineState,
  LeaderEntry,
  RebateTier,
  RebateState,
} from '@/types/farm'

// ── constants ───────────────────────────────────────────
const now = Math.floor(Date.now() / 1000)
const DAY = 86400

// ── mock data ───────────────────────────────────────────
export const farmState: FarmState = {
  level: 7,
  exp: 340,
  exp_next: 500,
  coins: 1240,
  ore: 88,
  feed: 42,
}

export const farmPlots: FarmPlot[] = [
  {
    id: 1,
    seed: '玉米',
    planted_at: now - 2 * DAY,
    harvest_at: now - 3600,
    stage: 'ready',
    yield_quota: 30000,
  },
  {
    id: 2,
    seed: '番茄',
    planted_at: now - 2 * DAY,
    harvest_at: now - 3600,
    stage: 'ready',
    yield_quota: 25000,
  },
  {
    id: 3,
    seed: '向日葵',
    planted_at: now - 12 * 3600,
    harvest_at: now + 8 * 3600,
    stage: 'growing',
    yield_quota: 40000,
  },
  {
    id: 4,
    seed: '胡萝卜',
    planted_at: now - 12 * 3600,
    harvest_at: now + 8 * 3600,
    stage: 'growing',
    yield_quota: 20000,
  },
  {
    id: 5,
    seed: null,
    planted_at: null,
    harvest_at: null,
    stage: 'empty',
    yield_quota: 0,
  },
  {
    id: 6,
    seed: '草莓',
    planted_at: now - 2 * DAY,
    harvest_at: now - 3600,
    stage: 'ready',
    yield_quota: 50000,
  },
]

export const ranchAnimals: RanchAnimal[] = [
  {
    id: 1,
    type: 'cow',
    name: '大白',
    mood: 85,
    fed_at: now - 4 * 3600,
    yield_ready: true,
    yield_quota: 60000,
  },
  {
    id: 2,
    type: 'chicken',
    name: '小黄',
    mood: 60,
    fed_at: now - 10 * 3600,
    yield_ready: false,
    yield_quota: 15000,
  },
  {
    id: 3,
    type: 'sheep',
    name: '毛毛',
    mood: 30,
    fed_at: now - DAY,
    yield_ready: true,
    yield_quota: 35000,
  },
]

export const fishingState: FishingState = {
  daily_left: 2,
  last_catch: {
    name: '金鲤鱼',
    quota: 50000,
    rarity: 'rare',
    emoji: '🐠',
  },
}

export const myPet: FarmPet = {
  id: 1,
  type: 'robot',
  name: '星宝',
  level: 4,
  energy: 65,
  fed_today: false,
  skill: '每次 API 调用额外获得 +2% 矿石',
}

export const mineState: MineState = {
  today_calls: 18,
  today_ore: 54,
  total_ore: 1240,
  bonus_active: true,
}

export const leaderboard: LeaderEntry[] = [
  {
    rank: 1,
    uid: 1001,
    display_name: '张三丰',
    avatar_seed: '张',
    consume_quota: 5_000_000,
    is_self: false,
  },
  {
    rank: 2,
    uid: 1002,
    display_name: '李晓明',
    avatar_seed: '李',
    consume_quota: 4_200_000,
    is_self: false,
  },
  {
    rank: 3,
    uid: 1003,
    display_name: '王佳慧',
    avatar_seed: '王',
    consume_quota: 3_800_000,
    is_self: false,
  },
  {
    rank: 4,
    uid: 1004,
    display_name: '赵大鹏',
    avatar_seed: '赵',
    consume_quota: 3_200_000,
    is_self: false,
  },
  {
    rank: 5,
    uid: 1005,
    display_name: '我自己',
    avatar_seed: '我',
    consume_quota: 2_980_000,
    is_self: true,
  },
  {
    rank: 6,
    uid: 1006,
    display_name: '陈雨欣',
    avatar_seed: '陈',
    consume_quota: 2_400_000,
    is_self: false,
  },
  {
    rank: 7,
    uid: 1007,
    display_name: '刘浩然',
    avatar_seed: '刘',
    consume_quota: 1_800_000,
    is_self: false,
  },
  {
    rank: 8,
    uid: 1008,
    display_name: '孙婷婷',
    avatar_seed: '孙',
    consume_quota: 1_200_000,
    is_self: false,
  },
  {
    rank: 9,
    uid: 1009,
    display_name: '周志远',
    avatar_seed: '周',
    consume_quota: 680_000,
    is_self: false,
  },
  {
    rank: 10,
    uid: 1010,
    display_name: '吴小红',
    avatar_seed: '吴',
    consume_quota: 200_000,
    is_self: false,
  },
]

export const rebateTiers: RebateTier[] = [
  { label: '青铜', min_quota: 0, rate: 0.01, badge: '🥉' },
  { label: '白银', min_quota: 1_000_000, rate: 0.015, badge: '🥈' },
  { label: '黄金', min_quota: 5_000_000, rate: 0.02, badge: '🥇' },
  { label: '铂金', min_quota: 20_000_000, rate: 0.025, badge: '💎' },
  { label: '钻石', min_quota: 50_000_000, rate: 0.03, badge: '👑' },
]

export const rebateState: RebateState = {
  current_consume: 2_980_000,
  current_tier_index: 1,
  earned_total: 128_000,
  last_rebate_at: now - 7 * DAY,
  history: [
    { date: '2026-07', amount: 44_700, rate: 0.015 },
    { date: '2026-06', amount: 32_500, rate: 0.015 },
    { date: '2026-05', amount: 21_000, rate: 0.01 },
    { date: '2026-04', amount: 16_800, rate: 0.01 },
    { date: '2026-03', amount: 9_000, rate: 0.01 },
    { date: '2026-02', amount: 4_000, rate: 0.01 },
  ],
}
