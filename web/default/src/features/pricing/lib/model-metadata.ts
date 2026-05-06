import type { Modality, ModelCapability, PricingModel } from '../types'
import { hashStringToSeed, seededRandom } from './seed'

// ----------------------------------------------------------------------------
// Model metadata inference
// ----------------------------------------------------------------------------
//
// The backend does not currently return `context_length`, `max_output_tokens`,
// `knowledge_cutoff`, `release_date`, `parameter_count`, or modality/capability
// flags for a model. Until it does, we infer reasonable values client-side
// from the data we already have (endpoint types, ratios, tags, model name)
// and fall back to a deterministic mock seeded from the model name so that
// every render of the same model shows the same numbers.
//
// When the backend starts returning these fields, callers should prefer the
// explicit values on `model.*` and only fall back to the inferred ones.

const TEXT_INPUT_ENDPOINTS = new Set([
  'openai',
  'openai-response',
  'anthropic',
  'gemini',
  'embeddings',
  'jina-rerank',
])

const IMAGE_OUTPUT_ENDPOINTS = new Set(['image-generation'])
const VIDEO_OUTPUT_ENDPOINTS = new Set(['openai-video'])
const EMBEDDING_ENDPOINTS = new Set(['embeddings', 'jina-rerank'])

const REASONING_NAME_PATTERNS = [
  /^o[1-4](?:[-:_].+)?$/i,
  /reasoning/i,
  /thinking/i,
  /qwq/i,
  /deepseek-r\d/i,
  /grok.*-(?:thinking|reasoning)/i,
]

const VISION_NAME_PATTERNS = [
  /vision/i,
  /vl(?:[-_]|$)/i,
  /multimodal/i,
  /-omni/i,
]

const AUDIO_NAME_PATTERNS = [
  /audio/i,
  /whisper/i,
  /tts/i,
  /voice/i,
  /-realtime/i,
]

const VIDEO_NAME_PATTERNS = [/video/i, /sora/i, /veo/i, /kling/i, /pika/i]

const CODE_NAME_PATTERNS = [/code/i, /-coder/i]

const WEB_SEARCH_PATTERNS = [/web[-_ ]?search/i, /-online/i, /perplexity/i]

const KNOWLEDGE_CUTOFFS = [
  '2023-04',
  '2023-10',
  '2023-12',
  '2024-04',
  '2024-06',
  '2024-08',
  '2024-10',
  '2024-12',
  '2025-02',
  '2025-04',
  '2025-08',
]

const PARAM_BUCKETS = [
  '1.5B',
  '3B',
  '7B',
  '8B',
  '14B',
  '32B',
  '70B',
  '120B',
  '405B',
]

const CONTEXT_BUCKETS = [
  8_192, 16_384, 32_768, 65_536, 128_000, 200_000, 1_000_000,
]
const MAX_OUTPUT_BUCKETS = [2_048, 4_096, 8_192, 16_384, 32_768, 65_536]

const TAG_TO_CAPABILITY: Record<string, ModelCapability> = {
  vision: 'vision',
  multimodal: 'vision',
  reasoning: 'reasoning',
  thinking: 'reasoning',
  tools: 'tools',
  function: 'function_calling',
  'function-calling': 'function_calling',
  streaming: 'streaming',
  json: 'json_mode',
  structured: 'structured_output',
  search: 'web_search',
  code: 'code_interpreter',
  embedding: 'embeddings',
}

const TAG_TO_MODALITY: Record<string, Modality> = {
  text: 'text',
  image: 'image',
  audio: 'audio',
  video: 'video',
  file: 'file',
  document: 'file',
  pdf: 'file',
}

function pickFromBuckets<T>(buckets: T[], rand: () => number): T {
  return buckets[Math.floor(rand() * buckets.length)]
}

