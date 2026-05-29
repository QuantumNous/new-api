/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

const TEXT_INPUT_ENDPOINTS = new Set([
  'openai',
  'openai-response',
  'anthropic',
  'gemini',
  'embeddings',
  'jina-rerank',
]);

const IMAGE_OUTPUT_ENDPOINTS = new Set(['image-generation']);
const VIDEO_OUTPUT_ENDPOINTS = new Set(['openai-video']);
const EMBEDDING_ENDPOINTS = new Set(['embeddings', 'jina-rerank']);

const REASONING_NAME_PATTERNS = [
  /^o[1-4](?:[-:_].+)?$/i,
  /reasoning/i,
  /thinking/i,
  /qwq/i,
  /deepseek-r\d/i,
  /grok.*-(?:thinking|reasoning)/i,
];

const VISION_NAME_PATTERNS = [/vision/i, /vl(?:[-_]|$)/i, /multimodal/i, /-omni/i];
const AUDIO_NAME_PATTERNS = [/audio/i, /whisper/i, /tts/i, /voice/i, /-realtime/i];
const VIDEO_NAME_PATTERNS = [/video/i, /sora/i, /veo/i, /kling/i, /pika/i];
const CODE_NAME_PATTERNS = [/code/i, /-coder/i];
const WEB_SEARCH_PATTERNS = [/web[-_ ]?search/i, /-online/i, /perplexity/i];

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
];

const PARAM_BUCKETS = ['1.5B', '3B', '7B', '8B', '14B', '32B', '70B', '120B', '405B'];
const CONTEXT_BUCKETS = [8192, 16384, 32768, 65536, 128000, 200000, 1000000];
const MAX_OUTPUT_BUCKETS = [2048, 4096, 8192, 16384, 32768, 65536];

const TAG_TO_CAPABILITY = {
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
};

const TAG_TO_MODALITY = {
  text: 'text',
  image: 'image',
  audio: 'audio',
  video: 'video',
  file: 'file',
  document: 'file',
  pdf: 'file',
};

const VENDOR_LABELS = {
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
};

const TOKENIZER_BY_VENDOR = {
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
};

const LICENSE_BY_VENDOR = {
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
};

const HOMEPAGE_BY_VENDOR = {
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
};

const DATA_RETENTION_OVERRIDES = {
  'qwen3.6-flash': 85,
};

