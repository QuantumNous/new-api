/*
Provider presets for the "Quick Import" dialog. Each entry maps to a single
channel that will be created in disabled state (status=2) with a placeholder
key, so the operator can enable + fill the real key without typing the rest
of the form every time.

Design goals (kept deliberately beginner-proof):
  - One preset = one provider + ONE modality (chat / image / embedding-audio).
    Mixing image + chat in one channel is the #1 source of confusion: image
    models can't be tested with a chat request and behave differently.
  - Every model listed here has a DEFAULT PRICE in setting/ratio_setting, so a
    fresh import never throws "price not configured". (That's why gpt-image-1.5
    is intentionally absent — it has no default price.)
  - `testModel` is a cheap, real model of the right modality so the channel
    "Test" button works out of the box.

`type` corresponds to constant/channel.go ChannelType* constants on the Go
backend. Operators can always expand a channel's model list afterwards via the
edit form or "detect upstream models".
*/

export type ProviderModality = 'chat' | 'image' | 'embedding'

export type ProviderPreset = {
  id: string
  name: string
  type: number
  modality: ProviderModality
  models: string
  /** Cheap real model used by the channel "Test" button. */
  testModel?: string
  baseUrl?: string
  docsUrl?: string
  description: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  // ── Chat ────────────────────────────────────────────────────────────────
  {
    id: 'openai-chat',
    name: 'OpenAI · 对话',
    type: 1,
    modality: 'chat',
    models: 'gpt-5,gpt-4o,gpt-4o-mini',
    testModel: 'gpt-4o-mini',
    docsUrl: 'https://platform.openai.com/api-keys',
    description: '对话 / GPT-5 · gpt-4o · gpt-4o-mini',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude · 对话',
    type: 14,
    modality: 'chat',
    models:
      'claude-opus-4-8,claude-opus-4-7,claude-sonnet-4-6,claude-3-5-haiku-latest',
    testModel: 'claude-3-5-haiku-latest',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    description: '对话 / Opus 4.8 · Sonnet 4.6 · Haiku',
  },
  {
    id: 'gemini',
    name: 'Google Gemini · 对话',
    type: 24,
    modality: 'chat',
    models: 'gemini-3-pro,gemini-2.5-pro,gemini-2.5-flash',
    testModel: 'gemini-2.5-flash',
    docsUrl: 'https://aistudio.google.com/apikey',
    description: '对话 / Gemini 3 Pro · 2.5 Pro / Flash',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek · 对话',
    type: 43,
    modality: 'chat',
    models: 'deepseek-chat,deepseek-reasoner',
    testModel: 'deepseek-chat',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    description: '对话 / deepseek-chat (V3) · reasoner (R1)',
  },
  {
    id: 'qwen',
    name: 'Qwen 通义千问 · 对话',
    type: 17,
    modality: 'chat',
    models: 'qwen-max,qwen-plus,qwen-turbo',
    testModel: 'qwen-turbo',
    docsUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
    description: '对话 / qwen-max · plus · turbo（阿里）',
  },
  {
    id: 'moonshot',
    name: 'Moonshot Kimi · 对话',
    type: 25,
    modality: 'chat',
    models: 'moonshot-v1-8k,moonshot-v1-32k,moonshot-v1-128k,kimi-k2-0905-preview',
    testModel: 'moonshot-v1-8k',
    docsUrl: 'https://platform.moonshot.cn/console/api-keys',
    description: '对话 / moonshot-v1 · kimi-k2',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter · 对话（聚合）',
    type: 20,
    modality: 'chat',
    models:
      'anthropic/claude-opus-4-7,openai/gpt-4o,google/gemini-2.5-pro',
    testModel: 'openai/gpt-4o',
    docsUrl: 'https://openrouter.ai/keys',
    description: '对话 / 聚合多家，按调用付费',
  },
  // ── Image ───────────────────────────────────────────────────────────────
  {
    id: 'openai-image',
    name: 'OpenAI · 画图',
    type: 1,
    modality: 'image',
    // gpt-image-1 + dall-e-3 are real and priced. Newer image models (e.g.
    // gpt-image-2) — add via "detect upstream models" once your account has them.
    models: 'gpt-image-1,dall-e-3',
    testModel: 'gpt-image-1',
    docsUrl: 'https://platform.openai.com/api-keys',
    description: '画图 / gpt-image-1 · dall-e-3（走 /v1/images/generations）',
  },
  // ── Embeddings & Audio ────────────────────────────────────────────────────
  {
    id: 'openai-embed',
    name: 'OpenAI · 向量 / 语音',
    type: 1,
    modality: 'embedding',
    models: 'text-embedding-3-small,text-embedding-3-large,whisper-1,tts-1',
    testModel: 'text-embedding-3-small',
    docsUrl: 'https://platform.openai.com/api-keys',
    description: '向量 / 语音 / embeddings · whisper · tts',
  },
]
