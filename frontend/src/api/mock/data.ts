import { marketSources, marketTagPool } from '@/constants/console'
import { adminChannelTypeMeta } from '@/constants/adminChannels'
import type { UserInfo } from '@/types/auth'
import type {
  AdminChannel,
  AdminOrder,
  AdminOrderMethod,
  AdminOrderStatus,
  AdminOrderType,
  AdminRedemptionCode,
  AdminUser,
  AdminUserRole,
  AdminUserStatus,
  TokenType,
  TokenChannel,
  TokenItem,
  LogRequestMode,
  LogType,
  LogItem,
  TopupRecord,
  Plan,
  MarketModelType,
  MarketModel,
  InviteRecordStatus,
  InviteInfo,
  TicketItem,
  Activity,
  ActivitySummary,
  MerchantScale,
  ListingStatus,
  CurrentSubscription,
  MerchantComment,
  Merchant,
  MarketListing,
  MyChannel,
  InvoiceItem,
} from '@/types/console'

export const QUOTA_PER_DOLLAR = 500_000

export const GROUPS = ['default', 'vip', 'svip']

const marketRaw: Omit<MarketModel, 'id'>[] = [
  /* ---- OpenAI ---- */
  {
    name: 'gpt-4o',
    vendor: 'OpenAI',
    type: 'chat',
    billing: 'tiered',
    price: {
      input: 2.5,
      output: 10,
      cache_read: 1.25,
      tiers: [
        { label: '标准', input: 2.5, output: 10 },
        { label: '批量', input: 1.25, output: 5 },
      ],
    },
    context: 128_000,
    tagline: '全能旗舰多模态模型，均衡的速度与质量，支持文本 / 图像输入。',
    latency: 1.78,
    tps: 62.4,
    health: 98,
    channels: ['OpenAI 官方', 'Azure 美东', 'Azure 欧西'],
  },
  {
    name: 'gpt-4o-mini',
    vendor: 'OpenAI',
    type: 'chat',
    billing: 'token',
    price: { input: 0.15, output: 0.6, cache_read: 0.075 },
    context: 128_000,
    tagline: '轻量高速版本，适合高并发与低成本场景，性价比极高。',
    latency: 0.92,
    tps: 112.5,
    health: 99,
    channels: ['OpenAI 官方', 'Azure 美东'],
  },
  {
    name: 'o3',
    vendor: 'OpenAI',
    type: 'chat',
    billing: 'token',
    price: { input: 2, output: 8, cache_read: 0.5 },
    context: 200_000,
    tagline: '深度推理模型，擅长复杂数理、代码与多步规划，响应偏慢。',
    latency: 12.4,
    tps: 38.1,
    health: 95,
    channels: ['OpenAI 官方'],
  },
  {
    name: 'gpt-image-1',
    vendor: 'OpenAI',
    type: 'image',
    billing: 'per_call',
    price: { per_call: 0.04 },
    context: 0,
    tagline: '高质量图像生成，支持透明背景与精确文字渲染，按张计费。',
    latency: 8.2,
    tps: 0,
    health: 92,
    channels: ['OpenAI 官方', 'Azure 美东'],
  },
  {
    name: 'text-embedding-3-large',
    vendor: 'OpenAI',
    type: 'embedding',
    billing: 'token',
    price: { input: 0.13 },
    context: 8_191,
    tagline: '高维语义向量模型，适合检索增强（RAG）与相似度匹配。',
    latency: 0.31,
    tps: 0,
    health: 99,
    channels: ['OpenAI 官方'],
  },
  /* ---- Anthropic ---- */
  {
    name: 'claude-sonnet-4.5',
    vendor: 'Anthropic',
    type: 'chat',
    billing: 'token',
    price: { input: 3, output: 15, cache_read: 0.3 },
    context: 200_000,
    tagline: '编码与 Agent 场景的当红主力，长上下文稳定，工具调用可靠。',
    latency: 2.1,
    tps: 55.3,
    health: 99,
    channels: ['Anthropic 官方', 'AWS Bedrock', 'GCP Vertex'],
  },
  {
    name: 'claude-opus-4.1',
    vendor: 'Anthropic',
    type: 'chat',
    billing: 'tiered',
    price: {
      input: 15,
      output: 75,
      cache_read: 1.5,
      tiers: [
        { label: '标准', input: 15, output: 75 },
        { label: '批量', input: 7.5, output: 37.5 },
      ],
    },
    context: 200_000,
    tagline: '最强推理旗舰，复杂任务质量优先，成本较高、响应偏慢。',
    latency: 4.6,
    tps: 28.4,
    health: 97,
    channels: ['Anthropic 官方', 'AWS Bedrock'],
  },
  {
    name: 'claude-haiku-4.5',
    vendor: 'Anthropic',
    type: 'chat',
    billing: 'token',
    price: { input: 1, output: 5, cache_read: 0.1 },
    context: 200_000,
    tagline: '轻量高速版本，延迟低、吞吐高，适合实时对话与批量处理。',
    latency: 1.1,
    tps: 88.6,
    health: 98,
    channels: ['Anthropic 官方', 'AWS Bedrock'],
  },
  /* ---- Google ---- */
  {
    name: 'gemini-2.5-pro',
    vendor: 'Google',
    type: 'chat',
    billing: 'tiered',
    price: {
      input: 1.25,
      output: 10,
      cache_read: 0.31,
      tiers: [
        { label: '≤200K', input: 1.25, output: 10 },
        { label: '>200K', input: 2.5, output: 15 },
      ],
    },
    context: 1_000_000,
    tagline: '超长上下文旗舰，1M token 窗口，多模态理解强，价格随长度分档。',
    latency: 3.4,
    tps: 48.7,
    health: 96,
    channels: ['GCP Vertex', 'Google AI Studio'],
  },
  {
    name: 'gemini-2.5-flash',
    vendor: 'Google',
    type: 'chat',
    billing: 'token',
    price: { input: 0.3, output: 2.5, cache_read: 0.075 },
    context: 1_000_000,
    tagline: '高速轻量多模态，长上下文与低成本兼顾，适合规模化调用。',
    latency: 1.3,
    tps: 96.2,
    health: 98,
    channels: ['GCP Vertex', 'Google AI Studio'],
  },
  {
    name: 'imagen-4',
    vendor: 'Google',
    type: 'image',
    billing: 'per_call',
    price: { per_call: 0.04 },
    context: 0,
    tagline: '写实级图像生成，细节与构图出色，按张计费。',
    latency: 6.8,
    tps: 0,
    health: 90,
    channels: ['GCP Vertex'],
  },
  /* ---- DeepSeek ---- */
  {
    name: 'deepseek-v3.2',
    vendor: 'DeepSeek',
    type: 'chat',
    billing: 'token',
    price: { input: 0.28, output: 0.42, cache_read: 0.028 },
    context: 128_000,
    tagline: '开源高性价比通用模型，中文表现优异，缓存命中价格极低。',
    latency: 2.7,
    tps: 42.3,
    health: 94,
    channels: ['DeepSeek 官方', '硅基流动'],
  },
  {
    name: 'deepseek-r1',
    vendor: 'DeepSeek',
    type: 'chat',
    billing: 'token',
    price: { input: 0.55, output: 2.19, cache_read: 0.14 },
    context: 128_000,
    tagline: '开源推理模型，思维链透明，数理与代码能力突出。',
    latency: 9.5,
    tps: 33.8,
    health: 91,
    channels: ['DeepSeek 官方', '硅基流动', '火山引擎'],
  },
  /* ---- 阿里通义 ---- */
  {
    name: 'qwen3-max',
    vendor: '阿里通义',
    type: 'chat',
    billing: 'token',
    price: { input: 1.2, output: 6, cache_read: 0.24 },
    context: 256_000,
    tagline: '通义千问旗舰，综合能力强，中英文与工具调用均衡。',
    latency: 2.9,
    tps: 51.2,
    health: 96,
    channels: ['阿里云百炼', '硅基流动'],
  },
  {
    name: 'qwen3-vl-plus',
    vendor: '阿里通义',
    type: 'chat',
    billing: 'token',
    price: { input: 0.8, output: 3.2 },
    context: 128_000,
    tagline: '视觉语言多模态，图文理解与文档解析能力强。',
    latency: 3.6,
    tps: 44.1,
    health: 93,
    channels: ['阿里云百炼'],
  },
  {
    name: 'text-embedding-v4',
    vendor: '阿里通义',
    type: 'embedding',
    billing: 'token',
    price: { input: 0.07 },
    context: 8_192,
    tagline: '通用文本向量模型，多语言检索友好，成本低廉。',
    latency: 0.28,
    tps: 0,
    health: 97,
    channels: ['阿里云百炼'],
  },
  /* ---- xAI ---- */
  {
    name: 'grok-4',
    vendor: 'xAI',
    type: 'chat',
    billing: 'token',
    price: { input: 3, output: 15, cache_read: 0.75 },
    context: 256_000,
    tagline: '实时联网大模型，接入 X 数据，时效性问题回答见长。',
    latency: 3.8,
    tps: 46.9,
    health: 89,
    channels: ['xAI 官方'],
  },
  {
    name: 'grok-4-fast',
    vendor: 'xAI',
    type: 'chat',
    billing: 'token',
    price: { input: 0.2, output: 0.5 },
    context: 2_000_000,
    tagline: '超长上下文高速版，2M 窗口，适合大文档与低延迟场景。',
    latency: 1.6,
    tps: 78.4,
    health: 85,
    channels: ['xAI 官方'],
  },
  /* ---- Moonshot ---- */
  {
    name: 'kimi-k2.5',
    vendor: 'Moonshot',
    type: 'chat',
    billing: 'token',
    price: { input: 0.6, output: 2.5, cache_read: 0.15 },
    context: 256_000,
    tagline: '长文与 Agent 能力突出，工具调用稳定，中文写作出色。',
    latency: 2.4,
    tps: 49.8,
    health: 82,
    channels: ['Moonshot 官方', '硅基流动'],
  },
  /* ---- 智谱AI ---- */
  {
    name: 'glm-4.6',
    vendor: '智谱AI',
    type: 'chat',
    billing: 'token',
    price: { input: 0.6, output: 2.2, cache_read: 0.11 },
    context: 200_000,
    tagline: 'GLM 系列旗舰，代码与推理均衡，国产合规首选之一。',
    latency: 2.6,
    tps: 47.5,
    health: 76,
    channels: ['智谱开放平台', '硅基流动'],
  },
  {
    name: 'cogview-4',
    vendor: '智谱AI',
    type: 'image',
    billing: 'per_call',
    price: { per_call: 0.03 },
    context: 0,
    tagline: '中文语义友好的图像生成，支持中文提示词与文字渲染。',
    latency: 7.4,
    tps: 0,
    health: 64,
    channels: ['智谱开放平台'],
  },
  {
    name: 'glm-4-voice',
    vendor: '智谱AI',
    type: 'audio',
    billing: 'per_call',
    price: { per_call: 0.02 },
    context: 0,
    tagline: '端到端语音模型，支持情感语调与实时对话，按次计费。',
    latency: 1.9,
    tps: 0,
    health: 58,
    channels: ['智谱开放平台'],
  },
]

