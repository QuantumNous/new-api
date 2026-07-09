export type ModelTab = {
  label: string
  modelId: string
  accent: string
}

export const MODEL_TABS: ModelTab[] = [
  { label: 'Fable 5', modelId: 'claude-fable-5', accent: '#a855f7' },
  { label: 'Sonnet 5', modelId: 'claude-sonnet-5', accent: '#a855f7' },
  { label: 'GPT 5.4', modelId: 'gpt-5.4', accent: '#22d3ee' },
  { label: 'GPT 5.4 Mini', modelId: 'gpt-5.4-mini', accent: '#22d3ee' },
  { label: 'GPT 5.5', modelId: 'gpt-5.5', accent: '#22d3ee' },
  { label: 'Sonnet 4.6', modelId: 'claude-sonnet-4-6', accent: '#a855f7' },
  { label: 'Opus 4.7', modelId: 'claude-opus-4-7', accent: '#a855f7' },
  { label: 'Opus 4.8', modelId: 'claude-opus-4-8', accent: '#a855f7' },
  { label: 'Haiku 4.5', modelId: 'claude-haiku-4-5', accent: '#a855f7' },
  { label: 'DeepSeek Flash', modelId: 'deepseek-v4-flash', accent: '#a78bfa' },
  { label: 'DeepSeek Pro', modelId: 'deepseek-v4-pro', accent: '#a78bfa' },
  { label: 'MiniMax M3', modelId: 'minimax-m3', accent: '#f97316' },
  { label: 'Kimi K2.7 Code', modelId: 'kimi-k2.7-code', accent: '#818cf8' },
  { label: 'MiMo v2.5 Pro', modelId: 'mimo-v2.5-pro', accent: '#f97316' },
  { label: 'MiMo v2.5', modelId: 'mimo-v2.5', accent: '#fb923c' },
  { label: 'Qwen 3.7 Max', modelId: 'qwen3.7-max', accent: '#06b6d4' },
  { label: 'Qwen 3.7 Plus', modelId: 'qwen3.7-plus', accent: '#06b6d4' },
  {
    label: 'Doubao Seed 2.1 Pro',
    modelId: 'doubao-seed-2-1-pro-260628',
    accent: '#f97316',
  },
  {
    label: 'Doubao Seed 2.1 Turbo',
    modelId: 'doubao-seed-2-1-turbo-260628',
    accent: '#fb923c',
  },
  { label: 'GLM 5.2', modelId: 'glm-5.2', accent: '#10b981' },
  {
    label: 'Gemini 3.1 Pro',
    modelId: 'gemini-3.1-pro-preview',
    accent: '#4285f4',
  },
  {
    label: 'Gemini 3.5 Flash',
    modelId: 'gemini-3.5-flash',
    accent: '#4285f4',
  },
  {
    label: 'Nano Banana 2',
    modelId: 'gemini-3.1-flash-image-preview',
    accent: '#4285f4',
  },
  { label: 'Image 2', modelId: 'gpt-image-2', accent: '#22d3ee' },
  { label: 'Sora 2', modelId: 'sora-2', accent: '#22d3ee' },
  { label: 'Sora 2 Pro', modelId: 'sora-2-pro', accent: '#22d3ee' },
  {
    label: 'Kling Motion Control',
    modelId: 'kling-v3-motion-control',
    accent: '#f97316',
  },
]