function hashStringToSeed(input = '') {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed || 1;
  return () => {
    state = (1664525 * state + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function pickFromBuckets(buckets, rand) {
  return buckets[Math.floor(rand() * buckets.length)];
}

function parseModelTags(tagsString) {
  if (!tagsString) return [];
  return tagsString
    .split(/[,;|\s]+/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function nameMatches(name, patterns) {
  return patterns.some((pattern) => pattern.test(name));
}

function ordered(modalities) {
  const order = ['text', 'image', 'audio', 'video', 'file'];
  return order.filter((item) => modalities.has(item));
}

function inferInputModalities(model, tags, endpoints, name) {
  const set = new Set();
  if (endpoints.length === 0 || endpoints.some((item) => TEXT_INPUT_ENDPOINTS.has(item))) {
    set.add('text');
  }
  if (model.image_ratio != null || nameMatches(name, VISION_NAME_PATTERNS)) set.add('image');
  if (model.audio_ratio != null || nameMatches(name, AUDIO_NAME_PATTERNS)) set.add('audio');
  if (nameMatches(name, VIDEO_NAME_PATTERNS)) set.add('video');
  tags.forEach((tag) => {
    if (TAG_TO_MODALITY[tag]) set.add(TAG_TO_MODALITY[tag]);
  });
  if (set.size === 0) set.add('text');
  return ordered(set);
}

function inferOutputModalities(model, endpoints, name) {
  const set = new Set();
  if (endpoints.some((item) => IMAGE_OUTPUT_ENDPOINTS.has(item))) set.add('image');
  if (endpoints.some((item) => VIDEO_OUTPUT_ENDPOINTS.has(item))) set.add('video');
  if (endpoints.some((item) => EMBEDDING_ENDPOINTS.has(item))) set.add('text');
  if (model.audio_completion_ratio != null || /tts|voice|audio-out/i.test(name)) {
    set.add('audio');
  }
  if (set.size === 0) set.add('text');
  return ordered(set);
}

function inferCapabilities(model, tags, endpoints, name, outputs, inputs) {
  const set = new Set();
  if (outputs.includes('text') && !endpoints.includes('image-generation')) {
    set.add('streaming');
    set.add('system_prompt');
  }
  if (
    !endpoints.includes('image-generation') &&
    !endpoints.includes('embeddings') &&
    !endpoints.includes('jina-rerank')
  ) {
    set.add('function_calling');
    set.add('tools');
    set.add('json_mode');
    set.add('structured_output');
  }
  if (inputs.includes('image')) set.add('vision');
  if (model.cache_ratio != null) set.add('caching');
  if (endpoints.some((item) => EMBEDDING_ENDPOINTS.has(item))) set.add('embeddings');
  if (nameMatches(name, REASONING_NAME_PATTERNS)) set.add('reasoning');
  if (nameMatches(name, CODE_NAME_PATTERNS)) set.add('code_interpreter');
  if (nameMatches(name, WEB_SEARCH_PATTERNS)) set.add('web_search');
  tags.forEach((tag) => {
    if (TAG_TO_CAPABILITY[tag]) set.add(TAG_TO_CAPABILITY[tag]);
  });
  return Array.from(set);
}

function inferContextAndOutputs(name, rand, endpoints) {
  if (endpoints.includes('embeddings') || endpoints.includes('jina-rerank')) {
    return { context: 8192, maxOutput: 0 };
  }
  if (endpoints.includes('image-generation') || endpoints.includes('openai-video')) {
    return { context: 4096, maxOutput: 0 };
  }
  const lower = name.toLowerCase();
  if (lower.includes('1m') || lower.includes('-long')) {
    return { context: 1000000, maxOutput: 65536 };
  }
  if (lower.includes('200k') || lower.includes('claude-3') || lower.includes('claude-4')) {
    return { context: 200000, maxOutput: 16384 };
  }
  if (lower.includes('128k') || /gpt-4o|gpt-4\.1|gpt-5|o1|o3|o4/.test(lower)) {
    return { context: 128000, maxOutput: 16384 };
  }
  if (/gemini.*-2|gemini.*pro|gemini.*flash/.test(lower)) {
    return { context: 1000000, maxOutput: 8192 };
  }
  if (/gpt-3\.5|claude-2/.test(lower)) {
    return { context: 16384, maxOutput: 4096 };
  }
  const context = pickFromBuckets(CONTEXT_BUCKETS, rand);
  const maxOutput = Math.min(context, pickFromBuckets(MAX_OUTPUT_BUCKETS, rand));
  return { context, maxOutput };
}

function inferReleaseAndCutoff(rand) {
  const cutoff = pickFromBuckets(KNOWLEDGE_CUTOFFS, rand);
  const [year, month] = cutoff.split('-').map(Number);
  const offsetMonths = 4 + Math.floor(rand() * 6);
  const releaseMonth = month + offsetMonths;
  const releaseYear = year + Math.floor((releaseMonth - 1) / 12);
  const finalMonth = ((releaseMonth - 1) % 12) + 1;
  return {
    cutoff,
    release: `${releaseYear}-${String(finalMonth).padStart(2, '0')}-15`,
  };
}

function detectVendor(name = '') {
  const lower = name.toLowerCase();
  if (/^gpt|^o[1-4]|davinci|babbage|whisper|tts|dall.?e|sora|^omni/.test(lower)) return 'openai';
  if (/claude/.test(lower)) return 'anthropic';
  if (/gemini|gemma|imagen|veo|palm/.test(lower)) return 'google';
  if (/llama|^codellama/.test(lower)) return 'meta';
  if (/mistral|mixtral|codestral|magistral|pixtral/.test(lower)) return 'mistral';
  if (/qwen|qwq|qvq/.test(lower)) return 'qwen';
  if (/deepseek/.test(lower)) return 'deepseek';
  if (/grok/.test(lower)) return 'xai';
  if (/command|cohere|aya/.test(lower)) return 'cohere';
  if (/ernie|wenxin/.test(lower)) return 'baidu';
  if (/glm|chatglm|cogview|cogvideo/.test(lower)) return 'zhipu';
  if (/kimi|moonshot/.test(lower)) return 'moonshot';
  if (/abab|minimax|hailuo/.test(lower)) return 'minimax';
  if (/hunyuan/.test(lower)) return 'tencent';
  if (/doubao|seed|jimeng/.test(lower)) return 'bytedance';
  if (/midjourney|niji/.test(lower)) return 'midjourney';
  if (/^sd-|stable[-_]?diffusion|sdxl/.test(lower)) return 'stability';
  return 'unknown';
}

function inferTokenizer(model, vendor) {
  const name = (model.model_name || '').toLowerCase();
  if (vendor === 'openai') {
    if (/gpt-3|davinci|babbage|whisper|tts/.test(name)) {
      return { tokenizer: 'cl100k_base', note: 'Older GPT-3.5 family' };
    }
    return { tokenizer: 'o200k_base' };
  }
  return { tokenizer: TOKENIZER_BY_VENDOR[vendor] || 'BPE (vendor-specific)' };
}

function readNumericMetadata(model, keys) {
  for (const key of keys) {
    const raw = model?.[key];
    if (raw === undefined || raw === null || raw === '') continue;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === 'string') {
      const match = raw.match(/-?\d+(?:\.\d+)?/);
      if (match) {
        const value = Number(match[0]);
        if (Number.isFinite(value)) return value;
      }
    }
  }
  return null;
}

function readBooleanMetadata(model, keys) {
  for (const key of keys) {
    const raw = model?.[key];
    if (raw === undefined || raw === null || raw === '') continue;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw !== 0;
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
      if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    }
  }
  return null;
}

export function inferModelMetadata(model) {
  const name = model.model_name || '';
  const rand = seededRandom(hashStringToSeed(name));
  const tags = parseModelTags(model.tags);
  const endpoints = model.supported_endpoint_types || [];
  const inputModalities =
    model.input_modalities || inferInputModalities(model, tags, endpoints, name);
  const outputModalities =
    model.output_modalities || inferOutputModalities(model, endpoints, name);
  const capabilities =
    model.capabilities ||
    inferCapabilities(model, tags, endpoints, name, outputModalities, inputModalities);
  const fallback = inferContextAndOutputs(name, rand, endpoints);
  const release = inferReleaseAndCutoff(rand);
  return {
    context_length: model.context_length || fallback.context,
    max_output_tokens:
      model.max_output_tokens === 0 ? 0 : model.max_output_tokens || fallback.maxOutput,
    knowledge_cutoff: model.knowledge_cutoff || release.cutoff,
    release_date: model.release_date || release.release,
    parameter_count: model.parameter_count || pickFromBuckets(PARAM_BUCKETS, rand),
    input_modalities: inputModalities,
    output_modalities: outputModalities,
    capabilities,
  };
}

export function inferApiInfo(model) {
  const modelName = model.model_name || '';
  const vendor = detectVendor(modelName);
  const tokenizer = inferTokenizer(model, vendor);
  const license = LICENSE_BY_VENDOR[vendor];
  const rand = seededRandom(hashStringToSeed(`${modelName}:api`));
  const fallbackRetention = vendor === 'openai' ? 30 : Math.round(rand() * 90);
  const normalizedModelName = modelName.trim().toLowerCase();
  const retentionDays = readNumericMetadata(model, [
    'data_retention_days',
    'dataRetentionDays',
    'retention_days',
    'retentionDays',
    'data_retention',
    'dataRetention',
  ]);
  const overrideRetention = DATA_RETENTION_OVERRIDES[normalizedModelName];
  const trainingOptOut = readBooleanMetadata(model, [
    'training_opt_out',
    'trainingOptOut',
  ]);
  return {
    vendor,
    vendor_label: VENDOR_LABELS[vendor],
    tokenizer: tokenizer.tokenizer,
    tokenizer_note: tokenizer.note,
    license: license.license,
    license_kind: license.kind,
    data_retention_days: retentionDays ?? overrideRetention ?? fallbackRetention,
    training_opt_out: trainingOptOut ?? true,
    homepage: HOMEPAGE_BY_VENDOR[vendor],
  };
}

export function formatTokenCount(tokens) {
  if (!Number.isFinite(tokens) || tokens <= 0) return '—';
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(tokens % 1000000 === 0 ? 0 : 1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(tokens % 1000 === 0 ? 0 : 1)}K`;
  return String(tokens);
}

export function formatYearMonth(value) {
  if (!value) return '—';
  const [yearStr, monthStr] = String(value).split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return value;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short' });
}