export const marketModels: MarketModel[] = marketRaw.map((m, i) => ({
  ...m,
  id: i + 1,
}))

export const marketChannels: string[] = [
  ...new Set(marketModels.flatMap((m) => m.channels)),
]

export const marketVendors: string[] = [
  ...new Set(marketModels.map((m) => m.vendor)),
]

/** name → AI vendor lookup, used to populate listing.modelVendors at seed time. */
export const modelVendorMap: Record<string, string> = Object.fromEntries(
  marketModels.map((m) => [m.name, m.vendor])
)

/* ---------- seeded pseudo-random for stable demo data ---------- */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260717)

const now = Math.floor(Date.now() / 1000)
const DAY = 86_400

// Role 100 (root) matches the admin surface this demo identity already reaches:
// it owns the admin nav group and mutates channels. Leaving it at 1 would make
// every row in user management unmanageable and the page undemoable.
export const mockUser: UserInfo = {
  id: 1,
  username: 'ren2.demo',
  display_name: 'Ren2 Demo',
  email: 'demo@ren2hub.dev',
  role: 1,
  quota: 5_201_314,
  used_quota: 2_985_211,
  group: 'vip',
}

const adminChannelProviders = [
  { type: 1, name: 'OpenAI' },
  { type: 14, name: 'Claude' },
  { type: 24, name: 'Gemini' },
  { type: 43, name: 'DeepSeek' },
  { type: 17, name: 'Qwen' },
  { type: 48, name: 'Grok' },
  { type: 25, name: 'Kimi' },
  { type: 33, name: 'Bedrock' },
  { type: 40, name: 'SiliconFlow' },
  { type: 41, name: 'Vertex' },
  { type: 3, name: 'Azure' },
  { type: 57, name: 'Codex' },
] as const

const adminChannelRegions = [
  'Virginia',
  'Frankfurt',
  'Tokyo',
  'Singapore',
  'HongKong',
  'Sydney',
] as const

const adminChannelRatios = [0.52, 0.68, 0.75, 0.84, 0.92, 1, 1.08, 1.2]
const adminChannelPriceRatios = [0, 0.72, 0.85, 1, 1.08, 1.2, 1.35, 1.5]
const adminChannelCapacities = [20, 40, 60, 80, 120, 160]

export const adminChannels: AdminChannel[] = Array.from(
  { length: 32 },
  (_, index) => {
    const provider = adminChannelProviders[index % adminChannelProviders.length]
    const capacityTotal =
      adminChannelCapacities[index % adminChannelCapacities.length]
    const responseTime = index % 9 === 0 ? 0 : 240 + ((index * 347) % 5_200)
    const status: AdminChannel['status'] =
      index % 11 === 0 ? 3 : index % 7 === 0 ? 2 : 1
    const capacityUsed =
      index % 13 === 0 ? capacityTotal : (index * 17 + 9) % (capacityTotal + 1)

    return {
      id: 412 - index * 7,
      name: `${provider.name}-${adminChannelRegions[index % adminChannelRegions.length]}-${String(index + 1).padStart(2, '0')}`,
      type: provider.type,
      supplier: adminChannelTypeMeta(provider.type).supplier,
      status,
      priority: [0, 1, 5, 10, 20][index % 5],
      weight: [0, 10, 25, 50, 100][(index * 3) % 5],
      capacity_used: capacityUsed,
      capacity_total: capacityTotal,
      used_quota: (index + 2) * 385_000 + (index % 4) * 72_500,
      channel_ratio:
        adminChannelPriceRatios[index % adminChannelPriceRatios.length],
      balance:
        index % 10 === 0
          ? 0
          : Math.round((0.45 + ((index * 631) % 31_000) / 100) * 100) / 100,
      upstream_ratio: adminChannelRatios[index % adminChannelRatios.length],
      response_time: responseTime,
      test_time: responseTime === 0 ? 0 : now - (index + 1) * 1_800,
    }
  }
)

/** handle / display-name pairs cycled by the adminUsers seed. */
const adminUserSeeds = [
  ['emmahart', 'Emma Hart', 'example.com'],
  ['adamreed', 'Adam Reed', 'example.com'],
  ['coryfrye', 'Cory Frye', 'example.net'],
  ['mikeknox', 'Mike Knox', 'example.com'],
  ['leonkira', 'Leon Kira', 'example.org'],
  ['noahbell', 'Noah Bell', 'example.com'],
  ['zhaoaiwei', '赵艾维', 'example.cn'],
  ['liuwenqi', '刘文琪', 'example.cn'],
  ['chenyi', '陈屹', 'example.cn'],
  ['zhangkairui', '张凯睿', 'example.cn'],
  ['sunlei', '孙磊', 'example.cn'],
  ['wupeng', '吴鹏', 'example.cn'],
  ['gracelin', 'Grace Lin', 'example.com'],
  ['oliverwang', 'Oliver Wang', 'example.net'],
  ['mayahsu', 'Maya Hsu', 'example.com'],
  ['ethanlu', 'Ethan Lu', 'example.org'],
  ['guonina', '郭妮娜', 'example.cn'],
  ['guorui', '郭睿', 'example.cn'],
  ['xietao', '谢涛', 'example.cn'],
  ['fanlucy', '范露西', 'example.com'],
] as const

/**
 * Index 0 mirrors the demo identity, so the self-row guard is reachable in the
 * UI — it is blocked by the id check, not by rank. Index 1 is a root and 2..3
 * are admins, which sit at or above the demo operator level and make the
 * "cannot manage an equal-or-higher role" guard visible on the first page.
 */
export const adminUsers: AdminUser[] = Array.from(
  { length: 64 },
  (_, index) => {
    if (index === 0) {
      return {
        id: mockUser.id,
        username: mockUser.username,
        display_name: mockUser.display_name,
        email: mockUser.email,
        role: mockUser.role as AdminUserRole,
        status: 1 as AdminUserStatus,
        quota: mockUser.quota,
        used_quota: mockUser.used_quota,
        request_count: 8_412,
        invited_count: 12,
        affiliate_quota: 486_000,
        inviter_id: 0,
        created_time: now - 640 * DAY,
        last_login_time: now - 900,
      }
    }

    const seed = adminUserSeeds[(index - 1) % adminUserSeeds.length]!
    const [handle, displayName, domain] = seed
    const suffix = String(1000 + ((index * 617) % 8999))
    const role: AdminUserRole =
      index === 1 ? 100 : index <= 3 ? 10 : index % 17 === 0 ? 0 : 1
    const status: AdminUserStatus = index % 9 === 0 ? 2 : 1

    const usedQuota = (index * 137_500 + (index % 5) * 41_000) % 9_400_000
    const remainQuota =
      index % 12 === 0
        ? 0
        : index % 7 === 0
          ? Math.round(usedQuota * 0.04)
          : 620_000 + ((index * 733_000) % 14_800_000)
    const invited = index % 4 === 0 ? (index * 3) % 19 : 0

    return {
      id: 2400 - (index - 1) * 7,
      username: `${handle}${suffix}`,
      display_name: index % 6 === 0 ? '' : displayName,
      email: `${handle}${suffix}@${domain}`,
      role,
      status,
      quota: remainQuota,
      used_quota: usedQuota,
      request_count: (index * 419) % 24_000,
      invited_count: invited,
      affiliate_quota: invited > 0 ? invited * 21_500 : 0,
      inviter_id: index % 3 === 0 ? 2400 - ((index * 5) % 60) * 7 : 0,
      created_time: now - (index * 9 + 3) * DAY,
      last_login_time:
        index % 15 === 0 ? 0 : now - (index * 2_600 + (index % 7) * 900),
    }
  }
)

function randomKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = 'sk-'
  for (let i = 0; i < 40; i++) out += chars[Math.floor(rand() * chars.length)]
  return out
}

const ch = (name: string, enabled = true, weight?: number): TokenChannel =>
  weight === undefined ? { name, enabled } : { name, enabled, weight }

export const tokens: TokenItem[] = (
  [
    // name, type, status, group, model_limits, remain, unlimited, rate_limit, max_ratio, load_balance, channels
    [
      '生产环境主 Key',
      'auto',
      1,
      'default',
      [],
      9_999_999,
      true,
      0,
      1.5,
      false,
      [],
    ],
    [
      'Chatbox 客户端',
      'manual',
      1,
      'default',
      ['gpt-4o', 'gpt-4o-mini'],
      500_000,
      false,
      60,
      undefined,
      false,
      [ch('OpenAI 官方'), ch('Azure 美东')],
    ],
    [
      'NextChat 网页端',
      'manual',
      1,
      'vip',
      [],
      2_000_000,
      false,
      0,
      undefined,
      true,
      [
        ch('OpenAI 官方', true, 2),
        ch('Azure 美东', true, 1),
        ch('Azure 欧西', false, 1),
      ],
    ],
    [
      'CI 自动化测试',
      'manual',
      2,
      'default',
      ['deepseek-v3.2'],
      300_000,
      false,
      120,
      undefined,
      false,
      [ch('DeepSeek 官方'), ch('硅基流动')],
    ],
    [
      'Claude Code 专用',
      'manual',
      1,
      'vip',
      ['claude-sonnet-4.5', 'claude-opus-4.1'],
      5_000_000,
      false,
      0,
      2,
      false,
      [ch('星链 API'), ch('砺石智汇', false)],
    ],
    ['临时调试', 'auto', 2, 'default', [], 100_000, false, 30, 1.2, false, []],
    [
      '团队共享',
      'manual',
      1,
      'svip',
      [],
      20_000_000,
      false,
      0,
      3,
      true,
      [
        ch('云枢智算', true, 3),
        ch('方舟接入', true, 2),
        ch('流沙聚合', true, 1),
      ],
    ],
    [
      'LobeChat',
      'manual',
      1,
      'default',
      ['gpt-4o', 'gemini-2.5-pro'],
      800_000,
      false,
      0,
      undefined,
      false,
      [ch('OpenAI 官方'), ch('GCP Vertex')],
    ],
  ] as Array<
    [
      string,
      TokenType,
      1 | 2,
      string,
      string[],
      number,
      boolean,
      number,
      number | undefined,
      boolean,
      TokenChannel[],
    ]
  >
).map(
  (
    [
      name,
      type,
      status,
      group,
      limits,
      remain,
      unlimited,
      rateLimit,
      maxRatio,
      loadBalance,
      channels,
    ],
    i
  ) => ({
    id: i + 1,
    name,
    key: randomKey(),
    type,
    status,
    used_quota: Math.floor(rand() * 900_000),
    remain_quota: remain,
    unlimited,
    group,
    model_limits: limits,
    ip_limits: i === 0 ? ['120.244.0.0/16'] : [],
    rate_limit: rateLimit,
    max_ratio: maxRatio,
    load_balance: loadBalance,
    channels,
    expired_time: i === 3 ? now + 30 * DAY : -1,
    created_time: now - Math.floor(rand() * 220) * DAY,
  })
)

const logModels = [
  'gpt-4o',
  'claude-sonnet-4.5',
  'gemini-2.5-pro',
  'deepseek-v3.2',
  'gpt-4o-mini',
  'kimi-k2.5',
  'qwen3-max',
  'grok-4',
]

const logChannels: Record<string, string> = {
  'gpt-4o': 'OpenAI 官方',
  'gpt-4o-mini': 'Azure 美东',
  'claude-sonnet-4.5': 'Anthropic 官方',
  'gemini-2.5-pro': 'GCP Vertex',
  'deepseek-v3.2': '硅基流动',
  'kimi-k2.5': 'Moonshot 官方',
  'qwen3-max': '阿里云百炼',
  'grok-4': 'xAI 官方',
}

// Six log types distributed across 67 rows for realistic demo data
const LOG_TYPES: LogType[] = [
  'consume',
  'consume',
  'consume',
  'consume',
  'topup',
  'refund',
  'manage',
  'error',
  'system',
  'consume',
  'consume',
]

const logTokenNames = [
  '生产环境主 Key',
  'Chatbox 客户端',
  'NextChat 网页端',
  'Claude Code 专用',
  'LobeChat',
  '团队共享',
]

export const logs: LogItem[] = Array.from({ length: 67 }, (_, i) => {
  const type: LogType = LOG_TYPES[i % LOG_TYPES.length]
  const isConsume = type === 'consume'
  const isError = type === 'error'
  const model =
    isConsume || isError
      ? logModels[Math.floor(rand() * logModels.length)]
      : '—'
  const channel =
    isConsume || isError ? (logChannels[model] ?? 'OpenAI 官方') : '—'
  const tokenName =
    isConsume || isError
      ? logTokenNames[Math.floor(rand() * logTokenNames.length)]
      : '—'
  const prompt = isConsume || isError ? Math.floor(rand() * 6000) + 200 : 0
  const completion = isConsume ? Math.floor(rand() * 2000) + 50 : 0
  const isRequest = isConsume || isError
  const requestSequence = Math.floor(i / LOG_TYPES.length)
  let requestMode: LogRequestMode | null = null
  if (isRequest) {
    requestMode = requestSequence % 3 === 1 ? 'sync' : 'stream'
  }
  // Keep most calls quick while preserving deterministic slow and minute-long rows.
  const latencyBand = i % 10
  const latency = isConsume
    ? Math.round(
        (latencyBand < 6
          ? 0.5 + rand() * 8.5
          : latencyBand < 8
            ? 10 + rand() * 19
            : latencyBand === 8
              ? 30 + rand() * 25
              : 65 + rand() * 45) * 100
      ) / 100
    : isError
      ? Math.round((15 + rand() * 30) * 100) / 100
      : 0
  const firstTokenLatency =
    requestMode === 'stream' && isConsume && i % 13 !== 0
      ? Math.round(
          Math.min(latency, 0.25 + rand() * Math.max(0.25, latency * 0.7)) * 100
        ) / 100
      : null
  const cacheProfile = isRequest ? requestSequence % 5 : -1
  let cacheReadTokens: number | null = null
  if (cacheProfile === 0) {
    cacheReadTokens = Math.floor(rand() * 140_000) + 40_000
  } else if (cacheProfile === 1 || cacheProfile === 2) {
    cacheReadTokens = Math.floor(rand() * 42_000) + 2_000
  }
  let cacheWriteTokens: number | null = null
  if (cacheProfile === 0 || cacheProfile === 2 || cacheProfile === 3) {
    cacheWriteTokens = Math.floor(rand() * 18_000) + 300
  }
  const cacheTtl =
    cacheWriteTokens === null ? null : cacheProfile % 2 === 0 ? '5m' : '1h'
  // tps: only meaningful for consume (non-zero completion)
  const tps = isConsume && latency > 0 ? Math.round(completion / latency) : 0

  const contentMap: Record<LogType, string> = {
    consume: '调用成功',
    topup: '在线充值到账',
    refund: '退款已处理',
    manage: '管理员调整额度',
    error: '上游超时，未计费',
    system: '系统赠送额度',
  }

  return {
    id: 9000 - i,
    type,
    token_name: tokenName,
    model,
    channel,
    prompt_tokens: prompt,
    completion_tokens: completion,
    cache_read_tokens: cacheReadTokens,
    cache_write_tokens: cacheWriteTokens,
    cache_ttl: cacheTtl,
    quota:
      type === 'topup'
        ? 2_500_000
        : type === 'refund'
          ? Math.floor(rand() * 500_000) + 100_000
          : type === 'manage'
            ? Math.floor(rand() * 1_000_000) + 200_000
            : isConsume
              ? Math.floor((prompt + completion * 3) * (0.8 + rand()))
              : 0,
    latency,
    first_token_latency: firstTokenLatency,
    request_mode: requestMode,
    tps,
    content: contentMap[type],
    created: now - Math.floor(i * 0.7 * DAY) - Math.floor(rand() * DAY),
  }
}).sort((a, b) => b.created - a.created)

export const topupRecords: TopupRecord[] = Array.from(
  { length: 12 },
  (_, i) => {
    const method = (['epay', 'stripe', 'creem', 'redeem'] as const)[i % 4]
    const amount = [5, 10, 20, 50][Math.floor(rand() * 4)]
    return {
      id: 700 - i,
      trade_no: `T${20260}${String(5100 + i * 37)}${String(100000 + Math.floor(rand() * 899999))}`,
      amount,
      money: amount * QUOTA_PER_DOLLAR,
      method,
      status: i === 2 ? 'pending' : i === 7 ? 'failed' : 'success',
      created: now - i * 6 * DAY - Math.floor(rand() * DAY),
    }
  }
)

