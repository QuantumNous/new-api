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

export const CHANNEL_TYPE_MINIMAX = 35;
export const CHANNEL_TYPE_CODEX = 57;
export const CHANNEL_TYPE_ZHIPU_V4 = 26;
export const CHANNEL_TYPE_MOONSHOT = 25;
export const CHANNEL_TYPE_AGNES_AI = 63;
export const CHANNEL_TYPE_ZENMUX = 64;
export const CHANNEL_TYPE_OPENCODE = 65;
export const CHANNEL_TYPE_MOARK = 66;
export const CHANNEL_TYPE_ADVANCED_CUSTOM = 67;
export const CHANNEL_TYPE_CEREBRAS = 68;
export const CHANNEL_TYPE_QWEN_TOKEN_PLAN = 69;
export const CHANNEL_TYPE_GMICLOUD = 71;
export const CHANNEL_TYPE_GEMINI_INTERACTIONS = 72;
export const CHANNEL_TYPE_CLIPROXYAPI = 73;
export const CHANNEL_TYPE_GROQ = 74;
export const CHANNEL_TYPE_STEPFUN = 75;
export const CHANNEL_TYPE_TYPESAFE = 76;
export const CHANNEL_TYPE_SUB2API = 77;
export const CHANNEL_TYPE_NEWAPI = 78;
export const CHANNEL_TYPE_VLLM = 79;
export const CHANNEL_TYPE_SGLANG = 80;

export const CHANNEL_OPTIONS = [
  { value: 1, color: 'green', label: 'OpenAI' },
  {
    value: 2,
    color: 'light-blue',
    label: 'MjProxy',
  },
  {
    value: 5,
    color: 'blue',
    label: 'MjProxyPlus',
  },
  {
    value: 36,
    color: 'purple',
    label: 'Suno API',
  },
  { value: 4, color: 'grey', label: 'Ollama' },
  {
    value: 14,
    color: 'indigo',
    label: 'Anthropic Claude',
  },
  {
    value: 33,
    color: 'indigo',
    label: 'AWS Claude',
  },
  { value: 41, color: 'blue', label: 'Vertex AI' },
  {
    value: 3,
    color: 'teal',
    label: 'Azure OpenAI',
  },
  {
    value: 34,
    color: 'purple',
    label: 'Cohere',
  },
  { value: 39, color: 'grey', label: 'Cloudflare' },
  { value: 43, color: 'blue', label: 'DeepSeek' },
  { value: CHANNEL_TYPE_CEREBRAS, color: 'blue', label: 'Cerebras' },
  { value: CHANNEL_TYPE_GROQ, color: 'orange', label: 'Groq' },
  { value: CHANNEL_TYPE_STEPFUN, color: 'blue', label: 'StepFun' },
  { value: CHANNEL_TYPE_TYPESAFE, color: 'purple', label: 'TypeSafe' },
  {
    value: 15,
    color: 'blue',
    label: '百度文心千帆',
  },
  {
    value: 46,
    color: 'blue',
    label: '百度文心千帆V2',
  },
  {
    value: 17,
    color: 'orange',
    label: '阿里通义千问',
  },
  {
    value: CHANNEL_TYPE_QWEN_TOKEN_PLAN,
    color: 'cyan',
    label: 'Qwen Token Plan',
  },
  {
    value: 70,
    color: 'blue',
    label: 'Mistral Console',
  },
  {
    value: CHANNEL_TYPE_GMICLOUD,
    color: 'blue',
    label: 'GMI Cloud',
  },
  {
    value: 18,
    color: 'blue',
    label: '讯飞星火认知',
  },
  {
    value: 16,
    color: 'violet',
    label: '智谱 ChatGLM（已经弃用，请使用智谱 GLM-4V）',
  },
  {
    value: 26,
    color: 'purple',
    label: '智谱 GLM-4V',
  },
  {
    value: 27,
    color: 'blue',
    label: 'Perplexity',
  },
  {
    value: 24,
    color: 'orange',
    label: 'Google Gemini',
  },
  {
    value: 72,
    color: 'purple',
    label: 'Gemini Interactions',
  },
  {
    value: CHANNEL_TYPE_CLIPROXYAPI,
    color: 'blue',
    label: 'CLIProxyAPI',
  },
  {
    value: 11,
    color: 'orange',
    label: 'Google PaLM2',
  },
  {
    value: 47,
    color: 'blue',
    label: 'Xinference',
  },
  { value: 25, color: 'green', label: 'Moonshot' },
  { value: 20, color: 'green', label: 'OpenRouter' },
  { value: 19, color: 'blue', label: '360 智脑' },
  { value: 23, color: 'teal', label: '腾讯混元' },
  { value: 31, color: 'green', label: '零一万物' },
  { value: CHANNEL_TYPE_MINIMAX, color: 'green', label: 'MiniMax' },
  { value: 37, color: 'teal', label: 'Dify' },
  { value: 38, color: 'blue', label: 'Jina' },
  { value: 40, color: 'purple', label: 'SiliconCloud' },
  { value: 42, color: 'blue', label: 'Mistral AI' },
  { value: 58, color: 'green', label: 'Kilo Gateway' },
  { value: 59, color: 'purple', label: 'Poe' },
  { value: 8, color: 'pink', label: '自定义渠道' },
  {
    value: CHANNEL_TYPE_ADVANCED_CUSTOM,
    color: 'pink',
    label: '高级自定义渠道',
  },
  {
    value: 22,
    color: 'blue',
    label: '知识库：FastGPT',
  },
  {
    value: 21,
    color: 'purple',
    label: '知识库：AI Proxy',
  },
  {
    value: 44,
    color: 'purple',
    label: '嵌入模型：MokaAI M3E',
  },
  {
    value: 45,
    color: 'blue',
    label: '字节火山方舟、豆包通用',
  },
  {
    value: 48,
    color: 'blue',
    label: 'xAI',
  },
  {
    value: 49,
    color: 'blue',
    label: 'Coze',
  },
  {
    value: 50,
    color: 'green',
    label: '可灵',
  },
  {
    value: 51,
    color: 'blue',
    label: '即梦',
  },
  {
    value: 52,
    color: 'purple',
    label: 'Vidu',
  },
  {
    value: 53,
    color: 'blue',
    label: 'SubModel',
  },
  {
    value: 54,
    color: 'blue',
    label: '豆包视频',
  },
  {
    value: 55,
    color: 'green',
    label: 'Sora',
  },
  {
    value: 56,
    color: 'blue',
    label: 'Replicate',
  },
  {
    value: CHANNEL_TYPE_CODEX,
    color: 'blue',
    label: 'ChatGPT Subscription (Codex)',
  },
  {
    value: 60,
    color: 'blue',
    label: '讯飞星辰MaaS',
  },
  {
    value: 61,
    color: 'cyan',
    label: '讯飞星辰MaaS图片生成',
  },
  {
    value: 62,
    color: 'green',
    label: 'XiaomiMiMo',
  },
  {
    value: CHANNEL_TYPE_AGNES_AI,
    color: 'blue',
    label: 'AgnesAI',
  },
  {
    value: CHANNEL_TYPE_ZENMUX,
    color: 'blue',
    label: 'ZenMux',
  },
  {
    value: CHANNEL_TYPE_OPENCODE,
    color: 'blue',
    label: 'OpenCode',
  },
  {
    value: CHANNEL_TYPE_MOARK,
    color: 'blue',
    label: '模力方舟',
  },
  {
    value: CHANNEL_TYPE_SUB2API,
    color: 'blue',
    label: 'Sub2API',
  },
  {
    value: CHANNEL_TYPE_NEWAPI,
    color: 'blue',
    label: 'New API',
  },
  {
    value: CHANNEL_TYPE_VLLM,
    color: 'purple',
    label: 'vLLM',
  },
  {
    value: CHANNEL_TYPE_SGLANG,
    color: 'orange',
    label: 'SGLang',
  },
];

