/*
Provider presets for the "Quick Import" dialog. Each entry maps to a single
channel that will be created in disabled state (status=2) with a placeholder
key, so the operator can enable + fill the real key without typing the rest
of the form every time.

`type` corresponds to constant/channel.go ChannelType* constants on the Go
backend. `models` is the comma-separated default list shown in the form; the
operator can edit per-channel after creation.

Model lists target late-2025 / 2026 generally-available offerings. Keep them
narrow rather than exhaustive — operators expand per-channel as needed.
*/

export type ProviderPreset = {
  id: string
  name: string
  type: number
  models: string
  baseUrl?: string
  docsUrl?: string
  description: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 1,
    // gpt-image-2 became the default image model on 2026-04-21 (replaced DALL-E on 2026-05-12).
    // gpt-image-1.5 / chatgpt-image-latest dropped: no default price → "price not configured".
    models:
      'gpt-5.5,gpt-5,gpt-5-mini,gpt-4o,gpt-4o-mini,gpt-4o-audio-preview,gpt-image-2,text-embedding-3-small,text-embedding-3-large,whisper-1,tts-1',
    docsUrl: 'https://platform.openai.com/api-keys',
    description: 'gpt-5.5 / gpt-5 · gpt-4o · gpt-image-2 · embeddings · whisper · tts',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    type: 14,
    models:
      'claude-opus-4-8,claude-opus-4-7,claude-sonnet-4-6,claude-3-5-haiku-latest,claude-3-5-sonnet-latest',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    description: 'Opus 4.8 / 4.7 · Sonnet 4.6 · Haiku 3.5',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    type: 24,
    models:
      'gemini-3-pro,gemini-2.5-pro,gemini-2.5-flash,gemini-2.0-flash,text-embedding-004',
    docsUrl: 'https://aistudio.google.com/apikey',
    description: 'Gemini 3 Pro · 2.5 Pro / Flash · embeddings',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 43,
    models: 'deepseek-chat,deepseek-reasoner',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    description: 'deepseek-chat · deepseek-reasoner (R1)',
  },
  {
    id: 'qwen',
    name: 'Qwen (阿里 DashScope)',
    type: 17,
    models: 'qwen-max,qwen-plus,qwen-turbo,qwen2.5-coder-32b-instruct',
    docsUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
    description: 'qwen-max · qwen-plus · 通义千问',
  },
  {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    type: 25,
    models:
      'moonshot-v1-8k,moonshot-v1-32k,moonshot-v1-128k,kimi-k2-0905-preview',
    docsUrl: 'https://platform.moonshot.cn/console/api-keys',
    description: 'moonshot-v1 · kimi-k2',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    type: 42,
    models:
      'mistral-large-latest,mistral-medium-latest,mistral-small-latest,codestral-latest',
    docsUrl: 'https://console.mistral.ai/api-keys',
    description: 'large · medium · small · codestral',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 20,
    models:
      'anthropic/claude-opus-4-7,openai/gpt-4o,google/gemini-2.5-pro,meta-llama/llama-3.3-70b-instruct',
    docsUrl: 'https://openrouter.ai/keys',
    description: '聚合多 provider，按调用付费',
  },
  {
    id: 'doubao',
    name: 'Doubao (火山方舟)',
    type: 40,
    models: 'doubao-pro-32k,doubao-pro-128k,doubao-lite-32k',
    docsUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    description: '字节豆包 · pro 32k / 128k',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow (硅基流动)',
    type: 40,
    models:
      'Qwen/Qwen2.5-72B-Instruct,deepseek-ai/DeepSeek-V3,meta-llama/Meta-Llama-3.1-70B-Instruct',
    docsUrl: 'https://cloud.siliconflow.cn/account/ak',
    description: '国内多模型聚合，部署在大陆',
  },
]