export const plans: Plan[] = [
  {
    id: 1,
    name: '轻量版',
    price: 5,
    quota: 10_000_000,
    duration_days: 30,
    features: ['全部公开模型', 'default 分组', '社区支持'],
    gradient: 'signal',
  },
  {
    id: 2,
    name: '专业版',
    price: 20,
    quota: 60_000_000,
    duration_days: 30,
    features: ['全部公开模型', 'vip 分组高速通道', '优先客服', '用量分析报表'],
    gradient: 'accent',
    recommended: true,
  },
  {
    id: 3,
    name: '团队版',
    price: 80,
    quota: 300_000_000,
    duration_days: 30,
    features: ['svip 专属通道', '多成员协作', '专属客户经理', '发票与合同'],
    gradient: 'support',
  },
]

/* ---------- administration orders ---------- */

/**
 * Deliberately its own PRNG instance. The shared `rand()` above is consumed in
 * declaration order by every seed in this file, so drawing from it here would
 * shift each downstream value (topup records, flow series, market listings) and
 * silently rewrite data other specs already assert on.
 */
const orderRand = mulberry32(20260725)

const ORDER_SEED_DAYS = 90

/** Subscription subjects name the actual plan, so they are built per order. */
const orderSubjects: Record<
  Exclude<AdminOrderType, 'subscription'>,
  readonly string[]
> = {
  topup: ['账户余额充值', '额度充值', '余额快捷充值'],
  market: ['市场渠道购买', '渠道额度包', '第三方渠道接入'],
}

/** Weighted so the two domestic wallets dominate, as they do in production. */
const orderMethodWeights: ReadonlyArray<[AdminOrderMethod, number]> = [
  ['alipay', 0.58],
  ['wechat', 0.24],
  ['stripe', 0.12],
  ['creem', 0.06],
]

const ORDER_AMOUNTS = [3.5, 5, 10, 15, 20, 30, 50] as const

function orderNoSuffix(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(orderRand() * chars.length)]
  }
  return out
}

function orderDateKey(epochSec: number): string {
  const date = new Date(epochSec * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

function pickOrderMethod(): AdminOrderMethod {
  const roll = orderRand()
  let cursor = 0
  for (const [method, weight] of orderMethodWeights) {
    cursor += weight
    if (roll < cursor) return method
  }
  return 'alipay'
}

function pickOrderSubject(
  type: Exclude<AdminOrderType, 'subscription'>
): string {
  const pool = orderSubjects[type]
  return pool[Math.floor(orderRand() * pool.length)]!
}

/** Guests (role 0) never reach checkout, so they are not payers. */
const orderPayers = adminUsers.filter((user) => user.role >= 1)

export const adminOrders: AdminOrder[] = (() => {
  const out: AdminOrder[] = []
  let id = 251

  for (let day = 0; day < ORDER_SEED_DAYS; day++) {
    // Volume stays at zero for the first few days and then ramps, so the 7 /
    // 30 / 90 day ranges each render a distinct shape instead of one flat line.
    const ramp = Math.min(1, Math.max(0, (day - 4) / 26))
    const perDay =
      day < 5 ? 0 : Math.round(1 + ramp * 8 + orderRand() * (2 + ramp * 6))
    const dayStart = now - (ORDER_SEED_DAYS - 1 - day) * DAY

    for (let n = 0; n < perDay; n++) {
      const payer = orderPayers[Math.floor(orderRand() * orderPayers.length)]!
      const typeRoll = orderRand()
      const type: AdminOrderType =
        typeRoll < 0.62 ? 'topup' : typeRoll < 0.88 ? 'subscription' : 'market'
      const plan = plans[Math.floor(orderRand() * plans.length)]!
      const amount =
        type === 'subscription'
          ? plan.price
          : ORDER_AMOUNTS[Math.floor(orderRand() * ORDER_AMOUNTS.length)]!
      // Clamped to `now`: the last day is only partly elapsed, and an order
      // stamped in the future would pass a trailing-window filter while falling
      // outside every daily bucket the same window builds.
      const created = Math.min(now, dayStart + Math.floor(orderRand() * DAY))
      // Only a recent order can still be awaiting payment — gateways expire the
      // rest — but the rate inside that window is set high enough that the
      // pending facet has rows to filter rather than a single lonely order.
      const isRecent = day >= ORDER_SEED_DAYS - 3

      const statusRoll = orderRand()
      let status: AdminOrderStatus
      if (isRecent && statusRoll < 0.35) status = 'pending'
      else if (statusRoll < 0.79) status = 'completed'
      else if (statusRoll < 0.86) status = 'cancelled'
      else if (statusRoll < 0.94) status = 'expired'
      else if (statusRoll < 0.97) status = 'refunded'
      else status = 'completed'

      const settled = status === 'completed' || status === 'refunded'
      const prefix =
        type === 'subscription'
          ? `sub${plan.id}`
          : type === 'topup'
            ? 'top'
            : 'mkt'

      out.push({
        id: id++,
        order_no: `${prefix}_${orderDateKey(created)}${orderNoSuffix(8)}`,
        user_id: payer.id,
        username: payer.username,
        email: payer.email,
        amount,
        quota: Math.round(amount * QUOTA_PER_DOLLAR),
        type,
        method: pickOrderMethod(),
        status,
        subject:
          type === 'subscription'
            ? `${plan.name} · ${plan.duration_days} 天`
            : pickOrderSubject(type),
        created,
        // Both derived stamps are clamped for the same reason as `created`:
        // a settlement cannot be recorded ahead of the current clock.
        paid_at: settled
          ? Math.min(now, created + 30 + Math.floor(orderRand() * 900))
          : 0,
        refunded_at:
          status === 'refunded'
            ? Math.min(now, created + DAY + Math.floor(orderRand() * 3 * DAY))
            : 0,
      })
    }
  }

  // Newest first, matching every other admin list's default ordering.
  return out.reverse()
})()

export const currentSubscription: CurrentSubscription = {
  plan_id: 2,
  name: '专业版',
  total_quota: 60_000_000,
  remain_quota: 41_773_482,
  expire_time: now + 18 * DAY,
  auto_renew: true,
}

export const inviteInfo: InviteInfo = {
  code: 'BIGD2026',
  invited: 23,
  rate: 0.02,
  reward_total: 4_600_000,
  transferable: 1_150_000,
  pending_reward: 0,
  qualification: {
    token_used: mockUser.used_quota, // 2.98M, past the threshold below
    token_required: 2_000_000, // spend threshold to unlock referral
    topup_total: 260 * QUOTA_PER_DOLLAR,
    topup_required: 5 * QUOTA_PER_DOLLAR, // $5 minimum top-up
    qualified: true, // both thresholds met → eligible
  },
  unlock_channels: [
    { id: 'vip', name: 'vip 高速通道', detail: '', unlocked: true },
    { id: 'gptpro', name: 'GPTPRO', detail: '×0.03 计费', unlocked: true },
    {
      id: 'domestic',
      name: '国产特惠分组',
      detail: '×0.1 计费',
      unlocked: true,
    },
  ],
  monthly_series: (() => {
    let cumulative = 0
    return Array.from({ length: 6 }, (_, i) => {
      const newCount = i === 4 ? 1 : Math.floor(rand() * 4)
      cumulative += newCount
      const d = new Date((now - (5 - i) * 30 * DAY) * 1000)
      return { month: `${d.getMonth() + 1}月`, new_count: newCount, cumulative }
    })
  })(),
  records: Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    invitee: `user_${1000 + i * 7}`,
    reward: i === 7 ? 0 : 200_000,
    status: (i === 7 ? 'pending' : 'valid') as InviteRecordStatus,
    created: now - i * 4 * DAY - Math.floor(rand() * DAY),
  })),
}

/* Dashboard 30-day series + model share */
export const flowSeries = Array.from({ length: 30 }, (_, i) => {
  const consume = Math.floor(60_000 + rand() * 240_000)
  const requests = Math.floor(180 + rand() * 900)
  return {
    date: new Date((now - (29 - i) * DAY) * 1000).toISOString().slice(5, 10),
    consume,
    requests,
    topup: i === 12 || i === 26 ? 10_000_000 : 0,
  }
})

/**
 * Per-model breakdown. `quota` is what the account was actually billed;
 * `standard_quota` is the same traffic at list price, so the overview table can
 * show the discount side by side. Static literals on purpose — see the PRNG
 * ordering note at the top of this file.
 */
/**
 * A long tail on purpose: the overview list scrolls through every model while
 * the donut plots only the top slice and folds the remainder into one bucket, so
 * the seed has to be longer than that cut-off to exercise both paths. There is
 * deliberately no literal '其他' row — that bucket is derived at render time and
 * a hard-coded one would collide with it.
 */
