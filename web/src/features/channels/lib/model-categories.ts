/*
Copyright (C) 2023-2026 QuantumNous

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

type ModelCategoryRule = {
  name: string
  keywords?: readonly string[]
  pattern?: RegExp
}

// Rules are ordered so platform-specific IDs such as Perplexity's Sonar and
// NVIDIA's Nemotron take precedence over the base Llama/Mixtral family name.
const MODEL_CATEGORY_RULES: readonly ModelCategoryRule[] = [
  { name: 'Perplexity', keywords: ['perplexity', 'sonar-'] },
  { name: 'NVIDIA', keywords: ['nvidia/', 'nvidia.', 'nemotron'] },
  {
    name: 'OpenAI',
    keywords: [
      'openai/',
      'openai.',
      'gpt-',
      'chatgpt-',
      'codex-',
      'dall-e-',
      'whisper-',
      'tts-',
      'omni-moderation-',
      'text-moderation-',
      'text-embedding-ada-',
      'text-embedding-3-',
      'text-ada-',
      'text-babbage-',
      'text-curie-',
      'davinci-',
      'babbage-',
      'computer-use-preview',
      'sora',
    ],
    pattern: /(?:^|[/.:])o(?:1|3|4)(?=$|[-.:])/,
  },
  { name: 'Anthropic', keywords: ['anthropic', 'claude'] },
  {
    name: 'Gemini',
    keywords: [
      'gemini',
      'gemma',
      'learnlm',
      'imagen',
      'veo',
      'nano-banana',
      'palm-',
    ],
    pattern: /(?:^|[/.:])aqa$/,
  },
  { name: 'xAI', keywords: ['x-ai/', 'xai/', 'xai-', 'grok'] },
  { name: 'DeepSeek', keywords: ['deepseek'] },
  {
    name: 'Qwen',
    keywords: ['qwen', 'qwq-', 'qvq-', 'tongyi', 'gte-'],
    pattern: /(?:^|[/.:])(?:text-embedding-v\d+|gui-plus|z-image)(?:$|[-_.:])/,
  },
  { name: 'Wan', pattern: /(?:^|[/.:])wan(?:x?\d|[-_])/ },
  { name: 'Moonshot', keywords: ['moonshot', 'kimi-'] },
  {
    name: 'MiniMax',
    keywords: ['minimax', 'abab', 'hailuo'],
    pattern: /^(?:t2v|i2v|s2v)-01(?:-|$)/,
  },
  {
    name: 'Doubao',
    keywords: ['doubao', 'volcengine', 'seedance', 'seedream', 'seed-1-'],
  },
  {
    name: 'Zhipu',
    keywords: ['zhipu', 'zai-org', 'thudm', 'chatglm', 'cogview', 'cogvideo'],
    pattern: /(?:^|[/._-])glm(?=$|[-._])/,
  },
  { name: 'Baidu', keywords: ['baidu', 'wenxin', 'ernie'] },
  { name: 'Yi', keywords: ['01-ai/'], pattern: /(?:^|[/.:])yi(?=$|[-_])/ },
  { name: 'iFlytek', keywords: ['iflytek', 'sparkdesk'] },
  {
    name: 'Tencent',
    keywords: ['tencent', 'hunyuan'],
    pattern: /(?:^|[/.:])hy\d*(?=$|[-_.:])/,
  },
  { name: 'Baichuan', keywords: ['baichuan'] },
  { name: 'InternLM', keywords: ['internlm'] },
  { name: 'StepFun', keywords: ['stepfun', 'step-'] },
  { name: 'MiMo', keywords: ['xiaomi', 'mimo-'] },
  {
    name: 'Mistral',
    keywords: [
      'mistral',
      'mixtral',
      'codestral',
      'ministral',
      'pixtral',
      'magistral',
    ],
  },
  { name: 'Meta', keywords: ['meta-llama', 'llama-', 'llama2', 'llama3'] },
  {
    name: 'Cohere',
    keywords: ['cohere', 'command-', 'c4ai-aya', 'aya-'],
    pattern: /(?:^|[/.:])command$/,
  },
  { name: 'Jina', keywords: ['jinaai', 'jina-'] },
  { name: 'BAAI', keywords: ['baai/', 'bge-'] },
  { name: 'Black Forest Labs', keywords: ['black-forest-labs', 'flux.'] },
  {
    name: 'Microsoft',
    keywords: ['microsoft/'],
    pattern: /(?:^|[/.:])phi(?=$|[-._])/,
  },
  {
    name: 'Amazon',
    keywords: ['amazon/', 'amazon.', 'nova-', 'titan-'],
  },
  { name: 'AI21 Labs', keywords: ['ai21', 'jamba'] },
  {
    name: 'Stability AI',
    keywords: ['stabilityai', 'stable-diffusion', 'stable-image', 'sdxl-'],
  },
  { name: 'Nous Research', keywords: ['nousresearch', 'hermes-'] },
  { name: '360 AI', keywords: ['360gpt', '360zhinao'] },
  { name: 'Midjourney', keywords: ['midjourney', 'mj_', 'mj-', 'swap_face'] },
  { name: 'Kling', keywords: ['kling'] },
  { name: 'Vidu', keywords: ['vidu'] },
  { name: 'Suno', keywords: ['suno'] },
  { name: 'Jimeng', keywords: ['jimeng'] },
]

export function getModelCategory(modelName: string): string {
  const normalizedName = modelName.trim().toLowerCase()

  for (const rule of MODEL_CATEGORY_RULES) {
    if (
      rule.keywords?.some((keyword) => normalizedName.includes(keyword)) ||
      rule.pattern?.test(normalizedName)
    ) {
      return rule.name
    }
  }

  return 'Other'
}

export function categorizeModels(
  models: readonly string[]
): Record<string, string[]> {
  const categories: Record<string, string[]> = {}

  for (const model of models) {
    const category = getModelCategory(model)
    categories[category] ??= []
    categories[category].push(model)
  }

  return categories
}
