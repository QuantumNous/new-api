/*
Curated model metadata presets for the "Quick Import" dialog on the Models
page. Each entry seeds a model row with sensible defaults; the operator
reviews + enables individually. Models are created with status=false
(disabled) so they don't surface in /v1/models until reviewed.

This is the *metadata catalog* — separate from Channels. A model only
becomes invokable once at least one enabled Channel's `models` field
references it. See docs/PRD.md §6 for the Channel/Model relationship.

Grouping mirrors how the docs/DESIGN.md feature cards organize them:
text-completion, image, video, audio, embedding.
*/

export type ModelPresetGroup =
  | 'chat'
  | 'reasoning'
  | 'image'
  | 'video'
  | 'audio'
  | 'embedding'

export interface ModelPreset {
  model_name: string
  description: string
  group: ModelPresetGroup
  tags: string[]
  endpoints: string // pipe-separated endpoint types: "chat" | "image" | "audio" | "embedding"
}

export const MODEL_PRESETS: ModelPreset[] = [
  // ── Chat / Text Completion (default-grade) ───────────────────────────
  {
    model_name: 'gpt-5.5',
    description: 'OpenAI GPT-5.5 — flagship reasoning + chat.',
    group: 'reasoning',
    tags: ['reasoning', 'thinking', 'tools'],
    endpoints: 'chat',
  },
  {
    model_name: 'gpt-4o',
    description: 'OpenAI flagship multimodal chat model — vision + tools.',
    group: 'chat',
    tags: ['vision', 'tools', 'multimodal'],
    endpoints: 'chat',
  },
  {
    model_name: 'gpt-4o-mini',
    description: 'OpenAI cost-efficient small model — fast, cheap, vision.',
    group: 'chat',
    tags: ['vision', 'tools', 'cheap'],
    endpoints: 'chat',
  },
  {
    model_name: 'claude-fable-5',
    description: 'Anthropic Fable 5 — top tier above Opus, maximum capability.',
    group: 'reasoning',
    tags: ['reasoning', 'thinking', 'long-context'],
    endpoints: 'chat',
  },
  {
    model_name: 'claude-opus-4-8',
    description: 'Anthropic Opus 4.8 — adaptive thinking, top-tier reasoning.',
    group: 'reasoning',
    tags: ['reasoning', 'thinking', 'long-context'],
    endpoints: 'chat',
  },
  {
    model_name: 'claude-opus-4-7',
    description: 'Anthropic Opus 4.7 — adaptive thinking, top-tier reasoning.',
    group: 'reasoning',
    tags: ['reasoning', 'thinking', 'long-context'],
    endpoints: 'chat',
  },
  {
    model_name: 'claude-sonnet-4-6',
    description: 'Anthropic Sonnet 4.6 — balanced quality + cost.',
    group: 'chat',
    tags: ['tools', 'long-context'],
    endpoints: 'chat',
  },
  {
    model_name: 'claude-3-5-haiku-latest',
    description: 'Anthropic Haiku — fastest, cheapest Claude.',
    group: 'chat',
    tags: ['cheap', 'fast'],
    endpoints: 'chat',
  },
  {
    model_name: 'gemini-3.1-pro',
    description: 'Google Gemini 3.1 Pro — flagship long-context multimodal.',
    group: 'chat',
    tags: ['vision', 'long-context', 'multimodal'],
    endpoints: 'chat',
  },
  {
    model_name: 'gemini-2.5-pro',
    description: 'Google Gemini 2.5 Pro — long context, multimodal.',
    group: 'chat',
    tags: ['vision', 'long-context', 'multimodal'],
    endpoints: 'chat',
  },
  {
    model_name: 'gemini-2.5-flash',
    description: 'Google Gemini 2.5 Flash — speed-optimized.',
    group: 'chat',
    tags: ['fast', 'cheap'],
    endpoints: 'chat',
  },
  {
    model_name: 'deepseek-v4-pro',
    description: 'DeepSeek V4 Pro — flagship, 1M context.',
    group: 'chat',
    tags: ['open-source', 'coder', 'long-context'],
    endpoints: 'chat',
  },
  {
    model_name: 'deepseek-chat',
    description: 'DeepSeek V4 (chat alias) — open weights, strong code.',
    group: 'chat',
    tags: ['open-source', 'coder'],
    endpoints: 'chat',
  },
  {
    model_name: 'deepseek-reasoner',
    description: 'DeepSeek R1 — open-weights reasoning model.',
    group: 'reasoning',
    tags: ['reasoning', 'thinking', 'open-source'],
    endpoints: 'chat',
  },
  {
    model_name: 'qwen3-max',
    description: '阿里 Qwen3-Max — current domestic flagship, strong Chinese.',
    group: 'chat',
    tags: ['chinese', 'tools'],
    endpoints: 'chat',
  },
  {
    model_name: 'qwen-max',
    description: '阿里 Qwen-max — domestic flagship, strong Chinese.',
    group: 'chat',
    tags: ['chinese', 'tools'],
    endpoints: 'chat',
  },
  {
    model_name: 'moonshot-v1-32k',
    description: 'Moonshot Kimi v1 32k — long-context Chinese chat.',
    group: 'chat',
    tags: ['chinese', 'long-context'],
    endpoints: 'chat',
  },
  {
    model_name: 'kimi-k2-0905-preview',
    description: 'Moonshot Kimi K2 — agentic + tool use, preview.',
    group: 'chat',
    tags: ['tools', 'preview'],
    endpoints: 'chat',
  },
  {
    model_name: 'doubao-seed-1-6-thinking-250715',
    description: 'Doubao Seed 1.6 thinking — Volcengine reasoning model.',
    group: 'reasoning',
    tags: ['reasoning', 'thinking', 'chinese'],
    endpoints: 'chat',
  },

  // ── Image Generation ─────────────────────────────────────────────────
  {
    model_name: 'gpt-image-2',
    description:
      'OpenAI flagship image model (2026-04-21) — built-in reasoning + 4K.',
    group: 'image',
    tags: ['image', 'reasoning', '4k'],
    endpoints: 'image',
  },
  {
    model_name: 'gpt-image-1.5',
    description: 'OpenAI gpt-image-1.5 — previous-gen image.',
    group: 'image',
    tags: ['image'],
    endpoints: 'image',
  },
  {
    model_name: 'flux-1.1-pro',
    description: 'Black Forest Labs Flux 1.1 Pro — photoreal image.',
    group: 'image',
    tags: ['image', 'photoreal'],
    endpoints: 'image',
  },
  {
    model_name: 'flux-schnell',
    description: 'Flux Schnell — fast/cheap open-weight image.',
    group: 'image',
    tags: ['image', 'open-source', 'fast'],
    endpoints: 'image',
  },
  {
    model_name: 'doubao-seedream-4-0-250828',
    description: 'Doubao Seedream 4.0 — Volcengine image generation.',
    group: 'image',
    tags: ['image', 'chinese'],
    endpoints: 'image',
  },

  // ── Video Generation ─────────────────────────────────────────────────
  {
    model_name: 'veo-3.0-generate-001',
    description: 'Google Veo 3 — text-to-video.',
    group: 'video',
    tags: ['video'],
    endpoints: 'video',
  },
  {
    model_name: 'doubao-seedance-2-0-260128',
    description: 'Doubao Seedance 2.0 — Volcengine text-to-video.',
    group: 'video',
    tags: ['video', 'chinese'],
    endpoints: 'video',
  },
  {
    model_name: 'kling-v2-master',
    description: '快手可灵 Kling 2.0 — text/image-to-video.',
    group: 'video',
    tags: ['video', 'chinese'],
    endpoints: 'video',
  },

  // ── Audio (TTS / STT) ────────────────────────────────────────────────
  {
    model_name: 'whisper-1',
    description: 'OpenAI Whisper — speech-to-text transcription.',
    group: 'audio',
    tags: ['audio', 'transcription'],
    endpoints: 'audio',
  },
  {
    model_name: 'tts-1',
    description: 'OpenAI TTS standard — text-to-speech.',
    group: 'audio',
    tags: ['audio', 'tts'],
    endpoints: 'audio',
  },
  {
    model_name: 'tts-1-hd',
    description: 'OpenAI TTS HD — higher-quality TTS.',
    group: 'audio',
    tags: ['audio', 'tts'],
    endpoints: 'audio',
  },
  {
    model_name: 'suno_music',
    description: 'Suno — AI music generation.',
    group: 'audio',
    tags: ['audio', 'music'],
    endpoints: 'audio',
  },

  // ── Embedding ────────────────────────────────────────────────────────
  {
    model_name: 'text-embedding-3-large',
    description: 'OpenAI 3072-d embedding — top quality.',
    group: 'embedding',
    tags: ['embedding'],
    endpoints: 'embedding',
  },
  {
    model_name: 'text-embedding-3-small',
    description: 'OpenAI 1536-d embedding — cost-efficient.',
    group: 'embedding',
    tags: ['embedding', 'cheap'],
    endpoints: 'embedding',
  },
]

export const GROUP_LABELS: Record<ModelPresetGroup, string> = {
  chat: 'Chat / Text',
  reasoning: 'Reasoning',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  embedding: 'Embedding',
}

export const GROUP_ORDER: ModelPresetGroup[] = [
  'chat',
  'reasoning',
  'image',
  'video',
  'audio',
  'embedding',
]