export const modelShare = [
  {
    model: 'claude-sonnet-4.5',
    quota: 1_426_392,
    standard_quota: 1_705_248,
    requests: 3_567,
    tokens: 888_040_000,
  },
  {
    model: 'gpt-4o',
    quota: 752_213,
    standard_quota: 941_264,
    requests: 1_597,
    tokens: 115_020_000,
  },
  {
    model: 'deepseek-v3.2',
    quota: 462_708,
    standard_quota: 528_192,
    requests: 1_022,
    tokens: 106_610_000,
  },
  {
    model: 'claude-opus-4.6',
    quota: 318_940,
    standard_quota: 402_460,
    requests: 214,
    tokens: 41_280_000,
  },
  {
    model: 'gemini-2.5-pro',
    quota: 241_508,
    standard_quota: 296_920,
    requests: 486,
    tokens: 62_740_000,
  },
  {
    model: 'gpt-4o-mini',
    quota: 138_264,
    standard_quota: 172_830,
    requests: 2_845,
    tokens: 88_150_000,
  },
  {
    model: 'claude-haiku-4.5',
    quota: 96_720,
    standard_quota: 120_900,
    requests: 1_930,
    tokens: 54_310_000,
  },
  {
    model: 'qwen-max',
    quota: 74_180,
    standard_quota: 91_360,
    requests: 612,
    tokens: 29_870_000,
  },
  {
    model: 'gemini-2.5-flash',
    quota: 52_940,
    standard_quota: 66_180,
    requests: 1_408,
    tokens: 47_620_000,
  },
  {
    model: 'deepseek-r1',
    quota: 41_306,
    standard_quota: 52_940,
    requests: 298,
    tokens: 18_450_000,
  },
  {
    model: 'glm-4.6',
    quota: 28_712,
    standard_quota: 35_890,
    requests: 341,
    tokens: 12_980_000,
  },
  {
    model: 'kimi-k2',
    quota: 19_480,
    standard_quota: 24_350,
    requests: 187,
    tokens: 9_640_000,
  },
  {
    model: 'mistral-large-3',
    quota: 12_360,
    standard_quota: 15_450,
    requests: 96,
    tokens: 5_210_000,
  },
  {
    model: 'gpt-image-2',
    quota: 8_940,
    standard_quota: 11_180,
    requests: 62,
    tokens: 1_480_000,
  },
  {
    model: 'text-embedding-4',
    quota: 3_180,
    standard_quota: 3_975,
    requests: 1_204,
    tokens: 24_060_000,
  },
].map((m) => ({ ...m, ratio: 0 }))

const shareTotal = modelShare.reduce((s, m) => s + m.quota, 0)
modelShare.forEach((m) => {
  m.ratio = Math.round((m.quota / shareTotal) * 1000) / 10
})

export const dashboardStats = {
  quota: mockUser.quota,
  used_quota: mockUser.used_quota,
  today_quota: 96_402,
  today_requests: 312,
  total_requests: 18_764,
  month_quota_delta: 16.2,
  month_requests_delta: -5.8,
}

/** RPM ceiling per group. 0 means unmetered. */
const GROUP_RPM: Record<string, number> = {
  default: 60,
  vip: 300,
  svip: 0,
}

const GROUP_DISCOUNT: Record<string, number> = {
  default: 1.0,
  vip: 0.95,
  svip: 0.85,
}

const GLOBAL_DISCOUNT = 0.88

export function buildDashboardLimits(group: string) {
  const rateLimit = GROUP_RPM[group] ?? GROUP_RPM.default!
  // Unmetered groups still report observed throughput so the meter has a value.
  const currentRpm = rateLimit === 0 ? 118 : Math.round(rateLimit * 0.47)
  return { group, rate_limit: rateLimit, current_rpm: currentRpm }
}

export function buildDashboardDiscounts(group: string) {
  const groupRatio = GROUP_DISCOUNT[group] ?? 1.0
  return {
    global_ratio: GLOBAL_DISCOUNT,
    group_ratio: groupRatio,
    effective_ratio: Math.round(GLOBAL_DISCOUNT * groupRatio * 1000) / 1000,
  }
}

export const tickets: TicketItem[] = [
  {
    id: 1,
    title: 'API 调用返回 429 错误',
    category: 'api',
    priority: 'high',
    status: 'replied',
    reply_count: 3,
    last_reply_role: 'support',
    request_id: 'req_abc123xyz',
    created: now - 2 * DAY,
    updated: now - 3600,
    messages: [
      {
        id: 1,
        role: 'user',
        content:
          '使用 gpt-4 模型频繁收到 429 错误，请求 ID 为 req_abc123xyz，已经等待 10 分钟仍然无法恢复。',
        images: [],
        created: now - 2 * DAY,
      },
      {
        id: 2,
        role: 'support',
        department: 'tech',
        content:
          '您好，已确认该时段上游 OpenAI 出现限流。我们已切换到备用渠道，请重试。同时为您的账户增加了 10 元补偿额度。',
        images: [],
        created: now - 2 * DAY + 7200,
      },
      {
        id: 3,
        role: 'user',
        content: '已恢复正常，感谢处理！',
        images: [],
        created: now - 3600,
      },
    ],
  },
  {
    id: 2,
    title: '账单明细导出功能异常',
    category: 'billing',
    priority: 'normal',
    status: 'replied',
    reply_count: 2,
    last_reply_role: 'support',
    created: now - 5 * 3600,
    updated: now - 2 * 3600,
    messages: [
      {
        id: 4,
        role: 'user',
        content: '导出 7 月份账单时页面一直转圈，无法下载 CSV 文件。',
        images: [],
        created: now - 5 * 3600,
      },
      {
        id: 8,
        role: 'support',
        department: 'finance',
        content:
          '您好，已核对您的账单数据。7 月账单较大，导出耗时略长，现已为您在后台生成并发送至账户邮箱，请注意查收。',
        images: [],
        created: now - 2 * 3600,
      },
    ],
  },
  {
    id: 3,
    title: 'Claude 模型响应速度慢',
    category: 'model',
    priority: 'low',
    status: 'closed',
    reply_count: 3,
    last_reply_role: 'support',
    model_id: 'claude-3-opus',
    created: now - 7 * DAY,
    updated: now - 6 * DAY,
    messages: [
      {
        id: 5,
        role: 'user',
        content: 'claude-3-opus 模型最近几天响应时间超过 30 秒，其他模型正常。',
        images: [],
        created: now - 7 * DAY,
      },
      {
        id: 6,
        role: 'support',
        department: 'tech',
        content:
          'Anthropic 官方近期负载较高，我们已增加备用通道。当前平均延迟已降至 8 秒以内。',
        images: [],
        created: now - 6.5 * DAY,
      },
      {
        id: 7,
        role: 'system',
        content: '工单已关闭',
        images: [],
        created: now - 6 * DAY,
      },
    ],
  },
]

const activityNow = Math.floor(Date.now() / 1000)
const activityDay = 86_400

export const activities: Activity[] = [
  {
    id: 1,
    kind: 'checkin',
    title: '每日签到',
    tagline: '连续签到 7 天，奖励阶梯递增',
    status: 'ongoing',
    gradient: 'accent',
    badgeKey: 'hot',
    start: activityNow - 3 * activityDay,
    end: activityNow + 27 * activityDay,
    icon: 'M8 2v4M16 2v4M3 8h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    checkin: {
      days: Array.from({ length: 7 }, (_, i) => ({
        done: i < 3,
        reward: 10_000 * (i + 1),
      })),
      todayClaimed: false,
      streak: 3,
      total_days: 45,
      month_days: 18,
      month_days_total: 31,
      total_reward: 1_260_000,
      month_reward: 420_000,
      best_streak: 14,
      // Week of Mon Jul 20 – Sun Jul 26, 2026 (today = Thu Jul 23)
      week_entries: [
        {
          date: '07/20',
          weekday: 'MON',
          reward: 0,
          claimed: false,
          today: false,
        },
        {
          date: '07/21',
          weekday: 'TUE',
          reward: 10_000,
          claimed: true,
          today: false,
        },
        {
          date: '07/22',
          weekday: 'WED',
          reward: 20_000,
          claimed: true,
          today: false,
        },
        {
          date: '07/23',
          weekday: 'THU',
          reward: 30_000,
          claimed: false,
          today: true,
        },
        {
          date: '07/24',
          weekday: 'FRI',
          reward: 0,
          claimed: false,
          today: false,
        },
        {
          date: '07/25',
          weekday: 'SAT',
          reward: 0,
          claimed: false,
          today: false,
        },
        {
          date: '07/26',
          weekday: 'SUN',
          reward: 0,
          claimed: false,
          today: false,
        },
      ],
    },
  },
  {
    id: 2,
    kind: 'newcomer',
    title: '新人礼包',
    tagline: '完成新手任务，一键领取全部奖励',
    status: 'ongoing',
    gradient: 'signal',
    badgeKey: 'new',
    start: activityNow - 10 * activityDay,
    end: activityNow + 60 * activityDay,
    icon: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7ZM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z',
    newcomer: {
      tasks: [
        {
          id: 'first-key',
          labelKey: 'activity.newcomer.taskFirstKey',
          reward: 20_000,
          done: true,
        },
        {
          id: 'first-call',
          labelKey: 'activity.newcomer.taskFirstCall',
          reward: 30_000,
          done: true,
        },
        {
          id: 'profile',
          labelKey: 'activity.newcomer.taskProfile',
          reward: 10_000,
          done: false,
        },
        {
          id: 'topup',
          labelKey: 'activity.newcomer.taskTopup',
          reward: 50_000,
          done: false,
        },
      ],
      claimed: false,
    },
  },
  {
    id: 4,
    kind: 'invite',
    title: '邀请返利',
    tagline: '邀请好友，共享消费返利',
    status: 'ongoing',
    gradient: 'signal',
    start: activityNow - 90 * activityDay,
    end: activityNow + 365 * activityDay,
    icon: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM19 8v6M22 11h-6',
    invite: {
      invited: inviteInfo.invited,
      reward_total: inviteInfo.reward_total,
      rate: inviteInfo.rate,
    },
  },
]

