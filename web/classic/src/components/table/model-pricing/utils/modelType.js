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

export const MODEL_TYPES = [
  { value: 'text', label: '文本', color: 'blue', rank: 1 },
  { value: 'image', label: '图像', color: 'cyan', rank: 2 },
  { value: 'video', label: '视频', color: 'purple', rank: 3 },
  { value: 'audio', label: '音频', color: 'green', rank: 4 },
  { value: 'code', label: '编码', color: 'orange', rank: 5 },
  { value: 'general', label: '通用', color: 'white', rank: 6 },
];

export const ALL_MODEL_TYPE_OPTION = {
  value: 'all',
  label: '全部',
  color: 'white',
  rank: 0,
};

const TYPE_KEYWORDS = [
  {
    value: 'image',
    keywords: [
      'image',
      'vision',
      'draw',
      'stable-diffusion',
      'dall-e',
      'midjourney',
      'flux',
    ],
    patterns: [/\bsd\b/, /\bsd[-_]/],
  },
  {
    value: 'video',
    keywords: ['video', 'kling', 'runway', 'veo', 'sora'],
  },
  {
    value: 'audio',
    keywords: ['audio', 'tts', 'stt', 'speech', 'voice', 'music', 'suno'],
  },
  {
    value: 'code',
    keywords: ['code', 'coder', 'coding', 'dev', 'developer', 'programming'],
  },
  {
    value: 'text',
    keywords: [
      'chat',
      'text',
      'completion',
      'responses',
      'embedding',
      'gpt',
      'claude',
      'gemini',
      'deepseek',
      'qwen',
      'llama',
    ],
  },
];

const TYPE_MAP = MODEL_TYPES.reduce((map, type) => {
  map[type.value] = type;
  return map;
}, {});

const toText = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).join(' ');
  return value ? String(value) : '';
};

const buildText = (values) =>
  values.map(toText).filter(Boolean).join(' ').toLowerCase();

const matchesKeywords = (text, config) =>
  config.keywords.some((keyword) => text.includes(keyword)) ||
  (config.patterns || []).some((pattern) => pattern.test(text));

const inferTypeValue = (primaryText, secondaryText) => {
  const primaryMatch = TYPE_KEYWORDS.find((config) =>
    matchesKeywords(primaryText, config),
  );
  if (primaryMatch) return primaryMatch.value;

  const secondaryMatch = TYPE_KEYWORDS.find((config) =>
    matchesKeywords(secondaryText, config),
  );
  return secondaryMatch?.value || 'general';
};

export const getModelType = (model) => {
  const primaryText = buildText([model?.supported_endpoint_types, model?.tags]);
  const secondaryText = buildText([
    model?.model_name,
    model?.vendor_name,
    model?.description,
  ]);
  return (
    TYPE_MAP[inferTypeValue(primaryText, secondaryText)] || TYPE_MAP.general
  );
};

export const getModelTypeLabel = (value) =>
  (value === ALL_MODEL_TYPE_OPTION.value
    ? ALL_MODEL_TYPE_OPTION
    : TYPE_MAP[value]
  )?.label || TYPE_MAP.general.label;

export const getModelTypeRank = (model) => getModelType(model).rank;
