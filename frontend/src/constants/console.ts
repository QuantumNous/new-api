import type { TicketStatus } from '@/types/console'

export const MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'claude-sonnet-4.5',
  'claude-opus-4.1',
  'gemini-2.5-pro',
  'deepseek-v3.2',
  'qwen3-max',
  'grok-4',
  'kimi-k2.5',
  'glm-4.6',
  'doubao-seed-1.6',
  'mistral-large-3',
]

/** Per-vendor descriptive tagline shown in the group header. */
export const vendorMeta: Record<string, string> = {
  OpenAI: 'GPT 系列旗舰与多模态模型',
  Anthropic: 'Claude 系列，长上下文与代码见长',
  Google: 'Gemini 多模态与超长上下文',
  DeepSeek: '国产开源，极致性价比',
  阿里通义: '通义千问系列与多模态',
  xAI: 'Grok 实时联网大模型',
  Moonshot: 'Kimi 长文与 Agent 能力',
  智谱AI: 'GLM 系列与视觉生成',
}

export interface VendorLogoMeta {
  src: string
  monochrome?: boolean
  darkSurface?: boolean
}

export const vendorLogoMeta: Record<string, VendorLogoMeta> = {
  OpenAI: { src: '/models/openai.svg', monochrome: true },
  Anthropic: { src: '/models/claude-color.svg' },
  Google: { src: '/models/gemini-color.svg' },
  DeepSeek: { src: '/models/deepseek-color.svg' },
  阿里通义: { src: '/models/qwen-color.svg' },
  xAI: { src: '/models/grok.svg', monochrome: true },
  Moonshot: { src: '/models/kimi-color.svg', darkSurface: true },
  智谱AI: { src: '/models/zhipu-color.svg' },
}

/** Platform-side upstream channels (also the channel pool for platform tokens). */
export const marketSources = [
  'OpenAI 官方',
  'Azure 美东',
  'Azure 欧西',
  'Anthropic 官方',
  'AWS Bedrock',
  'GCP Vertex',
  'Google AI Studio',
  '阿里云百炼',
  '硅基流动',
  '火山引擎',
  'xAI 官方',
  'Moonshot 官方',
  '智谱开放平台',
  'DeepSeek 官方',
]

/** Display-only FX rate; listing base prices are stored in USD. */
export const USD_TO_CNY = 7.2

/** Shared StatusChip tone per ticket status (list + detail views). */
export const ticketStatusTone: Record<
  TicketStatus,
  'warning' | 'info' | 'neutral'
> = {
  open: 'warning',
  replied: 'info',
  closed: 'neutral',
}

export const marketTagPool = [
  '高并发',
  '低延迟',
  '稳定首选',
  '按量计费',
  '企业级 SLA',
  '7×24 值守',
  '故障自动切换',
  '发票支持',
  '新用户特惠',
  '长上下文',
]