function parseModelTags(tagsString?: string): string[] {
  if (!tagsString) return []
  return tagsString
    .split(/[,;|\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

function nameMatches(name: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(name))
}

function inferInputModalities(
  model: PricingModel,
  tags: string[],
  endpoints: string[],
  name: string
): Modality[] {
  const set = new Set<Modality>()

  if (
    endpoints.length === 0 ||
    endpoints.some((e) => TEXT_INPUT_ENDPOINTS.has(e))
  ) {
    set.add('text')
  }

  if (model.image_ratio != null || nameMatches(name, VISION_NAME_PATTERNS)) {
    set.add('image')
  }
  if (model.audio_ratio != null || nameMatches(name, AUDIO_NAME_PATTERNS)) {
    set.add('audio')
  }
  if (nameMatches(name, VIDEO_NAME_PATTERNS)) {
    set.add('video')
  }

  for (const tag of tags) {
    const m = TAG_TO_MODALITY[tag]
    if (m) set.add(m)
  }

  if (set.size === 0) set.add('text')
  return ordered(set)
}

function inferOutputModalities(
  model: PricingModel,
  endpoints: string[],
  name: string
): Modality[] {
  const set = new Set<Modality>()

  if (endpoints.some((e) => IMAGE_OUTPUT_ENDPOINTS.has(e))) set.add('image')
  if (endpoints.some((e) => VIDEO_OUTPUT_ENDPOINTS.has(e))) set.add('video')
  if (endpoints.some((e) => EMBEDDING_ENDPOINTS.has(e))) set.add('text')

  if (
    model.audio_completion_ratio != null ||
    /tts|voice|audio-out/i.test(name)
  ) {
    set.add('audio')
  }

  if (set.size === 0) set.add('text')
  return ordered(set)
}

function inferCapabilities(
  model: PricingModel,
  tags: string[],
  endpoints: string[],
  name: string,
  outputs: Modality[],
  inputs: Modality[]
): ModelCapability[] {
  const set = new Set<ModelCapability>()

  if (outputs.includes('text') && !endpoints.includes('image-generation')) {
    set.add('streaming')
    set.add('system_prompt')
  }
  if (
    !endpoints.includes('image-generation') &&
    !endpoints.includes('embeddings') &&
    !endpoints.includes('jina-rerank')
  ) {
    set.add('function_calling')
    set.add('tools')
    set.add('json_mode')
    set.add('structured_output')
  }
  if (inputs.includes('image')) set.add('vision')
  if (model.cache_ratio != null) set.add('caching')
  if (endpoints.some((e) => EMBEDDING_ENDPOINTS.has(e))) set.add('embeddings')
  if (nameMatches(name, REASONING_NAME_PATTERNS)) set.add('reasoning')
  if (nameMatches(name, CODE_NAME_PATTERNS)) set.add('code_interpreter')
  if (nameMatches(name, WEB_SEARCH_PATTERNS)) set.add('web_search')

  for (const tag of tags) {
    const cap = TAG_TO_CAPABILITY[tag]
    if (cap) set.add(cap)
  }

  return Array.from(set)
}

function ordered(modalities: Set<Modality>): Modality[] {
  const order: Modality[] = ['text', 'image', 'audio', 'video', 'file']
  return order.filter((m) => modalities.has(m))
}

function inferContextAndOutputs(
  name: string,
  rand: () => number,
  endpoints: string[]
): { context: number; maxOutput: number } {
  if (endpoints.includes('embeddings') || endpoints.includes('jina-rerank')) {
    return { context: 8_192, maxOutput: 0 }
  }
  if (
    endpoints.includes('image-generation') ||
    endpoints.includes('openai-video')
  ) {
    return { context: 4_096, maxOutput: 0 }
  }

  const lower = name.toLowerCase()
  if (lower.includes('1m') || lower.includes('-long')) {
    return { context: 1_000_000, maxOutput: 65_536 }
  }
  if (
    lower.includes('200k') ||
    lower.includes('claude-3') ||
    lower.includes('claude-4')
  ) {
    return { context: 200_000, maxOutput: 16_384 }
  }
  if (lower.includes('128k') || /gpt-4o|gpt-4\.1|gpt-5|o1|o3|o4/.test(lower)) {
    return { context: 128_000, maxOutput: 16_384 }
  }
  if (/gemini.*-2|gemini.*pro|gemini.*flash/.test(lower)) {
    return { context: 1_000_000, maxOutput: 8_192 }
  }
  if (/gpt-3\.5|claude-2/.test(lower)) {
    return { context: 16_384, maxOutput: 4_096 }
  }

  const context = pickFromBuckets(CONTEXT_BUCKETS, rand)
  const maxOutput = Math.min(context, pickFromBuckets(MAX_OUTPUT_BUCKETS, rand))
  return { context, maxOutput }
}

function inferReleaseAndCutoff(rand: () => number): {
  release: string
  cutoff: string
} {
  const cutoff = pickFromBuckets(KNOWLEDGE_CUTOFFS, rand)
  const [year, month] = cutoff.split('-').map(Number)
  const offsetMonths = 4 + Math.floor(rand() * 6)
  const releaseMonth = month + offsetMonths
  const releaseYear = year + Math.floor((releaseMonth - 1) / 12)
  const finalMonth = ((releaseMonth - 1) % 12) + 1
  const release = `${releaseYear}-${String(finalMonth).padStart(2, '0')}-15`
  return { release, cutoff }
}

export type ModelMetadata = {
  context_length: number
  max_output_tokens: number
  knowledge_cutoff: string
  release_date: string
  parameter_count: string
  input_modalities: Modality[]
  output_modalities: Modality[]
  capabilities: ModelCapability[]
}

/**
 * Infer / mock model metadata. Prefers explicit fields on `model.*` and
 * falls back to inference + a deterministic seed otherwise.
 */
export function inferModelMetadata(model: PricingModel): ModelMetadata {
  const name = model.model_name || ''
  const rand = seededRandom(hashStringToSeed(name))
  const tags = parseModelTags(model.tags)
  const endpoints = model.supported_endpoint_types || []

  const inputs =
    model.input_modalities ?? inferInputModalities(model, tags, endpoints, name)
  const outputs =
    model.output_modalities ?? inferOutputModalities(model, endpoints, name)
  const capabilities =
    model.capabilities ??
    inferCapabilities(model, tags, endpoints, name, outputs, inputs)

  const fallback = inferContextAndOutputs(name, rand, endpoints)
  const cutoffAndRelease = inferReleaseAndCutoff(rand)

  return {
    context_length: model.context_length ?? fallback.context,
    max_output_tokens: model.max_output_tokens ?? fallback.maxOutput,
    knowledge_cutoff: model.knowledge_cutoff ?? cutoffAndRelease.cutoff,
    release_date: model.release_date ?? cutoffAndRelease.release,
    parameter_count:
      model.parameter_count ?? pickFromBuckets(PARAM_BUCKETS, rand),
    input_modalities: inputs,
    output_modalities: outputs,
    capabilities,
  }
}

const TOKEN_FORMAT = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
})

