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

export const CHANNEL_OPTIONS = [
  { value: 1, color: 'green', label: 'OpenAI' },
  {
    value: 2,
    color: 'red',
    label: 'Midjourney Proxy',
  },
  {
    value: 5,
    color: 'red',
    label: 'Midjourney Proxy Plus',
  },
  {
    value: 36,
    color: 'red',
    label: 'Suno API',
  },
  { value: 4, color: 'grey', label: 'Ollama' },
  {
    value: 14,
    color: 'red',
    label: 'Anthropic Claude',
  },
  {
    value: 33,
    color: 'red',
    label: 'AWS Claude',
  },
  { value: 41, color: 'red', label: 'Vertex AI' },
  {
    value: 3,
    color: 'green',
    label: 'Azure OpenAI',
  },
  {
    value: 34,
    color: 'red',
    label: 'Cohere',
  },
  { value: 39, color: 'grey', label: 'Cloudflare' },
  { value: 43, color: 'red', label: 'DeepSeek' },
  {
    value: 15,
    color: 'red',
    label: '百度文心千帆',
  },
  {
    value: 46,
    color: 'red',
    label: '百度文心千帆V2',
  },
  {
    value: 17,
    color: 'orange',
    label: '阿里通义千问',
  },
  {
    value: 18,
    color: 'red',
    label: '讯飞星火认知',
  },
  {
    value: 16,
    color: 'red',
    label: '智谱 ChatGLM（已经弃用，请使用智谱 GLM-4V）',
  },
  {
    value: 26,
    color: 'red',
    label: '智谱 GLM-4V',
  },
  {
    value: 27,
    color: 'red',
    label: 'Perplexity',
  },
  {
    value: 24,
    color: 'orange',
    label: 'Google Gemini',
  },
  {
    value: 11,
    color: 'orange',
    label: 'Google PaLM2',
  },
  {
    value: 47,
    color: 'red',
    label: 'Xinference',
  },
  { value: 25, color: 'green', label: 'Moonshot' },
  { value: 20, color: 'green', label: 'OpenRouter' },
  { value: 19, color: 'red', label: '360 智脑' },
  { value: 23, color: 'green', label: '腾讯混元' },
  { value: 31, color: 'green', label: '零一万物' },
  { value: 35, color: 'green', label: 'MiniMax' },
  { value: 37, color: 'green', label: 'Dify' },
  { value: 38, color: 'red', label: 'Jina' },
  { value: 40, color: 'red', label: 'SiliconCloud' },
  { value: 42, color: 'red', label: 'Mistral AI' },
  { value: 8, color: 'red', label: '自定义渠道' },
  {
    value: 22,
    color: 'red',
    label: '知识库：FastGPT',
  },
  {
    value: 21,
    color: 'red',
    label: '知识库：AI Proxy',
  },
  {
    value: 44,
    color: 'red',
    label: '嵌入模型：MokaAI M3E',
  },
  {
    value: 45,
    color: 'red',
    label: '字节火山方舟、豆包通用',
  },
  {
    value: 48,
    color: 'red',
    label: 'xAI',
  },
  {
    value: 49,
    color: 'red',
    label: 'Coze',
  },
  {
    value: 50,
    color: 'green',
    label: '可灵',
  },
  {
    value: 51,
    color: 'red',
    label: '即梦',
  },
  {
    value: 52,
    color: 'red',
    label: 'Vidu',
  },
  {
    value: 53,
    color: 'red',
    label: 'SubModel',
  },
  {
    value: 54,
    color: 'red',
    label: '豆包视频',
  },
  {
    value: 55,
    color: 'green',
    label: 'Sora',
  },
  {
    value: 56,
    color: 'red',
    label: 'Replicate',
  },
  {
    value: 57,
    color: 'red',
    label: 'Codex (OpenAI OAuth)',
  },
];

// Channel types that support upstream model list fetching in UI.
export const MODEL_FETCHABLE_CHANNEL_TYPES = new Set([
  1, 4, 14, 34, 17, 26, 27, 24, 47, 25, 20, 23, 31, 40, 42, 48, 43,
]);

export const MODEL_TABLE_PAGE_SIZE = 10;