export const activitySummary: ActivitySummary = {
  claimable: 2,
  reward_earned: 4_600_000,
  ongoing: activities.filter((a) => a.status === 'ongoing').length,
}
const merchantSeed: Array<[string, MerchantScale, boolean]> = [
  // name, scale, verified
  ['云枢智算', 'empire', true],
  ['星链 API', 'empire', true],
  ['极光中转', 'studio', true],
  ['海豚算力', 'studio', true],
  ['方舟接入', 'empire', true],
  ['清水湾节点', 'workshop', false],
  ['磐石供应', 'studio', true],
  ['长风渠道', 'vendor', false],
  ['光年直连', 'studio', true],
  ['砺石智汇', 'empire', true],
  ['青鸟中枢', 'workshop', false],
  ['流沙聚合', 'studio', true],
  ['寒山工作室', 'workshop', false],
  ['银弧算力', 'studio', true],
  ['子夜供货', 'vendor', false],
  ['鲲鹏接入', 'empire', true],
  ['溪源节点', 'workshop', false],
  ['天工中转', 'studio', true],
]

/** Official first-party merchant; listed first so its group renders on top. */
const PLATFORM_MERCHANT_ID = 19

const commentUserPool = [
  '青柠',
  '老白',
  'Neo',
  '阿蛮',
  '数羊人',
  'Kova',
  '临江仙',
  '半糖',
  '仲夏',
  'Riven',
  '拾荒客',
  '苏打绿茶',
  '牧云',
  'Echo',
  '一只柯基',
]

const commentTextPool = [
  '接入两周了，高峰期也没掉过链子，稳。',
  '延迟比官方直连还低一点，不知道怎么做到的。',
  '客服响应很快，半夜提工单十分钟就回了。',
  '价格是真便宜，但偶尔会限流，轻量场景够用。',
  '跑批任务连续三天没断流，值得推荐。',
  '流式输出偶发卡顿，反馈后第二天就修复了。',
  '模型列表更新很及时，新模型上得快。',
  '用了一个月，账单清晰透明，没有暗坑。',
  '并发上到 200 也没报错，压测数据可信。',
  '有一次故障切换生效了，几乎无感知。',
  '文档和示例齐全，接入成本很低。',
  '客单小但服务态度好，适合个人开发者。',
  '晚高峰速度会降一些，介意的慎选。',
  '发票流程顺畅，公司报销无压力。',
  '换过三家中转，最后留下来的就这家。',
]

let nextCommentId = 1
/** Deterministically pick 2-5 comments for a merchant, newest first. */
function seedComments(): MerchantComment[] {
  const count = 2 + Math.floor(rand() * 4)
  const used = new Set<number>()
  const out: MerchantComment[] = []
  for (let i = 0; i < count; i++) {
    let idx = Math.floor(rand() * commentTextPool.length)
    while (used.has(idx)) idx = (idx + 1) % commentTextPool.length
    used.add(idx)
    out.push({
      id: nextCommentId++,
      user: commentUserPool[Math.floor(rand() * commentUserPool.length)],
      content: commentTextPool[idx],
      createdAt: now - Math.floor(rand() * 90) * DAY - Math.floor(rand() * DAY),
    })
  }
  return out.sort((a, b) => b.createdAt - a.createdAt)
}

export const marketMerchants: Merchant[] = [
  {
    id: PLATFORM_MERCHANT_ID,
    name: '人人平台',
    scale: 'platform',
    comments: seedComments(),
    verified: true,
    channelCount: 0,
    joinedAt: now - 1200 * DAY,
  },
  ...merchantSeed.map(([name, scale, verified], i): Merchant => ({
    id: i + 1,
    name,
    scale,
    comments: seedComments(),
    verified,
    // Filled after listings are generated (distinct sources per merchant).
    channelCount: 0,
    joinedAt: now - Math.floor(120 + rand() * 900) * DAY,
  })),
]

/**
 * Base offers seeded across merchants. Each references a real model name from
 * MODELS/marketRaw so the supported-models preview reads as production data.
 * priceUSD is intentionally slightly cheaper/dearer than the plaza list price
 * to make comparison meaningful.
 */
const listingSeed: Array<{
  merchantId: number
  title: string
  summary: string
  models: string[]
  type: MarketModelType
  priceUSD: number
}> = [
  {
    merchantId: 1,
    title: 'GPT-4o 高速供应',
    summary: '官方直连 + Azure 双通道热备，故障秒级切换。',
    models: ['gpt-4o', 'gpt-4o-mini'],
    type: 'chat',
    priceUSD: 2.3,
  },
  {
    merchantId: 1,
    title: 'o3 推理专线',
    summary: '深度推理模型独立限流池，长任务不打断。',
    models: ['o3'],
    type: 'chat',
    priceUSD: 1.9,
  },
  {
    merchantId: 2,
    title: 'Claude 4.5 全家桶',
    summary: 'Sonnet / Opus / Haiku 统一入口，长上下文稳定。',
    models: ['claude-sonnet-4.5', 'claude-opus-4.1', 'claude-haiku-4.5'],
    type: 'chat',
    priceUSD: 2.9,
  },
  {
    merchantId: 2,
    title: 'Claude Haiku 极速供应',
    summary: '低延迟高吞吐，适合实时对话与批处理。',
    models: ['claude-haiku-4.5'],
    type: 'chat',
    priceUSD: 0.95,
  },
  {
    merchantId: 3,
    title: 'Gemini 2.5 Pro 长文供应',
    summary: '1M token 窗口，多模态理解，价格随长度分档。',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    type: 'chat',
    priceUSD: 1.2,
  },
  {
    merchantId: 4,
    title: 'DeepSeek 高性价比池',
    summary: '国产开源旗舰，缓存命中价格极低，中文优异。',
    models: ['deepseek-v3.2', 'deepseek-r1'],
    type: 'chat',
    priceUSD: 0.26,
  },
  {
    merchantId: 5,
    title: 'GPT-4o 企业级供应',
    summary: '企业 SLA 保障，独享配额，发票与合同齐全。',
    models: ['gpt-4o'],
    type: 'chat',
    priceUSD: 2.5,
  },
  {
    merchantId: 5,
    title: 'gpt-image-1 出图供应',
    summary: '高质量图像生成，支持透明背景，按张计费。',
    models: ['gpt-image-1'],
    type: 'image',
    priceUSD: 0.038,
  },
  {
    merchantId: 5,
    title: 'Embedding 向量供应',
    summary: '高维语义向量，RAG 检索友好，成本低廉。',
    models: ['text-embedding-3-large'],
    type: 'embedding',
    priceUSD: 0.12,
  },
  {
    merchantId: 6,
    title: 'DeepSeek 特惠中转',
    summary: '个人节点，价格亲民，适合轻量试用。',
    models: ['deepseek-v3.2'],
    type: 'chat',
    priceUSD: 0.22,
  },
  {
    merchantId: 7,
    title: 'Qwen3 通义供应',
    summary: '通义千问旗舰，中英文与工具调用均衡。',
    models: ['qwen3-max', 'qwen3-vl-plus'],
    type: 'chat',
    priceUSD: 1.1,
  },
  {
    merchantId: 8,
    title: 'Kimi 长文中转',
    summary: '长文与 Agent 能力突出，价格随行就市。',
    models: ['kimi-k2.5'],
    type: 'chat',
    priceUSD: 0.58,
  },
  {
    merchantId: 9,
    title: 'Grok-4 实时供应',
    summary: '实时联网大模型，时效性问题回答见长。',
    models: ['grok-4', 'grok-4-fast'],
    type: 'chat',
    priceUSD: 2.8,
  },
  {
    merchantId: 10,
    title: 'Claude Sonnet 直连专线',
    summary: '官方直连低延迟专线，编码与 Agent 首选。',
    models: ['claude-sonnet-4.5'],
    type: 'chat',
    priceUSD: 2.85,
  },
  {
    merchantId: 10,
    title: 'GLM-4.6 国产合规供应',
    summary: '智谱旗舰，代码与推理均衡，国产合规首选。',
    models: ['glm-4.6'],
    type: 'chat',
    priceUSD: 0.55,
  },
  {
    merchantId: 11,
    title: 'Gemini Flash 廉价池',
    summary: '高速轻量多模态，适合规模化调用。',
    models: ['gemini-2.5-flash'],
    type: 'chat',
    priceUSD: 0.28,
  },
  {
    merchantId: 12,
    title: '多模型聚合网关',
    summary: '一个入口聚合主流模型，自动路由最优渠道。',
    models: ['gpt-4o', 'claude-sonnet-4.5', 'gemini-2.5-pro', 'deepseek-v3.2'],
    type: 'chat',
    priceUSD: 1.6,
  },
  {
    merchantId: 13,
    title: 'imagen-4 出图节点',
    summary: '写实级图像生成，细节与构图出色。',
    models: ['imagen-4'],
    type: 'image',
    priceUSD: 0.042,
  },
  {
    merchantId: 14,
    title: 'Claude Opus 旗舰供应',
    summary: '最强推理旗舰，复杂任务质量优先。',
    models: ['claude-opus-4.1'],
    type: 'chat',
    priceUSD: 14.5,
  },
  {
    merchantId: 15,
    title: 'DeepSeek-R1 推理中转',
    summary: '开源推理模型，思维链透明，性价比高。',
    models: ['deepseek-r1'],
    type: 'chat',
    priceUSD: 0.52,
  },
  {
    merchantId: 16,
    title: 'GPT 系列企业供应',
    summary: '鲲鹏企业级接入，多区域容灾，稳定首选。',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3'],
    type: 'chat',
    priceUSD: 2.4,
  },
  {
    merchantId: 17,
    title: 'cogview-4 中文出图',
    summary: '中文语义友好的图像生成，支持中文提示词。',
    models: ['cogview-4'],
    type: 'image',
    priceUSD: 0.028,
  },
  {
    merchantId: 18,
    title: 'glm-4-voice 语音供应',
    summary: '端到端语音模型，支持情感语调与实时对话。',
    models: ['glm-4-voice'],
    type: 'audio',
    priceUSD: 0.019,
  },
  {
    merchantId: 3,
    title: 'Gemini Flash 高速中转',
    summary: '极光节点低延迟通道，长上下文与低成本兼顾。',
    models: ['gemini-2.5-flash'],
    type: 'chat',
    priceUSD: 0.3,
  },
  {
    merchantId: 9,
    title: 'Grok-4-fast 长窗供应',
    summary: '2M 超长窗口高速版，适合大文档场景。',
    models: ['grok-4-fast'],
    type: 'chat',
    priceUSD: 0.19,
  },
  {
    merchantId: 2,
    title: 'Qwen VL 视觉供应',
    summary: '视觉语言多模态，图文理解与文档解析强。',
    models: ['qwen3-vl-plus'],
    type: 'chat',
    priceUSD: 0.78,
  },
  /* ---- official platform supply ---- */
  {
    merchantId: PLATFORM_MERCHANT_ID,
    title: '平台官方 GPT 直供',
    summary: '平台自营 OpenAI 官方直连，SLA 与计费由平台兜底。',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3'],
    type: 'chat',
    priceUSD: 2.5,
  },
  {
    merchantId: PLATFORM_MERCHANT_ID,
    title: '平台官方 Claude 直供',
    summary: '平台自营 Anthropic 官方通道，长上下文稳定无阉割。',
    models: ['claude-sonnet-4.5', 'claude-opus-4.1', 'claude-haiku-4.5'],
    type: 'chat',
    priceUSD: 3.0,
  },
  {
    merchantId: PLATFORM_MERCHANT_ID,
    title: '平台官方 Gemini 直供',
    summary: '平台自营 GCP Vertex 通道，多模态与超长窗口全量支持。',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    type: 'chat',
    priceUSD: 1.25,
  },
  {
    merchantId: PLATFORM_MERCHANT_ID,
    title: '平台官方国产模型池',
    summary: 'DeepSeek / Qwen / GLM 官方渠道聚合，国产合规首选。',
    models: ['deepseek-v3.2', 'qwen3-max', 'glm-4.6'],
    type: 'chat',
    priceUSD: 0.6,
  },
]