/** Format a token count compactly: 128_000 → "128K", 1_000_000 → "1M". */
export function formatTokenCount(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return '—'
  if (tokens >= 1_000_000) {
    const value = tokens / 1_000_000
    return `${TOKEN_FORMAT.format(value)}M`
  }
  if (tokens >= 1_000) {
    const value = tokens / 1_000
    return `${TOKEN_FORMAT.format(value)}K`
  }
  return TOKEN_FORMAT.format(tokens)
}

/** Format a YYYY-MM (or YYYY-MM-DD) date as `Mon YYYY` for display. */
export function formatYearMonth(value: string): string {
  if (!value) return '—'
  const [yearStr, monthStr] = value.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return value
  const date = new Date(Date.UTC(year, month - 1, 1))
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short' })
}

// ---------------------------------------------------------------------------
// Provider / vendor / tokenizer / license inference
// ---------------------------------------------------------------------------
//
// These helpers derive vendor-style metadata from the model name. They are
// purely heuristic and serve only the API-info display until the backend
// returns explicit fields.

export type ModelVendor =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'meta'
  | 'mistral'
  | 'qwen'
  | 'deepseek'
  | 'xai'
  | 'cohere'
  | 'baidu'
  | 'zhipu'
  | 'moonshot'
  | 'minimax'
  | 'tencent'
  | 'bytedance'
  | 'midjourney'
  | 'stability'
  | 'unknown'

