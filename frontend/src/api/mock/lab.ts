import type {
  ChatConversation,
  LabModelPick,
  LabStarter,
  StudioKind,
  StudioWork,
  StudioTool,
  AssetKind,
  AssetSource,
  AssetItem,
  NoteItem,
  PluginItem,
  McpServer,
  SkillItem,
  MarketPlugin,
  CommunityCategory,
  CommunityWork,
} from '@/types/lab'

/**
 * Mock data for the Alchemy Lab section (chat / studio / assets / notes /
 * community). UI-prototype only — no real generation happens; every list is
 * seeded deterministically so the shells have believable content and the
 * skeletons resolve to something. Kept in its own module so the large market
 * seed in data.ts stays focused.
 *
 * Contract note (anticipates backend): each lab endpoint returns the usual
 * ApiResponse<T> envelope via handlers.ts. Mutations (send, generate, upload,
 * delete) are surfaced as "prototype only" toasts client-side and are NOT
 * modeled here.
 */

const DAY = 86_400
const HOUR = 3_600
const now = Math.floor(Date.now() / 1000)

/* ---------------- seeded pseudo-random (own stream) ---------------- */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260722)

/** Deterministic placeholder art used by the reference Lab prototype. */
function tileSvg(
  from: string,
  to: string,
  w: number,
  h: number,
  glyph = ''
): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    `</linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
    (glyph
      ? `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="central" ` +
        `font-family="system-ui,sans-serif" font-size="${Math.round(w * 0.14)}" ` +
        `fill="rgba(255,255,255,.85)">${glyph}</text>`
      : '') +
    `</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const GRADS: Array<[string, string]> = [
  ['#d8984c', '#9d3017'],
  ['#6a8cb8', '#364f72'],
  ['#74765a', '#38372b'],
  ['#e8a4c4', '#d484ae'],
  ['#cfaf6b', '#a98c4e'],
  ['#7aacdc', '#52709c'],
  ['#7ec49a', '#52623d'],
  ['#a08034', '#4a3c1a'],
]

export const labModelPicks: LabModelPick[] = [
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', vendor: 'DeepSeek' },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    vendor: 'Google',
    badge: 'new',
  },
  { id: 'qwen3.8-max', name: 'Qwen3.8 Max', vendor: '阿里通义' },
  { id: 'kimi-k3', name: 'Kimi K3', vendor: 'Moonshot' },
  { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', vendor: 'OpenAI' },
  { id: 'claude-fable-5', name: 'Claude Fable 5', vendor: 'Anthropic' },
]

export const labStarters: LabStarter[] = [
  {
    id: 'daily',
    title: 'Sprint 日报',
    desc: '同步今日进度：哪些卡住了、哪些逾期、今天该做什么',
    icon: 'chart',
  },
  {
    id: 'papers',
    title: '本周必读论文',
    desc: '挑本周被引最多、讨论最热的 3 篇论文，做成精读清单',
    icon: 'doc',
  },
  {
    id: 'poster',
    title: '生成节气海报',
    desc: '按当前节气生成一张中式风物海报，附文案',
    icon: 'image',
  },
  {
    id: 'refactor',
    title: '重构一段代码',
    desc: '粘贴函数，指出坏味道并给出更清晰的实现',
    icon: 'code',
  },
  {
    id: 'digest',
    title: '行业研究周报',
    desc: '汇总本周 AI 领域要闻，输出可分享的图文简报',
    icon: 'globe',
  },
  {
    id: 'brainstorm',
    title: '头脑风暴',
    desc: '围绕一个主题快速发散 20 个可执行的点子',
    icon: 'spark',
  },
]