/** Listings owned by the current mock user (shown on the sell side). */
const selfListingSeed: Array<{
  title: string
  summary: string
  models: string[]
  type: MarketModelType
  priceUSD: number
  status: ListingStatus
}> = [
  {
    title: '我的 GPT-4o 转售供应',
    summary: '自有 Azure 额度转售，稳定余量充足。',
    models: ['gpt-4o', 'gpt-4o-mini'],
    type: 'chat',
    priceUSD: 2.35,
    status: 'active',
  },
  {
    title: 'DeepSeek 闲置额度出让',
    summary: '团队闲置额度，低价出让，先到先得。',
    models: ['deepseek-v3.2'],
    type: 'chat',
    priceUSD: 0.24,
    status: 'active',
  },
  {
    title: 'Claude Sonnet 拼车供应',
    summary: '拼车共享官方额度，按量结算。',
    models: ['claude-sonnet-4.5'],
    type: 'chat',
    priceUSD: 2.9,
    status: 'reviewing',
  },
  {
    title: 'gpt-image 出图余量',
    summary: '出图额度余量清仓，按张计费。',
    models: ['gpt-image-1'],
    type: 'image',
    priceUSD: 0.036,
    status: 'delisted',
  },
]
/** Pick `count` distinct tags deterministically from the pool. */
function pickTags(count: number): string[] {
  const pool = [...marketTagPool]
  const out: string[] = []
  for (let i = 0; i < count && pool.length; i++) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
  }
  return out
}

function qcSvg(label: string, tone: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">` +
    `<rect width="640" height="400" fill="#1f232e"/>` +
    `<rect x="24" y="24" width="592" height="352" rx="12" fill="none" stroke="${tone}" stroke-width="2" stroke-dasharray="6 6"/>` +
    `<polyline points="60,300 160,220 260,260 360,150 460,190 560,90" fill="none" stroke="${tone}" stroke-width="4" stroke-linecap="round"/>` +
    `<text x="320" y="356" text-anchor="middle" font-family="monospace" font-size="22" fill="${tone}">${label}</text>` +
    `</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const QC_TONES = ['#d97a45', '#7aa2d9', '#7ad98f']
/** Give roughly one in three listings 1-3 QC screenshots. */
function seedQcImages(listingId: number): string[] | undefined {
  if (listingId % 3 !== 0) return undefined
  const count = 1 + (listingId % 2) + (listingId % 5 === 0 ? 1 : 0) // 1..3
  return Array.from({ length: count }, (_, index) =>
    qcSvg(
      `QC 实测 #${listingId}-${index + 1} · 延迟采样`,
      QC_TONES[index % QC_TONES.length]
    )
  )
}

const merchantById = new Map(marketMerchants.map((m) => [m.id, m]))

let nextListingId = 1
const publicListings: MarketListing[] = listingSeed.map((seed) => {
  const merchant = merchantById.get(seed.merchantId)!
  // Larger scales (and the official platform) trend toward higher availability / QC.
  const scaleFloor =
    merchant.scale === 'platform'
      ? 98
      : merchant.scale === 'empire'
        ? 96
        : merchant.scale === 'studio'
          ? 90
          : merchant.scale === 'workshop'
            ? 85
            : 82
  const availability = Math.min(99.99, scaleFloor + rand() * (100 - scaleFloor))
  const qcScore = Math.round(
    Math.min(100, scaleFloor + rand() * (101 - scaleFloor))
  )
  const id = nextListingId++
  return {
    id,
    merchantId: seed.merchantId,
    title: seed.title,
    summary: seed.summary,
    source: marketSources[Math.floor(rand() * marketSources.length)],
    availability: Math.round(availability * 100) / 100,
    supportedModels: seed.models,
    qcScore,
    tags: pickTags(2 + Math.floor(rand() * 2)),
    priceUSD: seed.priceUSD,
    type: seed.type,
    listedAt: now - Math.floor(3 + rand() * 300) * DAY,
    rating: Math.round((3.6 + rand() * 1.4) * 10) / 10,
    reviewCount: Math.floor(rand() * 480) + 12,
    status: 'active',
    modelVendors: [
      ...new Set(seed.models.map((m) => modelVendorMap[m]).filter(Boolean)),
    ],
    qcImages: seedQcImages(id),
  }
})

const selfListings: MarketListing[] = selfListingSeed.map((seed) => {
  const salesCount = Math.floor(rand() * 80)
  // earningsUSD ≈ sales × price × 0.8 (platform fee deducted), rounded to cents.
  const earningsUSD = Math.round(salesCount * seed.priceUSD * 0.8 * 100) / 100
  return {
    id: nextListingId++,
    merchantId: 1, // display grouping only; ownerUid marks it as "mine"
    title: seed.title,
    summary: seed.summary,
    source: marketSources[Math.floor(rand() * marketSources.length)],
    availability: Math.round((94 + rand() * 5) * 100) / 100,
    supportedModels: seed.models,
    qcScore: Math.round(90 + rand() * 10),
    tags: pickTags(2),
    priceUSD: seed.priceUSD,
    type: seed.type,
    listedAt: now - Math.floor(3 + rand() * 120) * DAY,
    rating: Math.round((4 + rand() * 1) * 10) / 10,
    reviewCount: salesCount,
    status: seed.status,
    ownerUid: mockUser.id,
    earningsUSD,
    modelVendors: [
      ...new Set(seed.models.map((m) => modelVendorMap[m]).filter(Boolean)),
    ],
  }
})

export const marketListings: MarketListing[] = [
  ...publicListings,
  ...selfListings,
]

// Distinct upstream sources, used for the "available channels" toolbar stat.
export const marketplaceChannels: string[] = [
  ...new Set(marketListings.map((l) => l.source)),
]