export type ApiInfo = {
  vendor: ModelVendor
  vendor_label: string
  tokenizer: string
  tokenizer_note?: string
  license: string
  license_kind: 'proprietary' | 'open' | 'open-weight' | 'unknown'
  data_retention_days: number
  training_opt_out: boolean
  homepage?: string
}

const VENDOR_LABELS: Record<ModelVendor, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  meta: 'Meta',
  mistral: 'Mistral AI',
  qwen: 'Alibaba (Qwen)',
  deepseek: 'DeepSeek',
  xai: 'xAI',
  cohere: 'Cohere',
  baidu: 'Baidu',
  zhipu: 'Zhipu AI',
  moonshot: 'Moonshot AI',
  minimax: 'MiniMax',
  tencent: 'Tencent',
  bytedance: 'ByteDance',
  midjourney: 'Midjourney',
  stability: 'Stability AI',
  unknown: 'Unknown',
}

function detectVendor(name: string): ModelVendor {
  const n = name.toLowerCase()
  if (/^gpt|^o[1-4]|davinci|babbage|whisper|tts|dall.?e|sora|^omni/.test(n))
    return 'openai'
  if (/claude/.test(n)) return 'anthropic'
  if (/gemini|gemma|imagen|veo|palm/.test(n)) return 'google'
  if (/llama|^codellama/.test(n)) return 'meta'
  if (/mistral|mixtral|codestral|magistral|pixtral/.test(n)) return 'mistral'
  if (/qwen|qwq|qvq/.test(n)) return 'qwen'
  if (/deepseek/.test(n)) return 'deepseek'
  if (/grok/.test(n)) return 'xai'
  if (/command|cohere|aya/.test(n)) return 'cohere'
  if (/ernie|wenxin/.test(n)) return 'baidu'
  if (/glm|chatglm|cogview|cogvideo/.test(n)) return 'zhipu'
  if (/kimi|moonshot/.test(n)) return 'moonshot'
  if (/abab|minimax|hailuo/.test(n)) return 'minimax'
  if (/hunyuan/.test(n)) return 'tencent'
  if (/doubao|seed|jimeng/.test(n)) return 'bytedance'
  if (/midjourney|niji/.test(n)) return 'midjourney'
  if (/^sd-|stable[-_]?diffusion|sdxl/.test(n)) return 'stability'
  return 'unknown'
}

const TOKENIZER_BY_VENDOR: Partial<Record<ModelVendor, string>> = {
  openai: 'o200k_base',
  anthropic: 'Anthropic Claude tokenizer',
  google: 'SentencePiece (Gemini)',
  meta: 'Llama 3 tokenizer',
  mistral: 'Mistral tokenizer (BPE)',
  qwen: 'Qwen tokenizer (tiktoken-compat)',
  deepseek: 'DeepSeek tokenizer (BPE)',
  xai: 'Grok tokenizer (BPE)',
  cohere: 'Cohere tokenizer',
  baidu: 'Ernie tokenizer',
  zhipu: 'GLM tokenizer',
  moonshot: 'Kimi tokenizer',
  minimax: 'ABAB tokenizer',
  tencent: 'Hunyuan tokenizer',
  bytedance: 'Doubao tokenizer',
}

