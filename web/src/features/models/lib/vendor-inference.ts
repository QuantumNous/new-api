/*
 * vendor-inference.ts
 *
 * 单一权威映射：图标 / 模型名 → vendor.name
 * 与后端 constant/vendor_mapping.go 保持一致；由前端 useEffect 消费，
 * 用于在模型编辑时根据图标或模型名称自动选中对应的 Vendor。
 *
 * 命名策略：这里返回的是 vendor "Name" (`Vendor.name`，如 `OpenAI`, `ByteDance`)，
 * 调用方需要自行到已加载的 vendors 列表里按 name 匹配拿到 id。
 */

/**
 * 图标 key → vendor 名称。key 使用 @lobehub/icons 的组件名（如 `Doubao.Color`）。
 * 若同一 icon 被多个 vendor 共用（罕见），取语义上最"品牌代表性"的那个。
 */
export const ICON_TO_VENDOR_NAME: Record<string, string> = {
  'OpenAI.Color': 'OpenAI',
  'Azure.Color': 'Azure',
  'Claude.Color': 'Anthropic',
  'Anthropic.Color': 'Anthropic',
  'Gemini.Color': 'Google',
  'Google.Color': 'Google',
  'Aws.Color': 'AWS',
  'Cloudflare.Color': 'Cloudflare',
  'Baidu.Color': 'Baidu',
  'Zhipu.Color': 'Zhipu',
  'Qwen.Color': 'Alibaba',
  'Alibaba.Color': 'Alibaba',
  'Spark.Color': 'iFlytek',
  'Hunyuan.Color': 'Tencent',
  'Tencent.Color': 'Tencent',
  'Ai360.Color': 'Ai360',
  'Moonshot.Color': 'Moonshot',
  'Yi.Color': 'LingYiWanWu',
  'Minimax.Color': 'MiniMax',
  'MiniMax.Color': 'MiniMax',
  'Doubao.Color': 'ByteDance',
  'ByteDance.Color': 'ByteDance',
  'Ollama.Color': 'Ollama',
  'Perplexity.Color': 'Perplexity',
  'Cohere.Color': 'Cohere',
  'Mistral.Color': 'Mistral',
  'DeepSeek.Color': 'DeepSeek',
  'XAI.Color': 'xAI',
  'Coze.Color': 'Coze',
  'SiliconCloud.Color': 'SiliconFlow',
  'OpenRouter.Color': 'OpenRouter',
  'Midjourney.Color': 'Midjourney',
  'Kling.Color': 'Kling',
  'Jimeng.Color': 'Jimeng',
  'Vidu.Color': 'Vidu',
  'Suno.Color': 'Suno',
  'Replicate.Color': 'Replicate',
  'Dify.Color': 'Dify',
  'Jina.Color': 'Jina',
  'FastGPT.Color': 'FastGPT',
  'Xinference.Color': 'Xinference',
}

/**
 * 模型名子串 → vendor 名称。按 pattern 长度降序遍历，避免 `gpt` 覆盖 `chatgpt-4o`。
 * 前后端保持一致（后端 constant/vendor_mapping.go: namePatternToVendor）。
 */
export const NAME_PATTERN_TO_VENDOR_NAME: Record<string, string> = {
  gpt: 'OpenAI',
  'dall-e': 'OpenAI',
  'text-davinci': 'OpenAI',
  'text-curie': 'OpenAI',
  'text-babbage': 'OpenAI',
  'text-ada': 'OpenAI',
  o1: 'OpenAI',
  o3: 'OpenAI',
  o4: 'OpenAI',
  sora: 'OpenAI',
  whisper: 'OpenAI',
  tts: 'OpenAI',
  claude: 'Anthropic',
  gemini: 'Google',
  gemma: 'Google',
  palm: 'Google',
  'text-bison': 'Google',
  'chat-bison': 'Google',
  deepseek: 'DeepSeek',
  glm: 'Zhipu',
  chatglm: 'Zhipu',
  cogview: 'Zhipu',
  zhipu: 'Zhipu',
  moonshot: 'Moonshot',
  kimi: 'Moonshot',
  qwen: 'Alibaba',
  tongyi: 'Alibaba',
  doubao: 'ByteDance',
  seed: 'ByteDance',
  seedance: 'ByteDance',
  seedream: 'ByteDance',
  hunyuan: 'Tencent',
  baichuan: 'Baichuan',
  llama: 'Meta',
  mistral: 'Mistral',
  mixtral: 'Mistral',
  minimax: 'MiniMax',
  abab: 'MiniMax',
  yi: 'LingYiWanWu',
  spark: 'iFlytek',
  ernie: 'Baidu',
  wenxin: 'Baidu',
  grok: 'xAI',
  cohere: 'Cohere',
  command: 'Cohere',
  perplexity: 'Perplexity',
  sonar: 'Perplexity',
  midjourney: 'Midjourney',
  suno: 'Suno',
  kling: 'Kling',
  jimeng: 'Jimeng',
  vidu: 'Vidu',
  replicate: 'Replicate',
}

// 预排序 patterns：长度降序保证"最具体命中"优先
const SORTED_NAME_PATTERNS = Object.entries(NAME_PATTERN_TO_VENDOR_NAME).sort(
  ([a], [b]) => b.length - a.length
)

/**
 * 根据图标 key 推断 vendor.name。
 * 支持 `.Color` 后缀差异（如 `Doubao` 与 `Doubao.Color` 都能命中）。
 */
export function inferVendorNameByIcon(
  icon: string | undefined
): string | undefined {
  if (!icon) return undefined
  if (ICON_TO_VENDOR_NAME[icon]) return ICON_TO_VENDOR_NAME[icon]
  // 去后缀重试
  const base = icon.split('.')[0]
  const candidate = `${base}.Color`
  return ICON_TO_VENDOR_NAME[candidate]
}

/**
 * 根据模型名推断 vendor.name。按 pattern 长度降序找第一命中。
 */
export function inferVendorNameByModelName(
  modelName: string | undefined
): string | undefined {
  if (!modelName) return undefined
  const lower = modelName.toLowerCase()
  for (const [pattern, vendor] of SORTED_NAME_PATTERNS) {
    if (lower.includes(pattern)) return vendor
  }
  return undefined
}

/**
 * 综合推断：先按图标，图标未命中再按模型名。
 * 返回 undefined 表示无法推断，调用方应保持原 vendor_id 不变。
 */
export function inferVendorName(input: {
  icon?: string
  modelName?: string
}): string | undefined {
  return (
    inferVendorNameByIcon(input.icon) ??
    inferVendorNameByModelName(input.modelName)
  )
}