const CONVO_SEED: Array<{
  title: string
  preview: string
  daysAgo: number
  pinned?: boolean
}> = [
  {
    title: '主对话',
    preview: '继续聊聊上次的架构方案……',
    daysAgo: 0,
    pinned: true,
  },
  {
    title: 'RenRen 首页视觉方案',
    preview: '首屏用暖土色系,强调 CTA……',
    daysAgo: 0,
  },
  {
    title: '竞品导航栏配色分析',
    preview: '几家产品都用了近黑深灰底……',
    daysAgo: 0,
  },
  {
    title: 'Gemini 模型版本列表',
    preview: '整理一下 Gemini 各版本上下文……',
    daysAgo: 1,
  },
  {
    title: 'Vue 技能插件安装',
    preview: 'setup 语法糖下如何注册……',
    daysAgo: 1,
  },
  {
    title: 'API 404 排查',
    preview: '路由前缀写错了,应该是 /lab……',
    daysAgo: 3,
  },
  {
    title: '前端术语：框红的地方',
    preview: '那通常叫 focus ring 或描边……',
    daysAgo: 5,
  },
  {
    title: '脱贫攻坚项目背景总结',
    preview: '用 300 字概括项目背景……',
    daysAgo: 9,
  },
  { title: '太平天国运动概览', preview: '时间线与关键人物梳理……', daysAgo: 14 },
]

export const chatConversations: ChatConversation[] = CONVO_SEED.map(
  (seed, i) => {
    const updatedAt = now - seed.daysAgo * DAY - Math.floor(rand() * HOUR * 8)
    return {
      id: `c-${i + 1}`,
      title: seed.title,
      preview: seed.preview,
      pinned: seed.pinned,
      updatedAt,
      messages: [
        {
          id: i * 10 + 1,
          role: 'user',
          content: seed.preview,
          createdAt: updatedAt - 600,
        },
        {
          id: i * 10 + 2,
          role: 'assistant',
          content:
            '这是原型阶段的示例回复。接入后端后,这里会流式渲染真实的模型输出。' +
            '当前你可以浏览会话结构、切换模型、体验输入区交互。',
          createdAt: updatedAt - 540,
        },
      ],
    }
  }
)

const STUDIO_PROMPTS = [
  '中式风物时令雅集,小暑荷塘,水彩,留白',
  '夏风过巷,青春电影海报,4K 调色,暖阳',
  '踏风而行 所见皆温柔,森系,自然光',
  '迷案追踪,90 年代金融悬疑,报纸质感',
  '星渡长歌,跨时空浪漫,电影级布光',
  '赛博都市夜景,霓虹倒影,雨后街道',
  '极简产品渲染,耳机,柔和阴影,棚拍',
  '国风插画,仙鹤祥云,工笔重彩',
  '温柔清晨,牵手剪影,暖橙渐变',
  '未来算力中心,等距视角,科技蓝',
  '春日闲趣,踏春去,水粉,轻盈',
  '雪山日出,航拍,金色光线',
]

export const studioGallery: StudioWork[] = STUDIO_PROMPTS.map((prompt, i) => {
  const kind: StudioKind = i % 4 === 3 ? 'video' : 'image'
  const [from, to] = GRADS[i % GRADS.length]
  // Vary tile heights for a natural masonry rhythm.
  const shape = i % 3
  const width = 600
  const height = shape === 0 ? 800 : shape === 1 ? 600 : 760
  return {
    id: i + 1,
    kind,
    prompt,
    model: kind === 'video' ? '视频 2.0' : '模型 4.5',
    ratio: shape === 1 ? '1:1' : '3:4',
    cover: tileSvg(from, to, width, height, kind === 'video' ? '▶' : ''),
    width,
    height,
    duration: kind === 'video' ? [5, 8, 10][i % 3] : undefined,
  }
})

export const studioTools: StudioTool[] = [
  {
    id: 'cutout',
    labelKey: 'lab.studio.toolCutout',
    icon: 'M4 4h6v6H4zM14 14h6v6h-6zM14 4l6 6M4 14l6 6',
  },
  {
    id: 'erase',
    labelKey: 'lab.studio.toolErase',
    icon: 'M7 21h10M5 13l6-6 7 7-6 6H8z',
  },
  {
    id: 'expand',
    labelKey: 'lab.studio.toolExpand',
    icon: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  },
  {
    id: 'upscale',
    labelKey: 'lab.studio.toolUpscale',
    icon: 'M3 3h7v7H3zM14 14h7v7h-7zM10 10l4 4',
  },
  {
    id: 'restyle',
    labelKey: 'lab.studio.toolRestyle',
    icon: 'M12 2a10 10 0 1 0 0 20 3 3 0 0 0 0-6h-1a2 2 0 0 1 0-4h2a3 3 0 0 0 0-6z',
  },
]