function inferTokenizer(
  model: PricingModel,
  vendor: ModelVendor
): {
  tokenizer: string
  note?: string
} {
  const name = model.model_name.toLowerCase()
  if (vendor === 'openai') {
    if (/gpt-3|davinci|babbage|whisper|tts/.test(name)) {
      return { tokenizer: 'cl100k_base', note: 'Older GPT-3.5 family' }
    }
    return { tokenizer: 'o200k_base' }
  }
  return { tokenizer: TOKENIZER_BY_VENDOR[vendor] ?? 'BPE (vendor-specific)' }
}

const LICENSE_BY_VENDOR: Record<
  ModelVendor,
  { license: string; kind: ApiInfo['license_kind'] }
> = {
  openai: { license: 'Proprietary (commercial)', kind: 'proprietary' },
  anthropic: { license: 'Proprietary (commercial)', kind: 'proprietary' },
  google: { license: 'Proprietary (commercial)', kind: 'proprietary' },
  meta: { license: 'Llama Community License', kind: 'open-weight' },
  mistral: { license: 'Apache 2.0 / Commercial', kind: 'open-weight' },
  qwen: { license: 'Tongyi Qianwen License', kind: 'open-weight' },
  deepseek: { license: 'DeepSeek License', kind: 'open-weight' },
  xai: { license: 'Proprietary (commercial)', kind: 'proprietary' },
  cohere: { license: 'Proprietary (commercial)', kind: 'proprietary' },
  baidu: { license: 'Proprietary (commercial)', kind: 'proprietary' },
  zhipu: { license: 'GLM-4 License', kind: 'open-weight' },
  moonshot: { license: 'Proprietary (commercial)', kind: 'proprietary' },
  minimax: { license: 'Proprietary (commercial)', kind: 'proprietary' },
  tencent: { license: 'Hunyuan License', kind: 'open-weight' },
  bytedance: { license: 'Proprietary (commercial)', kind: 'proprietary' },
  midjourney: { license: 'Proprietary (commercial)', kind: 'proprietary' },
  stability: { license: 'Stability AI Community License', kind: 'open-weight' },
  unknown: { license: 'Provider-specific', kind: 'unknown' },
}

const HOMEPAGE_BY_VENDOR: Partial<Record<ModelVendor, string>> = {
  openai: 'https://platform.openai.com/docs/models',
  anthropic: 'https://docs.anthropic.com/claude/docs/models-overview',
  google: 'https://ai.google.dev/models',
  meta: 'https://llama.meta.com/',
  mistral: 'https://docs.mistral.ai/getting-started/models/',
  qwen: 'https://qwenlm.github.io/',
  deepseek: 'https://api-docs.deepseek.com/',
  xai: 'https://x.ai/api',
  cohere: 'https://docs.cohere.com/docs/models',
  baidu: 'https://cloud.baidu.com/product/wenxinworkshop',
  zhipu: 'https://open.bigmodel.cn/dev/api',
  moonshot: 'https://platform.moonshot.cn/docs',
  minimax: 'https://platform.minimaxi.com/document/notice',
  tencent: 'https://cloud.tencent.com/document/product/1729',
  bytedance: 'https://www.volcengine.com/docs/82379',
  midjourney: 'https://www.midjourney.com/',
  stability: 'https://platform.stability.ai/',
}

/**
 * Build vendor / tokenizer / license / privacy metadata for the model.
 * Returns deterministic values keyed off the model name so each render is
 * stable.
 */
export function inferApiInfo(model: PricingModel): ApiInfo {
  const vendor = detectVendor(model.model_name || '')
  const tk = inferTokenizer(model, vendor)
  const license = LICENSE_BY_VENDOR[vendor]
  const rand = seededRandom(hashStringToSeed(`${model.model_name}:api`))
  const retention = vendor === 'openai' ? 30 : Math.round(rand() * 90)
  return {
    vendor,
    vendor_label: VENDOR_LABELS[vendor],
    tokenizer: tk.tokenizer,
    tokenizer_note: tk.note,
    license: license.license,
    license_kind: license.kind,
    data_retention_days: retention,
    training_opt_out: true,
    homepage: HOMEPAGE_BY_VENDOR[vendor],
  }
}