// Backfill each merchant's channel count from its active listings' sources.
for (const m of marketMerchants) {
  const sources = new Set(
    publicListings.filter((l) => l.merchantId === m.id).map((l) => l.source)
  )
  m.channelCount = sources.size
}

let nextMyChannelId = 1
/** Seeded from a few public listings so Models-page channels have data. */
export const myChannels: MyChannel[] = [1, 3, 6, 14].map((listingId, i) => {
  const listing = publicListings.find((l) => l.id === listingId)!
  return {
    id: nextMyChannelId++,
    listingId: listing.id,
    merchantId: listing.merchantId,
    merchantName: merchantById.get(listing.merchantId)!.name,
    title: listing.title,
    supportedModels: listing.supportedModels,
    status: i === 3 ? 'disabled' : 'active',
    addedAt: now - Math.floor(5 + rand() * 60) * DAY,
  }
})

/** Append a listing to myChannels (id bookkeeping lives here). */
export function addMyChannel(listing: MarketListing): MyChannel {
  const item: MyChannel = {
    id: nextMyChannelId++,
    listingId: listing.id,
    merchantId: listing.merchantId,
    merchantName: merchantById.get(listing.merchantId)?.name ?? '未知商家',
    title: listing.title,
    supportedModels: listing.supportedModels,
    status: 'active',
    addedAt: Math.floor(Date.now() / 1000),
  }
  myChannels.unshift(item)
  return item
}

/** Channel display name for the official platform supply. */
export const PLATFORM_CHANNEL_NAME = '平台'

let nextInvoiceId = 10

export function resetMockDataCounters(): void {
  nextMyChannelId = 5
  nextInvoiceId = 10
}

export const invoices: InvoiceItem[] = [
  {
    id: 1,
    title: 'Acme 科技有限公司',
    tax_id: '91310000MA1FL5EM1G',
    amount: 1500,
    email: 'finance@acme.example.com',
    note: '',
    status: 'issued',
    pdf_url: 'https://example.com/invoice/fapiao_2026_001.pdf',
    reject_reason: '',
    created: now - 30 * DAY,
    updated: now - 28 * DAY,
  },
  {
    id: 2,
    title: '张三',
    tax_id: '',
    amount: 500,
    email: '',
    note: '个人增值税普通发票',
    status: 'pending',
    pdf_url: '',
    reject_reason: '',
    created: now - 3 * DAY,
    updated: now - 3 * DAY,
  },
  {
    id: 3,
    title: '旧版测试企业',
    tax_id: '91110000000000001A',
    amount: 200,
    email: 'test@example.com',
    note: '',
    status: 'rejected',
    pdf_url: '',
    reject_reason: '税号与公司名称不匹配，请核实后重新提交。',
    created: now - 14 * DAY,
    updated: now - 13 * DAY,
  },
]

/** Add an invoice application. */
export function addInvoice(
  data: Omit<
    InvoiceItem,
    'id' | 'status' | 'pdf_url' | 'reject_reason' | 'created' | 'updated'
  >
): InvoiceItem {
  const item: InvoiceItem = {
    ...data,
    id: nextInvoiceId++,
    status: 'pending',
    pdf_url: '',
    reject_reason: '',
    created: Math.floor(Date.now() / 1000),
    updated: Math.floor(Date.now() / 1000),
  }
  invoices.unshift(item)
  return item
}

/* ------------------------------------------------------------------ */
/* admin redemption codes                                               */
/* ------------------------------------------------------------------ */

/** Deterministic 32-char hex from an integer seed. */
function hexCode(seed: number): string {
  // Use a simple LCG in number space (safe for our id range)
  let v = (seed * 1664525 + 1013904223) >>> 0
  let hex = ''
  for (let i = 0; i < 8; i++) {
    v = (v * 1664525 + 1013904223) >>> 0
    hex += v.toString(16).padStart(8, '0')
  }
  return hex.slice(0, 32)
}

const redeemerPool = [
  { id: 998, email: 'layubihui@qq.com' },
  { id: 2052, email: '1850704696@qq.com' },
  { id: 1509, email: '2722511193@qq.com' },
  { id: 1802, email: '2402888274@qq.com' },
  { id: 421, email: '2905519940@qq.com' },
  { id: 1383, email: '1850704696@qq.com' },
  { id: 1707, email: '823988151@qq.com' },
]

type RedemptionSeed = {
  id: number
  type: AdminRedemptionCode['type']
  status: AdminRedemptionCode['status']
  amount?: number
  concurrency?: number
  plan_id?: number
  redeemerIndex?: number // index into redeemerPool; undefined = unused
  daysAgo: number // created_time offset
  usedDaysAgo?: number // used_time offset (only if status=used)
  expiredDaysAgo?: number // if status=expired, validity window ended this many days ago
}

const redemptionSeeds: RedemptionSeed[] = [
  {
    id: 32,
    type: 'quota',
    status: 'used',
    amount: 5,
    redeemerIndex: 0,
    daysAgo: 31,
    usedDaysAgo: 31,
  },
  {
    id: 31,
    type: 'quota',
    status: 'used',
    amount: 1,
    redeemerIndex: 1,
    daysAgo: 43,
    usedDaysAgo: 43,
  },
  {
    id: 30,
    type: 'quota',
    status: 'used',
    amount: 3,
    redeemerIndex: 2,
    daysAgo: 47,
    usedDaysAgo: 47,
  },
  {
    id: 29,
    type: 'quota',
    status: 'used',
    amount: 3,
    redeemerIndex: 3,
    daysAgo: 47,
    usedDaysAgo: 47,
  },
  {
    id: 28,
    type: 'quota',
    status: 'used',
    amount: 3,
    redeemerIndex: 4,
    daysAgo: 47,
    usedDaysAgo: 47,
  },
  { id: 27, type: 'quota', status: 'unused', amount: 3, daysAgo: 47 },
  { id: 26, type: 'quota', status: 'unused', amount: 3, daysAgo: 47 },
  {
    id: 25,
    type: 'quota',
    status: 'used',
    amount: 3,
    redeemerIndex: 5,
    daysAgo: 47,
    usedDaysAgo: 47,
  },
  {
    id: 24,
    type: 'quota',
    status: 'used',
    amount: 3,
    redeemerIndex: 4,
    daysAgo: 47,
    usedDaysAgo: 47,
  },
  {
    id: 23,
    type: 'quota',
    status: 'used',
    amount: 1,
    redeemerIndex: 6,
    daysAgo: 64,
    usedDaysAgo: 64,
  },
  { id: 18, type: 'quota', status: 'unused', amount: 0.2, daysAgo: 76 },
  { id: 17, type: 'quota', status: 'disabled', amount: 10, daysAgo: 90 },
  {
    id: 15,
    type: 'quota',
    status: 'expired',
    amount: 2,
    daysAgo: 100,
    expiredDaysAgo: 60,
  },
  {
    id: 14,
    type: 'concurrency',
    status: 'used',
    concurrency: 5,
    redeemerIndex: 1,
    daysAgo: 50,
    usedDaysAgo: 45,
  },
  {
    id: 13,
    type: 'concurrency',
    status: 'unused',
    concurrency: 3,
    daysAgo: 55,
  },
  {
    id: 12,
    type: 'subscription',
    status: 'used',
    plan_id: 2,
    redeemerIndex: 2,
    daysAgo: 60,
    usedDaysAgo: 58,
  },
  { id: 11, type: 'subscription', status: 'unused', plan_id: 1, daysAgo: 65 },
  {
    id: 8,
    type: 'invite',
    status: 'used',
    redeemerIndex: 0,
    daysAgo: 120,
    usedDaysAgo: 118,
  },
  { id: 7, type: 'invite', status: 'unused', daysAgo: 120 },
  { id: 6, type: 'invite', status: 'disabled', daysAgo: 125 },
]

export const adminRedemptionCodes: AdminRedemptionCode[] = redemptionSeeds.map(
  (seed) => {
    const createdTime = now - seed.daysAgo * DAY
    const redeemer =
      seed.redeemerIndex != null ? redeemerPool[seed.redeemerIndex] : null
    const expiredTime =
      seed.status === 'expired' && seed.expiredDaysAgo != null
        ? now - seed.expiredDaysAgo * DAY
        : -1

    // Display name for the row
    const name =
      seed.type === 'quota' && seed.amount != null
        ? `$${seed.amount.toFixed(2)}`
        : seed.type === 'concurrency'
          ? `${seed.concurrency ?? 0} 并发`
          : seed.type === 'subscription'
            ? seed.plan_id === 2
              ? '专业版'
              : '轻量版'
            : '邀请码'

    return {
      id: seed.id,
      name,
      code: hexCode(seed.id * 9999991 + 12345678),
      type: seed.type,
      status: seed.status,
      quota:
        seed.amount != null
          ? Math.round(seed.amount * QUOTA_PER_DOLLAR)
          : undefined,
      amount: seed.amount,
      concurrency: seed.concurrency,
      plan_id: seed.plan_id,
      redeemer_id: redeemer?.id ?? 0,
      redeemer_email: redeemer?.email ?? '',
      created_time: createdTime,
      used_time: seed.usedDaysAgo != null ? now - seed.usedDaysAgo * DAY : 0,
      expired_time: expiredTime,
    }
  }
)