const ASSET_SEED: Array<{
  name: string
  kind: AssetKind
  source: AssetSource
  size: number
  daysAgo: number
}> = [
  {
    name: '核心产品优化方案.md',
    kind: 'doc',
    source: 'chat',
    size: 12_800,
    daysAgo: 0,
  },
  {
    name: '夏风过巷-海报.png',
    kind: 'image',
    source: 'studio',
    size: 2_205_000,
    daysAgo: 0,
  },
  {
    name: '小暑荷塘.png',
    kind: 'image',
    source: 'studio',
    size: 1_870_000,
    daysAgo: 1,
  },
  {
    name: '产品宣传短片.mp4',
    kind: 'video',
    source: 'studio',
    size: 18_400_000,
    daysAgo: 1,
  },
  { name: '项目展望.md', kind: 'doc', source: 'chat', size: 8_400, daysAgo: 2 },
  {
    name: 'gallery.html',
    kind: 'code',
    source: 'upload',
    size: 34_200,
    daysAgo: 3,
  },
  {
    name: '词云关键词.csv',
    kind: 'sheet',
    source: 'upload',
    size: 6_100,
    daysAgo: 4,
  },
  {
    name: '人流识别.py',
    kind: 'code',
    source: 'upload',
    size: 15_900,
    daysAgo: 6,
  },
  {
    name: '竞品配色分析.md',
    kind: 'doc',
    source: 'chat',
    size: 9_700,
    daysAgo: 8,
  },
  {
    name: '星渡长歌-封面.png',
    kind: 'image',
    source: 'studio',
    size: 2_640_000,
    daysAgo: 10,
  },
]

export const assetItems: AssetItem[] = ASSET_SEED.map((seed, i) => {
  const [from, to] = GRADS[i % GRADS.length]
  const isMedia = seed.kind === 'image' || seed.kind === 'video'
  return {
    id: i + 1,
    name: seed.name,
    kind: seed.kind,
    source: seed.source,
    size: seed.size,
    cover: isMedia
      ? tileSvg(from, to, 400, 400, seed.kind === 'video' ? '▶' : '')
      : undefined,
    updatedAt: now - seed.daysAgo * DAY - Math.floor(rand() * HOUR * 6),
  }
})

/** Storage quota summary for the assets header meter. */
export const assetStorage = {
  usedBytes: assetItems.reduce((s, a) => s + a.size, 0) + 620_000_000,
  totalBytes: 10 * 1024 * 1024 * 1024,
}

const NOTE_SEED: Array<{
  title: string
  excerpt: string
  tags: string[]
  daysAgo: number
}> = [
  {
    title: 'Ren2Hub 配色体系速记',
    excerpt:
      '日间 Desert Ledger 暖土六色,夜间 One Night 炭蓝低饱和。accent 恒为暖行动色,signal 基底,support 第三色……',
    tags: ['设计', '主题'],
    daysAgo: 0,
  },
  {
    title: '炼金室导航结构梳理',
    excerpt:
      '聊天 / 创作 / 资源 / 笔记 / 社区五个入口,创作把绘图与视频整合在一起。侧栏常驻历史对话……',
    tags: ['产品', 'IA'],
    daysAgo: 1,
  },
  {
    title: '竞品 Composer 交互对照',
    excerpt:
      'Claude 居中舞台、Grok 极简输入条、Kimi 技能 chips、豆包底部工具行——共同点是模型选择器内嵌输入区……',
    tags: ['调研'],
    daysAgo: 2,
  },
  {
    title: 'Vue 3 setup 语法糖笔记',
    excerpt:
      'defineModel / defineProps 泛型写法,useId 稳定 SSR id,组合式函数命名以 use 开头……',
    tags: ['前端', 'Vue'],
    daysAgo: 5,
  },
  {
    title: '本周待办',
    excerpt: '① 补齐炼金室骨架屏 ② typecheck 归零 ③ 复核对比度 ④ 写迁移清单……',
    tags: ['待办'],
    daysAgo: 7,
  },
]

