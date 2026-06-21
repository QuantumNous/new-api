/*
Provider presets for the "Quick Import" dialog. Each entry maps to a single
channel that will be created in disabled state (status=2) with a placeholder
key, so the operator can enable + fill the real key without typing the rest
of the form every time.

Design goals (kept deliberately beginner-proof):
  - One preset = one provider + ONE modality (chat / image / embedding-audio).
    Mixing image + chat in one channel is the #1 source of confusion: image
    models can't be tested with a chat request and behave differently.
  - Every model listed here is an EXACT key in setting/ratio_setting (chat:
    defaultModelRatio, image: defaultModelPrice) so a fresh import never throws
    "price not configured". Input pricing has NO prefix/alias fallback, so we
    use exact, dated model names where the provider has no stable alias
    (e.g. claude-sonnet-4-5-20250929, not claude-sonnet-4-6).
  - `testModel` is a cheap, real model of the right modality so the channel
    "Test" button works out of the box.

Moonshot/Kimi, Doubao/VolcEngine and Mistral ship with BOOTSTRAP default
prices (see model_ratio.go) — approximate list prices so import doesn't error;
run a models.dev price sync to get exact rates before charging customers.

Still omitted (no clean default price / aggregator): Groq, OpenRouter. Add
those manually + sync prices if you need them.

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
    models: 'gpt-5.5,gpt-5,gpt-4o,gpt-4o-mini',
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
      'claude-opus-4-8,claude-sonnet-4-6,claude-haiku-4-5-20251001',
    testModel: 'claude-haiku-4-5-20251001',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    description: '对话 / Opus 4.8 · Sonnet 4.5 · Haiku 4.5',
  },
  {
    id: 'gemini',
    name: 'Google Gemini · 对话',
    type: 24,
    modality: 'chat',
    models: 'gemini-3.1-pro,gemini-3-pro,gemini-2.5-pro,gemini-2.5-flash',
    testModel: 'gemini-2.5-flash',
    docsUrl: 'https://aistudio.google.com/apikey',
    description: '对话 / Gemini 3 Pro · 2.5 Pro / Flash',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek · 对话',
    type: 43,
    modality: 'chat',
    models: 'deepseek-v4-pro,deepseek-v4-flash,deepseek-chat,deepseek-reasoner',
    testModel: 'deepseek-chat',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    description: '对话 / deepseek-chat (V3) · reasoner (R1)',
  },
  {
    id: 'qwen',
    name: 'Qwen 通义千问 · 对话',
    type: 17,
    modality: 'chat',
    models: 'qwen3-max,qwen-plus,qwen-flash,qwen-turbo',
    testModel: 'qwen-turbo',
    docsUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
    description: '对话 / qwen-plus · qwen-turbo（阿里）',
  },
  {
    id: 'zhipu-glm',
    name: '智谱 GLM · 对话',
    type: 26,
    modality: 'chat',
    models: 'glm-5,glm-4.7,glm-4.5-air,glm-4-flash',
    testModel: 'glm-4-flash',
    docsUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    description: '对话 / glm-4-plus · air · flash（智谱）',
  },
  {
    id: 'xai-grok',
    name: 'xAI Grok · 对话',
    type: 48,
    modality: 'chat',
    models: 'grok-4.3,grok-2',
    testModel: 'grok-2',
    docsUrl: 'https://console.x.ai',
    description: '对话 / grok-3 · grok-2（xAI）',
  },
  {
    id: 'moonshot',
    name: 'Moonshot Kimi · 对话',
    type: 25,
    modality: 'chat',
    models: 'kimi-k2.6,moonshot-v1-8k,moonshot-v1-32k,moonshot-v1-128k,kimi-k2-0905-preview',
    testModel: 'moonshot-v1-8k',
    docsUrl: 'https://platform.moonshot.cn/console/api-keys',
    description: '对话 / moonshot-v1 · kimi-k2（价格为估值，请同步核对）',
  },
  {
    id: 'doubao',
    name: 'Doubao 豆包 · 对话',
    type: 45,
    modality: 'chat',
    models: 'doubao-seed-2.0-pro,doubao-seed-2.0-lite,doubao-pro-32k,doubao-pro-128k,doubao-lite-32k',
    testModel: 'doubao-lite-32k',
    docsUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    description: '对话 / 豆包 pro / lite（价格为估值，请同步核对）',
  },
  {
    id: 'mistral',
    name: 'Mistral AI · 对话',
    type: 42,
    modality: 'chat',
    models:
      'mistral-large-latest,mistral-medium-latest,mistral-small-latest,codestral-latest',
    testModel: 'mistral-small-latest',
    docsUrl: 'https://console.mistral.ai/api-keys',
    description: '对话 / large · medium · small · codestral（价格为估值，请同步核对）',
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
  {
    id: 'elevenlabs',
    name: 'ElevenLabs · 语音合成',
    type: 58,
    modality: 'embedding',
    models:
      'eleven_multilingual_v2,eleven_turbo_v2_5,eleven_flash_v2_5,eleven_multilingual_v1',
    testModel: 'eleven_flash_v2_5',
    docsUrl: 'https://elevenlabs.io/app/settings/api-keys',
    description:
      '语音 / TTS（走 /v1/audio/speech，voice=voice_id；价格为估值，请核对）',
  },
]