// Channel types that support upstream model list fetching in UI.
// 注意：与 web/default/src/features/channels/constants.ts 的 MODEL_FETCHABLE_TYPES 为两份手工同步清单，新增渠道类型时需同时更新。
export const MODEL_FETCHABLE_CHANNEL_TYPES = new Set([
  1,
  4,
  14,
  34,
  17,
  26,
  27,
  24,
  47,
  25,
  20,
  23,
  31,
  CHANNEL_TYPE_MINIMAX,
  40,
  42,
  48,
  43,
  45,
  58,
  59,
  62,
  CHANNEL_TYPE_ZENMUX,
  CHANNEL_TYPE_OPENCODE,
  CHANNEL_TYPE_MOARK,
  CHANNEL_TYPE_CEREBRAS,
  CHANNEL_TYPE_QWEN_TOKEN_PLAN,
  CHANNEL_TYPE_AGNES_AI,
  CHANNEL_TYPE_GMICLOUD,
  CHANNEL_TYPE_GEMINI_INTERACTIONS,
  CHANNEL_TYPE_CLIPROXYAPI,
  CHANNEL_TYPE_GROQ,
  CHANNEL_TYPE_STEPFUN,
  CHANNEL_TYPE_TYPESAFE,
  CHANNEL_TYPE_SUB2API,
  CHANNEL_TYPE_NEWAPI,
  CHANNEL_TYPE_VLLM,
  CHANNEL_TYPE_SGLANG,
]);

export const MODEL_TABLE_PAGE_SIZE = 10;

export function canFetchChannelModels(type, baseURL) {
  if (!MODEL_FETCHABLE_CHANNEL_TYPES.has(type)) return false;
  if (type !== 45) return true;
  const base = (baseURL || '').trim().replace(/\/+$/, '');
  return !(
    base === 'doubao-coding-plan' ||
    base === 'doubao-agent-plan' ||
    /\/api\/(coding|plan)(\/|$)/.test(base)
  );
}