export const noteItems: NoteItem[] = NOTE_SEED.map((seed, i) => ({
  id: `n-${i + 1}`,
  title: seed.title,
  excerpt: seed.excerpt,
  tags: seed.tags,
  updatedAt: now - seed.daysAgo * DAY - Math.floor(rand() * HOUR * 5),
}))

export const installedPlugins: PluginItem[] = [
  {
    id: 'docs',
    name: 'Documents',
    desc: '创建和编辑文档、表格、演示文稿',
    icon: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z',
    color: '#4285F4',
    enabled: true,
    installed: true,
  },
  {
    id: 'pdf',
    name: 'PDF',
    desc: '读取、创建和验证 PDF 文件',
    icon: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2ZM9 9h1M9 13h6M9 17h6',
    color: '#EA4335',
    enabled: true,
    installed: true,
  },
  {
    id: 'sheets',
    name: 'Spreadsheets',
    desc: '创建和编辑电子表格文件',
    icon: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
    color: '#34A853',
    enabled: true,
    installed: true,
  },
  {
    id: 'slides',
    name: 'Presentations',
    desc: '创建和编辑演示文稿',
    icon: 'M2 3a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1zM8 21h8',
    color: '#FBBC04',
    enabled: true,
    installed: true,
  },
  {
    id: 'chrome',
    name: 'Chrome',
    desc: '用模型控制 Chrome 浏览器',
    icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z',
    color: '#4285F4',
    enabled: true,
    installed: true,
  },
  {
    id: 'computer',
    name: 'Computer Use',
    desc: '通过模型控制桌面应用',
    icon: 'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18',
    color: '#8B5CF6',
    enabled: true,
    installed: true,
  },
  {
    id: 'latex',
    name: 'LaTeX',
    desc: '使用 Tectonic 或 TeX Live 编译文档',
    icon: 'M4 6h16M4 12h16M4 18h7',
    color: '#374151',
    enabled: true,
    installed: true,
  },
  {
    id: 'visualize',
    name: 'Visualize',
    desc: '将想法转化为交互式图表',
    icon: 'M3 3v18h18M8 17l4-8 4 4 4-8',
    color: '#06B6D4',
    enabled: false,
    installed: true,
  },
]

export const mcpServers: McpServer[] = [
  {
    id: 'fs',
    name: 'Filesystem MCP',
    desc: '访问和操作本地文件系统',
    connected: true,
    enabled: true,
  },
]

export const skillItems: SkillItem[] = [
  {
    id: 'code-interpreter',
    name: '代码解释器',
    desc: '在沙盒中执行和分析代码，支持 Python / JS / Shell',
    icon: 'm8 6-6 6 6 6M16 6l6 6-6 6',
    color: '#6366F1',
    active: true,
  },
  {
    id: 'image-gen',
    name: '图像生成',
    desc: '通过文字描述生成和编辑图像',
    icon: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM21 15l-5-5L5 21',
    color: '#EC4899',
    active: true,
  },
  {
    id: 'web-search',
    name: '网络搜索',
    desc: '实时搜索互联网获取最新信息',
    icon: 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z',
    color: '#F59E0B',
    active: false,
  },
]

const MARKET_SEED: Array<Omit<MarketPlugin, 'installs'>> = [
  {
    id: 'browser-agent',
    name: 'Browser Agent',
    desc: '控制浏览器自动完成网页任务',
    icon: 'M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9',
    color: '#4285F4',
    category: 'featured',
  },
  {
    id: 'dalle',
    name: 'Image Gen',
    desc: '使用 DALL·E 生成和编辑图像',
    icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z',
    color: '#EC4899',
    category: 'featured',
  },
  {
    id: 'code-sandbox',
    name: 'Code Sandbox',
    desc: '云端沙盒执行多语言代码片段',
    icon: 'm8 6-6 6 6 6M16 6l6 6-6 6',
    color: '#6366F1',
    category: 'featured',
  },
  {
    id: 'web-search-mkt',
    name: 'Web Search',
    desc: '实时检索互联网最新内容',
    icon: 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z',
    color: '#F59E0B',
    category: 'featured',
  },
  {
    id: 'docs-mkt',
    name: 'Documents',
    desc: '创建和编辑文档工件',
    icon: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z',
    color: '#4285F4',
    category: 'productivity',
  },
  {
    id: 'pdf-mkt',
    name: 'PDF',
    desc: '读取、创建并验证 PDF 文件',
    icon: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z',
    color: '#EA4335',
    category: 'productivity',
  },
  {
    id: 'sheets-mkt',
    name: 'Spreadsheets',
    desc: '创建和编辑电子表格文件',
    icon: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
    color: '#34A853',
    category: 'productivity',
  },
  {
    id: 'slides-mkt',
    name: 'Presentations',
    desc: '创建和编辑演示文稿',
    icon: 'M2 3a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1zM8 21h8',
    color: '#FBBC04',
    category: 'productivity',
  },
  {
    id: 'sql',
    name: 'SQL Runner',
    desc: '直接查询和分析结构化数据',
    icon: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 15a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
    color: '#0EA5E9',
    category: 'data',
  },
  {
    id: 'notebook',
    name: 'Notebook',
    desc: '交互式数据分析笔记本',
    icon: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2ZM9 13h6M9 17h6',
    color: '#8B5CF6',
    category: 'data',
  },
  {
    id: 'translate',
    name: 'Translator',
    desc: '多语言实时翻译',
    icon: 'M5 8l6 6m-2-8 5 5M4 14l6-6 2 2m5-5 5 5',
    color: '#10B981',
    category: 'ai',
  },
  {
    id: 'tts',
    name: 'Text to Speech',
    desc: '将文字合成自然语音',
    icon: 'M11 5 6 9H2v6h4l5 4V5ZM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07',
    color: '#F97316',
    category: 'ai',
  },
]

export const marketPlugins: MarketPlugin[] = MARKET_SEED.map((seed) => ({
  ...seed,
  installs: Math.floor(500 + rand() * 49500),
}))

const COMMUNITY_SEED: Array<{
  title: string
  author: string
  category: CommunityCategory
}> = [
  { title: '踏风而行', author: '暖光工作室', category: 'poster' },
  { title: '小暑·荷', author: '青绾', category: 'illustration' },
  { title: '星渡长歌', author: '河图影视', category: 'poster' },
  { title: '江城旧事', author: '深蓝悬疑社', category: 'photo' },
  { title: '夏风过巷', author: '柚子', category: 'photo' },
  { title: '倏忽温风', author: '云间', category: 'illustration' },
  { title: '赛博雨夜', author: 'Neon', category: '3d' },
  { title: '牵手·晨', author: '橙序', category: 'video' },
  { title: '算力之城', author: 'Isometric', category: '3d' },
  { title: '踏春去', author: '闻花', category: 'poster' },
  { title: 'FLOWER', author: '千墨', category: 'illustration' },
  { title: '雪山日出', author: '高原', category: 'photo' },
]

export const communityWorks: CommunityWork[] = COMMUNITY_SEED.map((seed, i) => {
  const [from, to] = GRADS[(i + 2) % GRADS.length]
  const shape = i % 3
  const width = 600
  const height = shape === 0 ? 760 : shape === 1 ? 600 : 840
  return {
    id: i + 1,
    title: seed.title,
    author: seed.author,
    category: seed.category,
    cover: tileSvg(
      from,
      to,
      width,
      height,
      seed.category === 'video' ? '▶' : ''
    ),
    width,
    height,
    likes: Math.floor(120 + rand() * 4800),
    featured: i < 6,
  }
})
