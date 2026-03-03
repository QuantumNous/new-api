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

import i18next from 'i18next';
import { Modal, Tag, Typography, Avatar } from '@douyinfe/semi-ui';
import { copy, showSuccess } from './utils';
import { MOBILE_BREAKPOINT } from '../hooks/common/useIsMobile';
import { visit } from 'unist-util-visit';
import * as LobeIcons from '@lobehub/icons';
import {
  OpenAI,
  Claude,
  Gemini,
  Moonshot,
  Zhipu,
  Qwen,
  DeepSeek,
  Minimax,
  Wenxin,
  Spark,
  Midjourney,
  Hunyuan,
  Cohere,
  Cloudflare,
  Ai360,
  Yi,
  Jina,
  Mistral,
  XAI,
  Ollama,
  Doubao,
  Suno,
  Xinference,
  OpenRouter,
  Dify,
  Coze,
  SiliconCloud,
  FastGPT,
  Kling,
  Jimeng,
  Perplexity,
  Replicate,
} from '@lobehub/icons';

import {
  LayoutDashboard,
  TerminalSquare,
  MessageSquare,
  Key,
  BarChart3,
  Image as ImageIcon,
  CheckSquare,
  CreditCard,
  Layers,
  Gift,
  User,
  Settings,
  CircleUser,
  Package,
  Server,
  CalendarClock,
} from 'lucide-react';
import {
  SiAtlassian,
  SiAuth0,
  SiAuthentik,
  SiBitbucket,
  SiDiscord,
  SiDropbox,
  SiFacebook,
  SiGitea,
  SiGithub,
  SiGitlab,
  SiGoogle,
  SiKeycloak,
  SiLinkedin,
  SiNextcloud,
  SiNotion,
  SiOkta,
  SiOpenid,
  SiReddit,
  SiSlack,
  SiTelegram,
  SiTwitch,
  SiWechat,
  SiX,
} from 'react-icons/si';

// 获取侧边栏Lucide图标组件
export function getLucideIcon(key, selected = false) {
  const size = 16;
  const strokeWidth = 2;
  const SELECTED_COLOR = 'var(--semi-color-primary)';
  const iconColor = selected ? SELECTED_COLOR : 'currentColor';
  const commonProps = {
    size,
    strokeWidth,
    className: `transition-colors duration-200 ${selected ? 'transition-transform duration-200 scale-105' : ''}`,
  };

  // 根据不同的key返回不同的图标
  switch (key) {
    case 'detail':
      return <LayoutDashboard {...commonProps} color={iconColor} />;
    case 'playground':
      return <TerminalSquare {...commonProps} color={iconColor} />;
    case 'chat':
      return <MessageSquare {...commonProps} color={iconColor} />;
    case 'token':
      return <Key {...commonProps} color={iconColor} />;
    case 'log':
      return <BarChart3 {...commonProps} color={iconColor} />;
    case 'midjourney':
      return <ImageIcon {...commonProps} color={iconColor} />;
    case 'task':
      return <CheckSquare {...commonProps} color={iconColor} />;
    case 'topup':
      return <CreditCard {...commonProps} color={iconColor} />;
    case 'channel':
      return <Layers {...commonProps} color={iconColor} />;
    case 'redemption':
      return <Gift {...commonProps} color={iconColor} />;
    case 'user':
    case 'personal':
      return <User {...commonProps} color={iconColor} />;
    case 'models':
      return <Package {...commonProps} color={iconColor} />;
    case 'deployment':
      return <Server {...commonProps} color={iconColor} />;
    case 'subscription':
      return <CalendarClock {...commonProps} color={iconColor} />;
    case 'setting':
      return <Settings {...commonProps} color={iconColor} />;
    default:
      return <CircleUser {...commonProps} color={iconColor} />;
  }
}

// 获取模型分类
export const getModelCategories = (() => {
  let categoriesCache = null;
  let lastLocale = null;

  return (t) => {
    const currentLocale = i18next.language;
    if (categoriesCache && lastLocale === currentLocale) {
      return categoriesCache;
    }

    categoriesCache = {
      all: {
        label: t('全部模型'),
        icon: null,
        filter: () => true,
      },
      openai: {
        label: 'OpenAI',
        icon: <OpenAI />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('gpt') ||
          model.model_name.toLowerCase().includes('dall-e') ||
          model.model_name.toLowerCase().includes('whisper') ||
          model.model_name.toLowerCase().includes('tts-1') ||
          model.model_name.toLowerCase().includes('text-embedding-3') ||
          model.model_name.toLowerCase().includes('text-moderation') ||
          model.model_name.toLowerCase().includes('babbage') ||
          model.model_name.toLowerCase().includes('davinci') ||
          model.model_name.toLowerCase().includes('curie') ||
          model.model_name.toLowerCase().includes('ada') ||
          model.model_name.toLowerCase().includes('o1') ||
          model.model_name.toLowerCase().includes('o3') ||
          model.model_name.toLowerCase().includes('o4'),
      },
      anthropic: {
        label: 'Anthropic',
        icon: <Claude.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('claude'),
      },
      gemini: {
        label: 'Gemini',
        icon: <Gemini.Color />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('gemini') ||
          model.model_name.toLowerCase().includes('gemma') ||
          model.model_name.toLowerCase().includes('learnlm') ||
          model.model_name.toLowerCase().startsWith('embedding-') ||
          model.model_name.toLowerCase().includes('text-embedding-004') ||
          model.model_name.toLowerCase().includes('imagen-4') ||
          model.model_name.toLowerCase().includes('veo-') ||
          model.model_name.toLowerCase().includes('aqa'),
      },
      moonshot: {
        label: 'Moonshot',
        icon: <Moonshot />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('moonshot') ||
          model.model_name.toLowerCase().includes('kimi'),
      },
      zhipu: {
        label: t('智谱'),
        icon: <Zhipu.Color />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('chatglm') ||
          model.model_name.toLowerCase().includes('glm-') ||
          model.model_name.toLowerCase().includes('cogview') ||
          model.model_name.toLowerCase().includes('cogvideo'),
      },
      qwen: {
        label: t('通义千问'),
        icon: <Qwen.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('qwen'),
      },
      deepseek: {
        label: 'DeepSeek',
        icon: <DeepSeek.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('deepseek'),
      },
      minimax: {
        label: 'MiniMax',
        icon: <Minimax.Color />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('abab') ||
          model.model_name.toLowerCase().includes('minimax'),
      },
      baidu: {
        label: t('文心一言'),
        icon: <Wenxin.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('ernie'),
      },
      xunfei: {
        label: t('讯飞星火'),
        icon: <Spark.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('spark'),
      },
      midjourney: {
        label: 'Midjourney',
        icon: <Midjourney />,
        filter: (model) => model.model_name.toLowerCase().includes('mj_'),
      },
      tencent: {
        label: t('腾讯混元'),
        icon: <Hunyuan.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('hunyuan'),
      },
      cohere: {
        label: 'Cohere',
        icon: <Cohere.Color />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('command') ||
          model.model_name.toLowerCase().includes('c4ai-') ||
          model.model_name.toLowerCase().includes('embed-'),
      },
      cloudflare: {
        label: 'Cloudflare',
        icon: <Cloudflare.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('@cf/'),
      },
      ai360: {
        label: t('360智脑'),
        icon: <Ai360.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('360'),
      },
      jina: {
        label: 'Jina',
        icon: <Jina />,
        filter: (model) => model.model_name.toLowerCase().includes('jina'),
      },
      mistral: {
        label: 'Mistral AI',
        icon: <Mistral.Color />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('mistral') ||
          model.model_name.toLowerCase().includes('codestral') ||
          model.model_name.toLowerCase().includes('pixtral') ||
          model.model_name.toLowerCase().includes('voxtral') ||
          model.model_name.toLowerCase().includes('magistral'),
      },
      xai: {
        label: 'xAI',
        icon: <XAI />,
        filter: (model) => model.model_name.toLowerCase().includes('grok'),
      },
      llama: {
        label: 'Llama',
        icon: <Ollama />,
        filter: (model) => model.model_name.toLowerCase().includes('llama'),
      },
      doubao: {
        label: t('豆包'),
        icon: <Doubao.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('doubao'),
      },
      yi: {
        label: t('零一万物'),
        icon: <Yi.Color />,
        filter: (model) => model.model_name.toLowerCase().includes('yi'),
      },
    };

    lastLocale = currentLocale;
    return categoriesCache;
  };
})();

/**
 * 根据渠道类型返回对应的厂商图标
 * @param {number} channelType - 渠道类型值
 * @returns {JSX.Element|null} - 对应的厂商图标组件
 */
export function getChannelIcon(channelType) {
  const iconSize = 14;

  switch (channelType) {
    case 1: // OpenAI
    case 3: // Azure OpenAI
    case 57: // Codex
      return <OpenAI size={iconSize} />;
    case 2: // Midjourney Proxy
    case 5: // Midjourney Proxy Plus
      return <Midjourney size={iconSize} />;
    case 36: // Suno API
      return <Suno size={iconSize} />;
    case 4: // Ollama
      return <Ollama size={iconSize} />;
    case 14: // Anthropic Claude
    case 33: // AWS Claude
      return <Claude.Color size={iconSize} />;
    case 41: // Vertex AI
      return <Gemini.Color size={iconSize} />;
    case 34: // Cohere
      return <Cohere.Color size={iconSize} />;
    case 39: // Cloudflare
      return <Cloudflare.Color size={iconSize} />;
    case 43: // DeepSeek
      return <DeepSeek.Color size={iconSize} />;
    case 15: // 百度文心千帆
    case 46: // 百度文心千帆V2
      return <Wenxin.Color size={iconSize} />;
    case 17: // 阿里通义千问
      return <Qwen.Color size={iconSize} />;
    case 18: // 讯飞星火认知
      return <Spark.Color size={iconSize} />;
    case 16: // 智谱 ChatGLM
    case 26: // 智谱 GLM-4V
      return <Zhipu.Color size={iconSize} />;
    case 24: // Google Gemini
    case 11: // Google PaLM2
      return <Gemini.Color size={iconSize} />;
    case 47: // Xinference
      return <Xinference.Color size={iconSize} />;
    case 25: // Moonshot
      return <Moonshot size={iconSize} />;
    case 27: // Perplexity
      return <Perplexity.Color size={iconSize} />;
    case 20: // OpenRouter
      return <OpenRouter size={iconSize} />;
    case 19: // 360 智脑
      return <Ai360.Color size={iconSize} />;
    case 23: // 腾讯混元
      return <Hunyuan.Color size={iconSize} />;
    case 31: // 零一万物
      return <Yi.Color size={iconSize} />;
    case 35: // MiniMax
      return <Minimax.Color size={iconSize} />;
    case 37: // Dify
      return <Dify.Color size={iconSize} />;
    case 38: // Jina
      return <Jina size={iconSize} />;
    case 40: // SiliconCloud
      return <SiliconCloud.Color size={iconSize} />;
    case 42: // Mistral AI
      return <Mistral.Color size={iconSize} />;
    case 45: // 字节火山方舟、豆包通用
      return <Doubao.Color size={iconSize} />;
    case 48: // xAI
      return <XAI size={iconSize} />;
    case 49: // Coze
      return <Coze size={iconSize} />;
    case 50: // 可灵 Kling
      return <Kling.Color size={iconSize} />;
    case 51: // 即梦 Jimeng
      return <Jimeng.Color size={iconSize} />;
    case 54: // 豆包视频 Doubao Video
      return <Doubao.Color size={iconSize} />;
    case 56: // Replicate
      return <Replicate size={iconSize} />;
    case 8: // 自定义渠道
    case 22: // 知识库：FastGPT
      return <FastGPT.Color size={iconSize} />;
    case 21: // 知识库：AI Proxy
    case 44: // 嵌入模型：MokaAI M3E
    default:
      return null; // 未知类型或自定义渠道不显示图标
  }
}

/**
 * 根据图标名称动态获取 LobeHub 图标组件
 * 支持：
 * - 基础："OpenAI"、"OpenAI.Color" 等
 * - 额外属性（点号链式）："OpenAI.Avatar.type={'platform'}"、"OpenRouter.Avatar.shape={'square'}"
 * - 继续兼容第二参数 size；若字符串里有 size=，以字符串为准
 * @param {string} iconName - 图标名称/描述
 * @param {number} size - 图标大小，默认为 14
 * @returns {JSX.Element} - 对应的图标组件或 Avatar
 */
export function getLobeHubIcon(iconName, size = 14) {
  if (typeof iconName === 'string') iconName = iconName.trim();
  // 如果没有图标名称，返回 Avatar
  if (!iconName) {
    return <Avatar size='extra-extra-small'>?</Avatar>;
  }

  // 解析组件路径与点号链式属性
  const segments = String(iconName).split('.');
  const baseKey = segments[0];
  const BaseIcon = LobeIcons[baseKey];

  let IconComponent = undefined;
  let propStartIndex = 1;

  if (BaseIcon && segments.length > 1 && BaseIcon[segments[1]]) {
    IconComponent = BaseIcon[segments[1]];
    propStartIndex = 2;
  } else {
    IconComponent = LobeIcons[baseKey];
    propStartIndex = 1;
  }

  // 失败兜底
  if (
    !IconComponent ||
    (typeof IconComponent !== 'function' && typeof IconComponent !== 'object')
  ) {
    const firstLetter = String(iconName).charAt(0).toUpperCase();
    return <Avatar size='extra-extra-small'>{firstLetter}</Avatar>;
  }

  // 解析点号链式属性，形如：key={...}、key='...'、key="..."、key=123、key、key=true/false
  const props = {};

  const parseValue = (raw) => {
    if (raw == null) return true;
    let v = String(raw).trim();
    // 去除一层花括号包裹
    if (v.startsWith('{') && v.endsWith('}')) {
      v = v.slice(1, -1).trim();
    }
    // 去除引号
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      return v.slice(1, -1);
    }
    // 布尔
    if (v === 'true') return true;
    if (v === 'false') return false;
    // 数字
    if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v);
    // 其他原样返回字符串
    return v;
  };

  for (let i = propStartIndex; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) continue;
    const eqIdx = seg.indexOf('=');
    if (eqIdx === -1) {
      props[seg.trim()] = true;
      continue;
    }
    const key = seg.slice(0, eqIdx).trim();
    const valRaw = seg.slice(eqIdx + 1).trim();
    props[key] = parseValue(valRaw);
  }

  // 兼容第二参数 size，若字符串中未显式指定 size，则使用函数入参
  if (props.size == null && size != null) props.size = size;

  return <IconComponent {...props} />;
}

const oauthProviderIconMap = {
  github: SiGithub,
  gitlab: SiGitlab,
  gitea: SiGitea,
  google: SiGoogle,
  discord: SiDiscord,
  facebook: SiFacebook,
  linkedin: SiLinkedin,
  x: SiX,
  twitter: SiX,
  slack: SiSlack,
  telegram: SiTelegram,
  wechat: SiWechat,
  keycloak: SiKeycloak,
  nextcloud: SiNextcloud,
  authentik: SiAuthentik,
  openid: SiOpenid,
  okta: SiOkta,
  auth0: SiAuth0,
  atlassian: SiAtlassian,
  bitbucket: SiBitbucket,
  notion: SiNotion,
  twitch: SiTwitch,
  reddit: SiReddit,
  dropbox: SiDropbox,
};

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || '');
}

function isSimpleEmoji(value) {
  if (!value) return false;
  const trimmed = String(value).trim();
  return trimmed.length > 0 && trimmed.length <= 4 && !isHttpUrl(trimmed);
}

function normalizeOAuthIconKey(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^ri:/, '')
    .replace(/^react-icons:/, '')
    .replace(/^si:/, '');
}

/**
 * Render custom OAuth provider icon with react-icons or URL/emoji fallback.
 * Supported formats:
 * - react-icons simple key: github / gitlab / google / keycloak
 * - prefixed key: ri:github / si:github
 * - full URL image: https://example.com/logo.png
 * - emoji: 🐱
 */
export function getOAuthProviderIcon(iconName, size = 20) {
  const raw = String(iconName || '').trim();
  const iconSize = Number(size) > 0 ? Number(size) : 20;

  if (!raw) {
    return <Layers size={iconSize} color='var(--semi-color-text-2)' />;
  }

  if (isHttpUrl(raw)) {
    return (
      <img
        src={raw}
        alt='provider icon'
        width={iconSize}
        height={iconSize}
        style={{ borderRadius: 4, objectFit: 'cover' }}
      />
    );
  }

  if (isSimpleEmoji(raw)) {
    return (
      <span
        style={{
          width: iconSize,
          height: iconSize,
          lineHeight: `${iconSize}px`,
          textAlign: 'center',
          display: 'inline-block',
          fontSize: Math.max(Math.floor(iconSize * 0.8), 14),
        }}
      >
        {raw}
      </span>
    );
  }

  const key = normalizeOAuthIconKey(raw);
  const IconComp = oauthProviderIconMap[key];
  if (IconComp) {
    return <IconComp size={iconSize} />;
  }

  return <Avatar size='extra-extra-small'>{raw.charAt(0).toUpperCase()}</Avatar>;
}

// 颜色列表
const colors = [
  'amber',
  'blue',
  'cyan',
  'green',
  'grey',
  'indigo',
  'light-blue',
  'lime',
  'orange',
  'pink',
  'purple',
  'red',
  'teal',
  'violet',
  'yellow',
];

// 基础10色色板 (N ≤ 10)
const baseColors = [
  '#1664FF', // 主色
  '#1AC6FF',
  '#FF8A00',
  '#3CC780',
  '#7442D4',
  '#FFC400',
  '#304D77',
  '#B48DEB',
  '#009488',
  '#FF7DDA',
];

// 扩展20色色板 (10 < N ≤ 20)
const extendedColors = [
  '#1664FF',
  '#B2CFFF',
  '#1AC6FF',
  '#94EFFF',
  '#FF8A00',
  '#FFCE7A',
  '#3CC780',
  '#B9EDCD',
  '#7442D4',
  '#DDC5FA',
  '#FFC400',
  '#FAE878',
  '#304D77',
  '#8B959E',
  '#B48DEB',
  '#EFE3FF',
  '#009488',
  '#59BAA8',
  '#FF7DDA',
  '#FFCFEE',
];

// 模型颜色映射
export const modelColorMap = {
  'dall-e': 'rgb(147,112,219)', // 深紫色
  // 'dall-e-2': 'rgb(147,112,219)', // 介于紫色和蓝色之间的色调
  'dall-e-3': 'rgb(153,50,204)', // 介于紫罗兰和洋红之间的色调
  'gpt-3.5-turbo': 'rgb(184,227,167)', // 浅绿色
  // 'gpt-3.5-turbo-0301': 'rgb(131,220,131)', // 亮绿色
  'gpt-3.5-turbo-0613': 'rgb(60,179,113)', // 海洋绿
  'gpt-3.5-turbo-1106': 'rgb(32,178,170)', // 浅海洋绿
  'gpt-3.5-turbo-16k': 'rgb(149,252,206)', // 淡橙色
  'gpt-3.5-turbo-16k-0613': 'rgb(119,255,214)', // 淡桃
  'gpt-3.5-turbo-instruct': 'rgb(175,238,238)', // 粉蓝色
  'gpt-4': 'rgb(135,206,235)', // 天蓝色
  // 'gpt-4-0314': 'rgb(70,130,180)', // 钢蓝色
  'gpt-4-0613': 'rgb(100,149,237)', // 矢车菊蓝
  'gpt-4-1106-preview': 'rgb(30,144,255)', // 道奇蓝
  'gpt-4-0125-preview': 'rgb(2,177,236)', // 深天蓝
  'gpt-4-turbo-preview': 'rgb(2,177,255)', // 深天蓝
  'gpt-4-32k': 'rgb(104,111,238)', // 中紫色
  // 'gpt-4-32k-0314': 'rgb(90,105,205)', // 暗灰蓝色
  'gpt-4-32k-0613': 'rgb(61,71,139)', // 暗蓝灰色
  'gpt-4-all': 'rgb(65,105,225)', // 皇家蓝
  'gpt-4-gizmo-*': 'rgb(0,0,255)', // 纯蓝色
  'gpt-4-vision-preview': 'rgb(25,25,112)', // 午夜蓝
  'text-ada-001': 'rgb(255,192,203)', // 粉红色
  'text-babbage-001': 'rgb(255,160,122)', // 浅珊瑚色
  'text-curie-001': 'rgb(219,112,147)', // 苍紫罗兰色
  // 'text-davinci-002': 'rgb(199,21,133)', // 中紫罗兰红色
  'text-davinci-003': 'rgb(219,112,147)', // 苍紫罗兰色（与Curie相同，表示同一个系列）
  'text-davinci-edit-001': 'rgb(255,105,180)', // 热粉色
  'text-embedding-ada-002': 'rgb(255,182,193)', // 浅粉红
  'text-embedding-v1': 'rgb(255,174,185)', // 浅粉红色（略有区别）
  'text-moderation-latest': 'rgb(255,130,171)', // 强粉色
  'text-moderation-stable': 'rgb(255,160,122)', // 浅珊瑚色（与Babbage相同，表示同一类功能）
  'tts-1': 'rgb(255,140,0)', // 深橙色
  'tts-1-1106': 'rgb(255,165,0)', // 橙色
  'tts-1-hd': 'rgb(255,215,0)', // 金色
  'tts-1-hd-1106': 'rgb(255,223,0)', // 金黄色（略有区别）
  'whisper-1': 'rgb(245,245,220)', // 米色
  'claude-3-opus-20240229': 'rgb(255,132,31)', // 橙红色
  'claude-3-sonnet-20240229': 'rgb(253,135,93)', // 橙色
  'claude-3-haiku-20240307': 'rgb(255,175,146)', // 浅橙色
};

export function modelToColor(modelName) {
  // 1. 如果模型在预定义的 modelColorMap 中，使用预定义颜色
  if (modelColorMap[modelName]) {
    return modelColorMap[modelName];
  }

  // 2. 生成一个稳定的数字作为索引
  let hash = 0;
  for (let i = 0; i < modelName.length; i++) {
    hash = (hash << 5) - hash + modelName.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  hash = Math.abs(hash);

  // 3. 根据模型名称长度选择不同的色板
  const colorPalette = modelName.length > 10 ? extendedColors : baseColors;

  // 4. 使用hash值选择颜色
  const index = hash % colorPalette.length;
  return colorPalette[index];
}

export function stringToColor(str) {
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i);
  }
  let i = sum % colors.length;
  return colors[i];
}

// 渲染带有模型图标的标签
export function renderModelTag(modelName, options = {}) {
  const {
    color,
    size = 'default',
    shape = 'circle',
    onClick,
    suffixIcon,
  } = options;

  const categories = getModelCategories(i18next.t);
  let icon = null;

  for (const [key, category] of Object.entries(categories)) {
    if (key !== 'all' && category.filter({ model_name: modelName })) {
      icon = category.icon;
      break;
    }
  }

  return (
    <Tag
      color={color || stringToColor(modelName)}
      prefixIcon={icon}
      suffixIcon={suffixIcon}
      size={size}
      shape={shape}
      onClick={onClick}
    >
      {modelName}
    </Tag>
  );
}

export function renderText(text, limit) {
  if (text.length > limit) {
    return text.slice(0, limit - 3) + '...';
  }
  return text;
}

/**
 * Render group tags based on the input group string
 * @param {string} group - The input group string
 * @returns {JSX.Element} - The rendered group tags
 */
export function renderGroup(group) {
  if (group === '') {
    return (
      <Tag key='default' color='white' shape='circle'>
        {i18next.t('用户分组')}
      </Tag>
    );
  }

  const tagColors = {
    vip: 'yellow',
    pro: 'yellow',
    svip: 'red',
    premium: 'red',
  };

  const groups = group.split(',').sort();

  return (
    <span key={group}>
      {groups.map((group) => (
        <Tag
          color={tagColors[group] || stringToColor(group)}
          key={group}
          shape='circle'
          onClick={async (event) => {
            event.stopPropagation();
            if (await copy(group)) {
              showSuccess(i18next.t('已复制：') + group);
            } else {
              Modal.error({
                title: i18next.t('无法复制到剪贴板，请手动复制'),
                content: group,
              });
            }
          }}
        >
          {group}
        </Tag>
      ))}
    </span>
  );
}

export function renderRatio(ratio) {
  let color = 'green';
  if (ratio > 5) {
    color = 'red';
  } else if (ratio > 3) {
    color = 'orange';
  } else if (ratio > 1) {
    color = 'blue';
  }
  return (
    <Tag color={color}>
      {ratio}x {i18next.t('倍率')}
    </Tag>
  );
}

const measureTextWidth = (
  text,
  style = {
    fontSize: '14px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  containerWidth,
) => {
  const span = document.createElement('span');

  span.style.visibility = 'hidden';
  span.style.position = 'absolute';
  span.style.whiteSpace = 'nowrap';
  span.style.fontSize = style.fontSize;
  span.style.fontFamily = style.fontFamily;

  span.textContent = text;

  document.body.appendChild(span);
  const width = span.offsetWidth;

  document.body.removeChild(span);

  return width;
};

export function truncateText(text, maxWidth = 200) {
  const isMobileScreen = window.matchMedia(
    `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
  ).matches;
  if (!isMobileScreen) {
    return text;
  }
  if (!text) return text;

  try {
    // Handle percentage-based maxWidth
    let actualMaxWidth = maxWidth;
    if (typeof maxWidth === 'string' && maxWidth.endsWith('%')) {
      const percentage = parseFloat(maxWidth) / 100;
      // Use window width as fallback container width
      actualMaxWidth = window.innerWidth * percentage;
    }

    const width = measureTextWidth(text);
    if (width <= actualMaxWidth) return text;

    let left = 0;
    let right = text.length;
    let result = text;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const truncated = text.slice(0, mid) + '...';
      const currentWidth = measureTextWidth(truncated);

      if (currentWidth <= actualMaxWidth) {
        result = truncated;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return result;
  } catch (error) {
    console.warn(
      'Text measurement failed, falling back to character count',
      error,
    );
    if (text.length > 20) {
      return text.slice(0, 17) + '...';
    }
    return text;
  }
}

export const renderGroupOption = (item) => {
  const {
    disabled,
    selected,
    label,
    value,
    focused,
    className,
    style,
    onMouseEnter,
    onClick,
    empty,
    emptyContent,
    ...rest
  } = item;

  const baseStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    backgroundColor: focused ? 'var(--semi-color-fill-0)' : 'transparent',
    opacity: disabled ? 0.5 : 1,
    ...(selected && {
      backgroundColor: 'var(--semi-color-primary-light-default)',
    }),
    '&:hover': {
      backgroundColor: !disabled && 'var(--semi-color-fill-1)',
    },
  };

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  const handleMouseEnter = (e) => {
    if (!disabled && onMouseEnter) {
      onMouseEnter(e);
    }
  };

  return (
    <div
      style={baseStyle}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Typography.Text strong type={disabled ? 'tertiary' : undefined}>
          {value}
        </Typography.Text>
        <Typography.Text type='secondary' size='small'>
          {label}
        </Typography.Text>
      </div>
      {item.ratio && renderRatio(item.ratio)}
    </div>
  );
};

export function renderNumber(num) {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 10000) {
    return (num / 1000).toFixed(1) + 'k';
  } else {
    return num;
  }
}

export function renderQuotaNumberWithDigit(num, digits = 2) {
  if (typeof num !== 'number' || isNaN(num)) {
    return 0;
  }
  const quotaDisplayType = localStorage.getItem('quota_display_type') || 'USD';
  num = num.toFixed(digits);
  if (quotaDisplayType === 'CNY') {
    return '¥' + num;
  } else if (quotaDisplayType === 'USD') {
    return '$' + num;
  } else if (quotaDisplayType === 'CUSTOM') {
    const statusStr = localStorage.getItem('status');
    let symbol = '¤';
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        symbol = s?.custom_currency_symbol || symbol;
      }
    } catch (e) {}
    return symbol + num;
  } else {
    return num;
  }
}

export function renderNumberWithPoint(num) {
  if (num === undefined) return '';
  num = num.toFixed(2);
  if (num >= 100000) {
    // Convert number to string to manipulate it
    let numStr = num.toString();
    // Find the position of the decimal point
    let decimalPointIndex = numStr.indexOf('.');

    let wholePart = numStr;
    let decimalPart = '';

    // If there is a decimal point, split the number into whole and decimal parts
    if (decimalPointIndex !== -1) {
      wholePart = numStr.slice(0, decimalPointIndex);
      decimalPart = numStr.slice(decimalPointIndex);
    }

    // Take the first two and last two digits of the whole number part
    let shortenedWholePart = wholePart.slice(0, 2) + '..' + wholePart.slice(-2);

    // Return the formatted number
    return shortenedWholePart + decimalPart;
  }

  // If the number is less than 100,000, return it unmodified
  return num;
}

export function getQuotaPerUnit() {
  let quotaPerUnit = localStorage.getItem('quota_per_unit');
  quotaPerUnit = parseFloat(quotaPerUnit);
  return quotaPerUnit;
}

export function renderUnitWithQuota(quota) {
  let quotaPerUnit = localStorage.getItem('quota_per_unit');
  quotaPerUnit = parseFloat(quotaPerUnit);
  quota = parseFloat(quota);
  return quotaPerUnit * quota;
}

export function getQuotaWithUnit(quota, digits = 6) {
  let quotaPerUnit = localStorage.getItem('quota_per_unit');
  quotaPerUnit = parseFloat(quotaPerUnit);
  return (quota / quotaPerUnit).toFixed(digits);
}

export function renderQuotaWithAmount(amount) {
  const quotaDisplayType = localStorage.getItem('quota_display_type') || 'USD';
  if (quotaDisplayType === 'TOKENS') {
    return renderNumber(renderUnitWithQuota(amount));
  }
  if (quotaDisplayType === 'CNY') {
    return '¥' + amount;
  } else if (quotaDisplayType === 'CUSTOM') {
    const statusStr = localStorage.getItem('status');
    let symbol = '¤';
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        symbol = s?.custom_currency_symbol || symbol;
      }
    } catch (e) {}
    return symbol + amount;
  }
  return '$' + amount;
}

/**
 * 获取当前货币配置信息
 * @returns {Object} - { symbol, rate, type }
 */
export function getCurrencyConfig() {
  const quotaDisplayType = localStorage.getItem('quota_display_type') || 'USD';
  const statusStr = localStorage.getItem('status');

  let symbol = '$';
  let rate = 1;

  if (quotaDisplayType === 'CNY') {
    symbol = '¥';
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        rate = s?.usd_exchange_rate || 7;
      }
    } catch (e) {}
  } else if (quotaDisplayType === 'CUSTOM') {
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        symbol = s?.custom_currency_symbol || '¤';
        rate = s?.custom_currency_exchange_rate || 1;
      }
    } catch (e) {}
  }

  return { symbol, rate, type: quotaDisplayType };
}

/**
 * 将美元金额转换为当前选择的货币
 * @param {number} usdAmount - 美元金额
 * @param {number} digits - 小数位数
 * @returns {string} - 格式化后的货币字符串
 */
export function convertUSDToCurrency(usdAmount, digits = 2) {
  const { symbol, rate } = getCurrencyConfig();
  const convertedAmount = usdAmount * rate;
  return symbol + convertedAmount.toFixed(digits);
}

export function renderQuota(quota, digits = 2) {
  let quotaPerUnit = localStorage.getItem('quota_per_unit');
  const quotaDisplayType = localStorage.getItem('quota_display_type') || 'USD';
  quotaPerUnit = parseFloat(quotaPerUnit);
  if (quotaDisplayType === 'TOKENS') {
    return renderNumber(quota);
  }
  const resultUSD = quota / quotaPerUnit;
  let symbol = '$';
  let value = resultUSD;
  if (quotaDisplayType === 'CNY') {
    const statusStr = localStorage.getItem('status');
    let usdRate = 1;
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        usdRate = s?.usd_exchange_rate || 1;
      }
    } catch (e) {}
    value = resultUSD * usdRate;
    symbol = '¥';
  } else if (quotaDisplayType === 'CUSTOM') {
    const statusStr = localStorage.getItem('status');
    let symbolCustom = '¤';
    let rate = 1;
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        symbolCustom = s?.custom_currency_symbol || symbolCustom;
        rate = s?.custom_currency_exchange_rate || rate;
      }
    } catch (e) {}
    value = resultUSD * rate;
    symbol = symbolCustom;
  }
  const fixedResult = value.toFixed(digits);
  if (parseFloat(fixedResult) === 0 && quota > 0 && value > 0) {
    const minValue = Math.pow(10, -digits);
    return symbol + minValue.toFixed(digits);
  }
  return symbol + fixedResult;
}

function isValidGroupRatio(ratio) {
  return Number.isFinite(ratio) && ratio !== -1;
}

/**
 * Helper function to get effective ratio and label
 * @param {number} groupRatio - The default group ratio
 * @param {number} user_group_ratio - The user-specific group ratio
 * @returns {Object} - Object containing { ratio, label, useUserGroupRatio }
 */
function getEffectiveRatio(groupRatio, user_group_ratio) {
  const useUserGroupRatio = isValidGroupRatio(user_group_ratio);
  const ratioLabel = useUserGroupRatio
    ? i18next.t('专属倍率')
    : i18next.t('分组倍率');
  const effectiveRatio = useUserGroupRatio ? user_group_ratio : groupRatio;

  return {
    ratio: effectiveRatio,
    label: ratioLabel,
    useUserGroupRatio: useUserGroupRatio,
  };
}

// Shared core for simple price rendering (used by OpenAI-like and Claude-like variants)
function renderPriceSimpleCore({
  modelRatio,
  modelPrice = -1,
  groupRatio,
  user_group_ratio,
  cacheTokens = 0,
  cacheRatio = 1.0,
  cacheCreationTokens = 0,
  cacheCreationRatio = 1.0,
  cacheCreationTokens5m = 0,
  cacheCreationRatio5m = 1.0,
  cacheCreationTokens1h = 0,
  cacheCreationRatio1h = 1.0,
  image = false,
  imageRatio = 1.0,
  isSystemPromptOverride = false,
}) {
  const { ratio: effectiveGroupRatio, label: ratioLabel } = getEffectiveRatio(
    groupRatio,
    user_group_ratio,
  );
  const finalGroupRatio = effectiveGroupRatio;

  const { symbol, rate } = getCurrencyConfig();
  if (modelPrice !== -1) {
    const displayPrice = (modelPrice * rate).toFixed(6);
    return i18next.t('价格：{{symbol}}{{price}} * {{ratioType}}：{{ratio}}', {
      symbol: symbol,
      price: displayPrice,
      ratioType: ratioLabel,
      ratio: finalGroupRatio,
    });
  }

  const hasSplitCacheCreation =
    cacheCreationTokens5m > 0 || cacheCreationTokens1h > 0;

  const shouldShowLegacyCacheCreation =
    !hasSplitCacheCreation && cacheCreationTokens !== 0;

  const shouldShowCache = cacheTokens !== 0;
  const shouldShowCacheCreation5m =
    hasSplitCacheCreation && cacheCreationTokens5m > 0;
  const shouldShowCacheCreation1h =
    hasSplitCacheCreation && cacheCreationTokens1h > 0;

  const parts = [];
  // base: model ratio
  parts.push(i18next.t('模型: {{ratio}}'));

  // cache part (label differs when with image)
  if (shouldShowCache) {
    parts.push(i18next.t('缓存: {{cacheRatio}}'));
  }

  if (hasSplitCacheCreation) {
    if (shouldShowCacheCreation5m && shouldShowCacheCreation1h) {
      parts.push(
        i18next.t(
          '缓存创建: 5m {{cacheCreationRatio5m}} / 1h {{cacheCreationRatio1h}}',
        ),
      );
    } else if (shouldShowCacheCreation5m) {
      parts.push(i18next.t('缓存创建: 5m {{cacheCreationRatio5m}}'));
    } else if (shouldShowCacheCreation1h) {
      parts.push(i18next.t('缓存创建: 1h {{cacheCreationRatio1h}}'));
    }
  } else if (shouldShowLegacyCacheCreation) {
    parts.push(i18next.t('缓存创建: {{cacheCreationRatio}}'));
  }

  // image part
  if (image) {
    parts.push(i18next.t('图片输入: {{imageRatio}}'));
  }

  parts.push(`{{ratioType}}: {{groupRatio}}`);

  let result = i18next.t(parts.join(' * '), {
    ratio: modelRatio,
    ratioType: ratioLabel,
    groupRatio: finalGroupRatio,
    cacheRatio: cacheRatio,
    cacheCreationRatio: cacheCreationRatio,
    cacheCreationRatio5m: cacheCreationRatio5m,
    cacheCreationRatio1h: cacheCreationRatio1h,
    imageRatio: imageRatio,
  });

  if (isSystemPromptOverride) {
    result += '\n\r' + i18next.t('系统提示覆盖');
  }

  return result;
}

export function renderModelPrice(
  inputTokens,
  completionTokens,
  modelRatio,
  modelPrice = -1,
  completionRatio,
  groupRatio,
  user_group_ratio,
  cacheTokens = 0,
  cacheRatio = 1.0,
  image = false,
  imageRatio = 1.0,
  imageOutputTokens = 0,
  webSearch = false,
  webSearchCallCount = 0,
  webSearchPrice = 0,
  fileSearch = false,
  fileSearchCallCount = 0,
  fileSearchPrice = 0,
  audioInputSeperatePrice = false,
  audioInputTokens = 0,
  audioInputPrice = 0,
  imageGenerationCall = false,
  imageGenerationCallPrice = 0,
) {
  const { ratio: effectiveGroupRatio, label: ratioLabel } = getEffectiveRatio(
    groupRatio,
    user_group_ratio,
  );
  groupRatio = effectiveGroupRatio;

  // 获取货币配置
  const { symbol, rate } = getCurrencyConfig();

  if (modelPrice !== -1) {
    const displayPrice = (modelPrice * rate).toFixed(6);
    const displayTotal = (modelPrice * groupRatio * rate).toFixed(6);
    return i18next.t(
      '模型价格：{{symbol}}{{price}} * {{ratioType}}：{{ratio}} = {{symbol}}{{total}}',
      {
        symbol: symbol,
        price: displayPrice,
        ratio: groupRatio,
        total: displayTotal,
        ratioType: ratioLabel,
      },
    );
  } else {
    if (completionRatio === undefined) {
      completionRatio = 0;
    }
    let inputRatioPrice = modelRatio * 2.0;
    let completionRatioPrice = modelRatio * 2.0 * completionRatio;
    let cacheRatioPrice = modelRatio * 2.0 * cacheRatio;
    let imageRatioPrice = modelRatio * 2.0 * imageRatio;

    // Calculate effective input tokens (non-cached + cached with ratio applied)
    let effectiveInputTokens =
      inputTokens - cacheTokens + cacheTokens * cacheRatio;
    // Handle image tokens if present
    if (image && imageOutputTokens > 0) {
      effectiveInputTokens =
        inputTokens - imageOutputTokens + imageOutputTokens * imageRatio;
    }
    if (audioInputTokens > 0) {
      effectiveInputTokens -= audioInputTokens;
    }
    let price =
      (effectiveInputTokens / 1000000) * inputRatioPrice * groupRatio +
      (audioInputTokens / 1000000) * audioInputPrice * groupRatio +
      (completionTokens / 1000000) * completionRatioPrice * groupRatio +
      (webSearchCallCount / 1000) * webSearchPrice * groupRatio +
      (fileSearchCallCount / 1000) * fileSearchPrice * groupRatio +
      imageGenerationCallPrice * groupRatio;

    return (
      <>
        <article>
          <p>
            {i18next.t(
              '输入价格：{{symbol}}{{price}} / 1M tokens{{audioPrice}}',
              {
                symbol: symbol,
                price: (inputRatioPrice * rate).toFixed(6),
                audioPrice: audioInputSeperatePrice
                  ? `，音频 ${symbol}${(audioInputPrice * rate).toFixed(6)} / 1M tokens`
                  : '',
              },
            )}
          </p>
          <p>
            {i18next.t(
              '输出价格：{{symbol}}{{price}} * {{completionRatio}} = {{symbol}}{{total}} / 1M tokens (补全倍率: {{completionRatio}})',
              {
                symbol: symbol,
                price: (inputRatioPrice * rate).toFixed(6),
                total: (completionRatioPrice * rate).toFixed(6),
                completionRatio: completionRatio,
              },
            )}
          </p>
          {cacheTokens > 0 && (
            <p>
              {i18next.t(
                '缓存价格：{{symbol}}{{price}} * {{cacheRatio}} = {{symbol}}{{total}} / 1M tokens (缓存倍率: {{cacheRatio}})',
                {
                  symbol: symbol,
                  price: (inputRatioPrice * rate).toFixed(6),
                  total: (inputRatioPrice * cacheRatio * rate).toFixed(6),
                  cacheRatio: cacheRatio,
                },
              )}
            </p>
          )}
          {image && imageOutputTokens > 0 && (
            <p>
              {i18next.t(
                '图片输入价格：{{symbol}}{{price}} * {{ratio}} = {{symbol}}{{total}} / 1M tokens (图片倍率: {{imageRatio}})',
                {
                  symbol: symbol,
                  price: (imageRatioPrice * rate).toFixed(6),
                  ratio: groupRatio,
                  total: (imageRatioPrice * groupRatio * rate).toFixed(6),
                  imageRatio: imageRatio,
                },
              )}
            </p>
          )}
          {webSearch && webSearchCallCount > 0 && (
            <p>
              {i18next.t('Web搜索价格：{{symbol}}{{price}} / 1K 次', {
                symbol: symbol,
                price: (webSearchPrice * rate).toFixed(6),
              })}
            </p>
          )}
          {fileSearch && fileSearchCallCount > 0 && (
            <p>
              {i18next.t('文件搜索价格：{{symbol}}{{price}} / 1K 次', {
                symbol: symbol,
                price: (fileSearchPrice * rate).toFixed(6),
              })}
            </p>
          )}
          {imageGenerationCall && imageGenerationCallPrice > 0 && (
            <p>
              {i18next.t('图片生成调用：{{symbol}}{{price}} / 1次', {
                symbol: symbol,
                price: (imageGenerationCallPrice * rate).toFixed(6),
              })}
            </p>
          )}
          <p>
            {(() => {
              // 构建输入部分描述
              let inputDesc = '';
              if (image && imageOutputTokens > 0) {
                inputDesc = i18next.t(
                  '(输入 {{nonImageInput}} tokens + 图片输入 {{imageInput}} tokens * {{imageRatio}} / 1M tokens * {{symbol}}{{price}}',
                  {
                    nonImageInput: inputTokens - imageOutputTokens,
                    imageInput: imageOutputTokens,
                    imageRatio: imageRatio,
                    symbol: symbol,
                    price: (inputRatioPrice * rate).toFixed(6),
                  },
                );
              } else if (cacheTokens > 0) {
                inputDesc = i18next.t(
                  '(输入 {{nonCacheInput}} tokens / 1M tokens * {{symbol}}{{price}} + 缓存 {{cacheInput}} tokens / 1M tokens * {{symbol}}{{cachePrice}}',
                  {
                    nonCacheInput: inputTokens - cacheTokens,
                    cacheInput: cacheTokens,
                    symbol: symbol,
                    price: (inputRatioPrice * rate).toFixed(6),
                    cachePrice: (cacheRatioPrice * rate).toFixed(6),
                  },
                );
              } else if (audioInputSeperatePrice && audioInputTokens > 0) {
                inputDesc = i18next.t(
                  '(输入 {{nonAudioInput}} tokens / 1M tokens * {{symbol}}{{price}} + 音频输入 {{audioInput}} tokens / 1M tokens * {{symbol}}{{audioPrice}}',
                  {
                    nonAudioInput: inputTokens - audioInputTokens,
                    audioInput: audioInputTokens,
                    symbol: symbol,
                    price: (inputRatioPrice * rate).toFixed(6),
                    audioPrice: (audioInputPrice * rate).toFixed(6),
                  },
                );
              } else {
                inputDesc = i18next.t(
                  '(输入 {{input}} tokens / 1M tokens * {{symbol}}{{price}}',
                  {
                    input: inputTokens,
                    symbol: symbol,
                    price: (inputRatioPrice * rate).toFixed(6),
                  },
                );
              }

              // 构建输出部分描述
              const outputDesc = i18next.t(
                '输出 {{completion}} tokens / 1M tokens * {{symbol}}{{compPrice}}) * {{ratioType}} {{ratio}}',
                {
                  completion: completionTokens,
                  symbol: symbol,
                  compPrice: (completionRatioPrice * rate).toFixed(6),
                  ratio: groupRatio,
                  ratioType: ratioLabel,
                },
              );

              // 构建额外服务描述
              const extraServices = [
                webSearch && webSearchCallCount > 0
                  ? i18next.t(
                      ' + Web搜索 {{count}}次 / 1K 次 * {{symbol}}{{price}} * {{ratioType}} {{ratio}}',
                      {
                        count: webSearchCallCount,
                        symbol: symbol,
                        price: (webSearchPrice * rate).toFixed(6),
                        ratio: groupRatio,
                        ratioType: ratioLabel,
                      },
                    )
                  : '',
                fileSearch && fileSearchCallCount > 0
                  ? i18next.t(
                      ' + 文件搜索 {{count}}次 / 1K 次 * {{symbol}}{{price}} * {{ratioType}} {{ratio}}',
                      {
                        count: fileSearchCallCount,
                        symbol: symbol,
                        price: (fileSearchPrice * rate).toFixed(6),
                        ratio: groupRatio,
                        ratioType: ratioLabel,
                      },
                    )
                  : '',
                imageGenerationCall && imageGenerationCallPrice > 0
                  ? i18next.t(
                      ' + 图片生成调用 {{symbol}}{{price}} / 1次 * {{ratioType}} {{ratio}}',
                      {
                        symbol: symbol,
                        price: (imageGenerationCallPrice * rate).toFixed(6),
                        ratio: groupRatio,
                        ratioType: ratioLabel,
                      },
                    )
                  : '',
              ].join('');

              return i18next.t(
                '{{inputDesc}} + {{outputDesc}}{{extraServices}} = {{symbol}}{{total}}',
                {
                  inputDesc,
                  outputDesc,
                  extraServices,
                  symbol: symbol,
                  total: (price * rate).toFixed(6),
                },
              );
            })()}
          </p>
          <p>{i18next.t('仅供参考，以实际扣费为准')}</p>
        </article>
      </>
    );
  }
}

export function renderLogContent(
  modelRatio,
  completionRatio,
  modelPrice = -1,
  groupRatio,
  user_group_ratio,
  cacheRatio = 1.0,
  image = false,
  imageRatio = 1.0,
  webSearch = false,
  webSearchCallCount = 0,
  fileSearch = false,
  fileSearchCallCount = 0,
) {
  const {
    ratio,
    label: ratioLabel,
    useUserGroupRatio: useUserGroupRatio,
  } = getEffectiveRatio(groupRatio, user_group_ratio);

  // 获取货币配置
  const { symbol, rate } = getCurrencyConfig();

  if (modelPrice !== -1) {
    return i18next.t('模型价格 {{symbol}}{{price}}，{{ratioType}} {{ratio}}', {
      symbol: symbol,
      price: (modelPrice * rate).toFixed(6),
      ratioType: ratioLabel,
      ratio,
    });
  } else {
    if (image) {
      return i18next.t(
        '模型倍率 {{modelRatio}}，缓存倍率 {{cacheRatio}}，输出倍率 {{completionRatio}}，图片输入倍率 {{imageRatio}}，{{ratioType}} {{ratio}}',
        {
          modelRatio: modelRatio,
          cacheRatio: cacheRatio,
          completionRatio: completionRatio,
          imageRatio: imageRatio,
          ratioType: ratioLabel,
          ratio,
        },
      );
    } else if (webSearch) {
      return i18next.t(
        '模型倍率 {{modelRatio}}，缓存倍率 {{cacheRatio}}，输出倍率 {{completionRatio}}，{{ratioType}} {{ratio}}，Web 搜索调用 {{webSearchCallCount}} 次',
        {
          modelRatio: modelRatio,
          cacheRatio: cacheRatio,
          completionRatio: completionRatio,
          ratioType: ratioLabel,
          ratio,
          webSearchCallCount,
        },
      );
    } else {
      return i18next.t(
        '模型倍率 {{modelRatio}}，缓存倍率 {{cacheRatio}}，输出倍率 {{completionRatio}}，{{ratioType}} {{ratio}}',
        {
          modelRatio: modelRatio,
          cacheRatio: cacheRatio,
          completionRatio: completionRatio,
          ratioType: ratioLabel,
          ratio,
        },
      );
    }
  }
}

export function renderModelPriceSimple(
  modelRatio,
  modelPrice = -1,
  groupRatio,
  user_group_ratio,
  cacheTokens = 0,
  cacheRatio = 1.0,
  cacheCreationTokens = 0,
  cacheCreationRatio = 1.0,
  cacheCreationTokens5m = 0,
  cacheCreationRatio5m = 1.0,
  cacheCreationTokens1h = 0,
  cacheCreationRatio1h = 1.0,
  image = false,
  imageRatio = 1.0,
  isSystemPromptOverride = false,
  provider = 'openai',
) {
  return renderPriceSimpleCore({
    modelRatio,
    modelPrice,
    groupRatio,
    user_group_ratio,
    cacheTokens,
    cacheRatio,
    cacheCreationTokens,
    cacheCreationRatio,
    cacheCreationTokens5m,
    cacheCreationRatio5m,
    cacheCreationTokens1h,
    cacheCreationRatio1h,
    image,
    imageRatio,
    isSystemPromptOverride,
  });
}

export function renderAudioModelPrice(
  inputTokens,
  completionTokens,
  modelRatio,
  modelPrice = -1,
  completionRatio,
  audioInputTokens,
  audioCompletionTokens,
  audioRatio,
  audioCompletionRatio,
  groupRatio,
  user_group_ratio,
  cacheTokens = 0,
  cacheRatio = 1.0,
) {
  const { ratio: effectiveGroupRatio, label: ratioLabel } = getEffectiveRatio(
    groupRatio,
    user_group_ratio,
  );
  groupRatio = effectiveGroupRatio;

  // 获取货币配置
  const { symbol, rate } = getCurrencyConfig();

  // 1 ratio = $0.002 / 1K tokens
  if (modelPrice !== -1) {
    return i18next.t(
      '模型价格：{{symbol}}{{price}} * {{ratioType}}：{{ratio}} = {{symbol}}{{total}}',
      {
        symbol: symbol,
        price: (modelPrice * rate).toFixed(6),
        ratio: groupRatio,
        total: (modelPrice * groupRatio * rate).toFixed(6),
        ratioType: ratioLabel,
      },
    );
  } else {
    if (completionRatio === undefined) {
      completionRatio = 0;
    }

    // try toFixed audioRatio
    audioRatio = parseFloat(audioRatio).toFixed(6);
    // 这里的 *2 是因为 1倍率=0.002刀，请勿删除
    let inputRatioPrice = modelRatio * 2.0;
    let completionRatioPrice = modelRatio * 2.0 * completionRatio;
    let cacheRatioPrice = modelRatio * 2.0 * cacheRatio;

    // Calculate effective input tokens (non-cached + cached with ratio applied)
    const effectiveInputTokens =
      inputTokens - cacheTokens + cacheTokens * cacheRatio;

    let textPrice =
      (effectiveInputTokens / 1000000) * inputRatioPrice * groupRatio +
      (completionTokens / 1000000) * completionRatioPrice * groupRatio;
    let audioPrice =
      (audioInputTokens / 1000000) * inputRatioPrice * audioRatio * groupRatio +
      (audioCompletionTokens / 1000000) *
        inputRatioPrice *
        audioRatio *
        audioCompletionRatio *
        groupRatio;
    let price = textPrice + audioPrice;
    return (
      <>
        <article>
          <p>
            {i18next.t('提示价格：{{symbol}}{{price}} / 1M tokens', {
              symbol: symbol,
              price: (inputRatioPrice * rate).toFixed(6),
            })}
          </p>
          <p>
            {i18next.t(
              '补全价格：{{symbol}}{{price}} * {{completionRatio}} = {{symbol}}{{total}} / 1M tokens (补全倍率: {{completionRatio}})',
              {
                symbol: symbol,
                price: (inputRatioPrice * rate).toFixed(6),
                total: (completionRatioPrice * rate).toFixed(6),
                completionRatio: completionRatio,
              },
            )}
          </p>
          {cacheTokens > 0 && (
            <p>
              {i18next.t(
                '缓存价格：{{symbol}}{{price}} * {{cacheRatio}} = {{symbol}}{{total}} / 1M tokens (缓存倍率: {{cacheRatio}})',
                {
                  symbol: symbol,
                  price: (inputRatioPrice * rate).toFixed(6),
                  total: (inputRatioPrice * cacheRatio * rate).toFixed(6),
                  cacheRatio: cacheRatio,
                },
              )}
            </p>
          )}
          <p>
            {i18next.t(
              '音频提示价格：{{symbol}}{{price}} * {{audioRatio}} = {{symbol}}{{total}} / 1M tokens (音频倍率: {{audioRatio}})',
              {
                symbol: symbol,
                price: (inputRatioPrice * rate).toFixed(6),
                total: (inputRatioPrice * audioRatio * rate).toFixed(6),
                audioRatio: audioRatio,
              },
            )}
          </p>
          <p>
            {i18next.t(
              '音频补全价格：{{symbol}}{{price}} * {{audioRatio}} * {{audioCompRatio}} = {{symbol}}{{total}} / 1M tokens (音频补全倍率: {{audioCompRatio}})',
              {
                symbol: symbol,
                price: (inputRatioPrice * rate).toFixed(6),
                total: (
                  inputRatioPrice *
                  audioRatio *
                  audioCompletionRatio *
                  rate
                ).toFixed(6),
                audioRatio: audioRatio,
                audioCompRatio: audioCompletionRatio,
              },
            )}
          </p>
          <p>
            {cacheTokens > 0
              ? i18next.t(
                  '文字提示 {{nonCacheInput}} tokens / 1M tokens * {{symbol}}{{price}} + 缓存 {{cacheInput}} tokens / 1M tokens * {{symbol}}{{cachePrice}} + 文字补全 {{completion}} tokens / 1M tokens * {{symbol}}{{compPrice}} = {{symbol}}{{total}}',
                  {
                    nonCacheInput: inputTokens - cacheTokens,
                    cacheInput: cacheTokens,
                    symbol: symbol,
                    cachePrice: (inputRatioPrice * cacheRatio * rate).toFixed(
                      6,
                    ),
                    price: (inputRatioPrice * rate).toFixed(6),
                    completion: completionTokens,
                    compPrice: (completionRatioPrice * rate).toFixed(6),
                    total: (textPrice * rate).toFixed(6),
                  },
                )
              : i18next.t(
                  '文字提示 {{input}} tokens / 1M tokens * {{symbol}}{{price}} + 文字补全 {{completion}} tokens / 1M tokens * {{symbol}}{{compPrice}} = {{symbol}}{{total}}',
                  {
                    input: inputTokens,
                    symbol: symbol,
                    price: (inputRatioPrice * rate).toFixed(6),
                    completion: completionTokens,
                    compPrice: (completionRatioPrice * rate).toFixed(6),
                    total: (textPrice * rate).toFixed(6),
                  },
                )}
          </p>
          <p>
            {i18next.t(
              '音频提示 {{input}} tokens / 1M tokens * {{symbol}}{{audioInputPrice}} + 音频补全 {{completion}} tokens / 1M tokens * {{symbol}}{{audioCompPrice}} = {{symbol}}{{total}}',
              {
                input: audioInputTokens,
                completion: audioCompletionTokens,
                symbol: symbol,
                audioInputPrice: (audioRatio * inputRatioPrice * rate).toFixed(
                  6,
                ),
                audioCompPrice: (
                  audioRatio *
                  audioCompletionRatio *
                  inputRatioPrice *
                  rate
                ).toFixed(6),
                total: (audioPrice * rate).toFixed(6),
              },
            )}
          </p>
          <p>
            {i18next.t(
              '总价：文字价格 {{textPrice}} + 音频价格 {{audioPrice}} = {{symbol}}{{total}}',
              {
                symbol: symbol,
                total: (price * rate).toFixed(6),
                textPrice: (textPrice * rate).toFixed(6),
                audioPrice: (audioPrice * rate).toFixed(6),
              },
            )}
          </p>
          <p>{i18next.t('仅供参考，以实际扣费为准')}</p>
        </article>
      </>
    );
  }
}

export function renderQuotaWithPrompt(quota, digits) {
  const quotaDisplayType = localStorage.getItem('quota_display_type') || 'USD';
  if (quotaDisplayType !== 'TOKENS') {
    return i18next.t('等价金额：') + renderQuota(quota, digits);
  }
  return '';
}

export function renderClaudeModelPrice(
  inputTokens,
  completionTokens,
  modelRatio,
  modelPrice = -1,
  completionRatio,
  groupRatio,
  user_group_ratio,
  cacheTokens = 0,
  cacheRatio = 1.0,
  cacheCreationTokens = 0,
  cacheCreationRatio = 1.0,
  cacheCreationTokens5m = 0,
  cacheCreationRatio5m = 1.0,
  cacheCreationTokens1h = 0,
  cacheCreationRatio1h = 1.0,
) {
  const { ratio: effectiveGroupRatio, label: ratioLabel } = getEffectiveRatio(
    groupRatio,
    user_group_ratio,
  );
  groupRatio = effectiveGroupRatio;

  // 获取货币配置
  const { symbol, rate } = getCurrencyConfig();

  if (modelPrice !== -1) {
    return i18next.t(
      '模型价格：{{symbol}}{{price}} * {{ratioType}}：{{ratio}} = {{symbol}}{{total}}',
      {
        symbol: symbol,
        price: (modelPrice * rate).toFixed(6),
        ratioType: ratioLabel,
        ratio: groupRatio,
        total: (modelPrice * groupRatio * rate).toFixed(6),
      },
    );
  } else {
    if (completionRatio === undefined) {
      completionRatio = 0;
    }

    const completionRatioValue = completionRatio || 0;
    const inputRatioPrice = modelRatio * 2.0;
    const completionRatioPrice = modelRatio * 2.0 * completionRatioValue;
    const cacheRatioPrice = modelRatio * 2.0 * cacheRatio;
    const cacheCreationRatioPrice = modelRatio * 2.0 * cacheCreationRatio;
    const cacheCreationRatioPrice5m = modelRatio * 2.0 * cacheCreationRatio5m;
    const cacheCreationRatioPrice1h = modelRatio * 2.0 * cacheCreationRatio1h;

    const hasSplitCacheCreation =
      cacheCreationTokens5m > 0 || cacheCreationTokens1h > 0;

    const shouldShowCache = cacheTokens > 0;
    const shouldShowLegacyCacheCreation =
      !hasSplitCacheCreation && cacheCreationTokens > 0;
    const shouldShowCacheCreation5m =
      hasSplitCacheCreation && cacheCreationTokens5m > 0;
    const shouldShowCacheCreation1h =
      hasSplitCacheCreation && cacheCreationTokens1h > 0;

    // Calculate effective input tokens (non-cached + cached with ratio applied + cache creation with ratio applied)
    const nonCachedTokens = inputTokens;
    const legacyCacheCreationTokens = hasSplitCacheCreation
      ? 0
      : cacheCreationTokens;
    const effectiveInputTokens =
      nonCachedTokens +
      cacheTokens * cacheRatio +
      legacyCacheCreationTokens * cacheCreationRatio +
      cacheCreationTokens5m * cacheCreationRatio5m +
      cacheCreationTokens1h * cacheCreationRatio1h;

    let price =
      (effectiveInputTokens / 1000000) * inputRatioPrice * groupRatio +
      (completionTokens / 1000000) * completionRatioPrice * groupRatio;

    const inputUnitPrice = inputRatioPrice * rate;
    const completionUnitPrice = completionRatioPrice * rate;
    const cacheUnitPrice = cacheRatioPrice * rate;
    const cacheCreationUnitPrice = cacheCreationRatioPrice * rate;
    const cacheCreationUnitPrice5m = cacheCreationRatioPrice5m * rate;
    const cacheCreationUnitPrice1h = cacheCreationRatioPrice1h * rate;
    const cacheCreationUnitPriceTotal =
      cacheCreationUnitPrice5m + cacheCreationUnitPrice1h;

    const breakdownSegments = [
      i18next.t('提示 {{input}} tokens / 1M tokens * {{symbol}}{{price}}', {
        input: inputTokens,
        symbol,
        price: inputUnitPrice.toFixed(6),
      }),
    ];

    if (shouldShowCache) {
      breakdownSegments.push(
        i18next.t(
          '缓存 {{tokens}} tokens / 1M tokens * {{symbol}}{{price}} (倍率: {{ratio}})',
          {
            tokens: cacheTokens,
            symbol,
            price: cacheUnitPrice.toFixed(6),
            ratio: cacheRatio,
          },
        ),
      );
    }

    if (shouldShowLegacyCacheCreation) {
      breakdownSegments.push(
        i18next.t(
          '缓存创建 {{tokens}} tokens / 1M tokens * {{symbol}}{{price}} (倍率: {{ratio}})',
          {
            tokens: cacheCreationTokens,
            symbol,
            price: cacheCreationUnitPrice.toFixed(6),
            ratio: cacheCreationRatio,
          },
        ),
      );
    }

    if (shouldShowCacheCreation5m) {
      breakdownSegments.push(
        i18next.t(
          '5m缓存创建 {{tokens}} tokens / 1M tokens * {{symbol}}{{price}} (倍率: {{ratio}})',
          {
            tokens: cacheCreationTokens5m,
            symbol,
            price: cacheCreationUnitPrice5m.toFixed(6),
            ratio: cacheCreationRatio5m,
          },
        ),
      );
    }

    if (shouldShowCacheCreation1h) {
      breakdownSegments.push(
        i18next.t(
          '1h缓存创建 {{tokens}} tokens / 1M tokens * {{symbol}}{{price}} (倍率: {{ratio}})',
          {
            tokens: cacheCreationTokens1h,
            symbol,
            price: cacheCreationUnitPrice1h.toFixed(6),
            ratio: cacheCreationRatio1h,
          },
        ),
      );
    }

    breakdownSegments.push(
      i18next.t(
        '补全 {{completion}} tokens / 1M tokens * {{symbol}}{{price}}',
        {
          completion: completionTokens,
          symbol,
          price: completionUnitPrice.toFixed(6),
        },
      ),
    );

    const breakdownText = breakdownSegments.join(' + ');

    return (
      <>
        <article>
          <p>
            {i18next.t('提示价格：{{symbol}}{{price}} / 1M tokens', {
              symbol: symbol,
              price: (inputRatioPrice * rate).toFixed(6),
            })}
          </p>
          <p>
            {i18next.t(
              '补全价格：{{symbol}}{{price}} * {{ratio}} = {{symbol}}{{total}} / 1M tokens',
              {
                symbol: symbol,
                price: (inputRatioPrice * rate).toFixed(6),
                ratio: completionRatio,
                total: (completionRatioPrice * rate).toFixed(6),
              },
            )}
          </p>
          {shouldShowCache && (
            <p>
              {i18next.t(
                '缓存价格：{{symbol}}{{price}} * {{ratio}} = {{symbol}}{{total}} / 1M tokens (缓存倍率: {{cacheRatio}})',
                {
                  symbol: symbol,
                  price: (inputRatioPrice * rate).toFixed(6),
                  ratio: cacheRatio,
                  total: cacheUnitPrice.toFixed(6),
                  cacheRatio: cacheRatio,
                },
              )}
            </p>
          )}
          {shouldShowLegacyCacheCreation && (
            <p>
              {i18next.t(
                '缓存创建价格：{{symbol}}{{price}} * {{ratio}} = {{symbol}}{{total}} / 1M tokens (缓存创建倍率: {{cacheCreationRatio}})',
                {
                  symbol: symbol,
                  price: (inputRatioPrice * rate).toFixed(6),
                  ratio: cacheCreationRatio,
                  total: cacheCreationUnitPrice.toFixed(6),
                  cacheCreationRatio: cacheCreationRatio,
                },
              )}
            </p>
          )}
          {shouldShowCacheCreation5m && (
            <p>
              {i18next.t(
                '5m缓存创建价格：{{symbol}}{{price}} * {{ratio}} = {{symbol}}{{total}} / 1M tokens (5m缓存创建倍率: {{cacheCreationRatio5m}})',
                {
                  symbol: symbol,
                  price: (inputRatioPrice * rate).toFixed(6),
                  ratio: cacheCreationRatio5m,
                  total: cacheCreationUnitPrice5m.toFixed(6),
                  cacheCreationRatio5m: cacheCreationRatio5m,
                },
              )}
            </p>
          )}
          {shouldShowCacheCreation1h && (
            <p>
              {i18next.t(
                '1h缓存创建价格：{{symbol}}{{price}} * {{ratio}} = {{symbol}}{{total}} / 1M tokens (1h缓存创建倍率: {{cacheCreationRatio1h}})',
                {
                  symbol: symbol,
                  price: (inputRatioPrice * rate).toFixed(6),
                  ratio: cacheCreationRatio1h,
                  total: cacheCreationUnitPrice1h.toFixed(6),
                  cacheCreationRatio1h: cacheCreationRatio1h,
                },
              )}
            </p>
          )}
          {shouldShowCacheCreation5m && shouldShowCacheCreation1h && (
            <p>
              {i18next.t(
                '缓存创建价格合计：5m {{symbol}}{{five}} + 1h {{symbol}}{{one}} = {{symbol}}{{total}} / 1M tokens',
                {
                  symbol: symbol,
                  five: cacheCreationUnitPrice5m.toFixed(6),
                  one: cacheCreationUnitPrice1h.toFixed(6),
                  total: cacheCreationUnitPriceTotal.toFixed(6),
                },
              )}
            </p>
          )}
          <p></p>
          <p>
            {i18next.t(
              '{{breakdown}} * {{ratioType}} {{ratio}} = {{symbol}}{{total}}',
              {
                breakdown: breakdownText,
                ratioType: ratioLabel,
                ratio: groupRatio,
                symbol: symbol,
                total: (price * rate).toFixed(6),
              },
            )}
          </p>
          <p>{i18next.t('仅供参考，以实际扣费为准')}</p>
        </article>
      </>
    );
  }
}

export function renderClaudeLogContent(
  modelRatio,
  completionRatio,
  modelPrice = -1,
  groupRatio,
  user_group_ratio,
  cacheRatio = 1.0,
  cacheCreationRatio = 1.0,
  cacheCreationTokens5m = 0,
  cacheCreationRatio5m = 1.0,
  cacheCreationTokens1h = 0,
  cacheCreationRatio1h = 1.0,
) {
  const { ratio: effectiveGroupRatio, label: ratioLabel } = getEffectiveRatio(
    groupRatio,
    user_group_ratio,
  );
  groupRatio = effectiveGroupRatio;

  // 获取货币配置
  const { symbol, rate } = getCurrencyConfig();

  if (modelPrice !== -1) {
    return i18next.t('模型价格 {{symbol}}{{price}}，{{ratioType}} {{ratio}}', {
      symbol: symbol,
      price: (modelPrice * rate).toFixed(6),
      ratioType: ratioLabel,
      ratio: groupRatio,
    });
  } else {
    const hasSplitCacheCreation =
      cacheCreationTokens5m > 0 || cacheCreationTokens1h > 0;
    const shouldShowCacheCreation5m =
      hasSplitCacheCreation && cacheCreationTokens5m > 0;
    const shouldShowCacheCreation1h =
      hasSplitCacheCreation && cacheCreationTokens1h > 0;

    let cacheCreationPart = null;
    if (hasSplitCacheCreation) {
      if (shouldShowCacheCreation5m && shouldShowCacheCreation1h) {
        cacheCreationPart = i18next.t(
          '缓存创建倍率 5m {{cacheCreationRatio5m}} / 1h {{cacheCreationRatio1h}}',
          {
            cacheCreationRatio5m,
            cacheCreationRatio1h,
          },
        );
      } else if (shouldShowCacheCreation5m) {
        cacheCreationPart = i18next.t(
          '缓存创建倍率 5m {{cacheCreationRatio5m}}',
          {
            cacheCreationRatio5m,
          },
        );
      } else if (shouldShowCacheCreation1h) {
        cacheCreationPart = i18next.t(
          '缓存创建倍率 1h {{cacheCreationRatio1h}}',
          {
            cacheCreationRatio1h,
          },
        );
      }
    }

    if (!cacheCreationPart) {
      cacheCreationPart = i18next.t('缓存创建倍率 {{cacheCreationRatio}}', {
        cacheCreationRatio,
      });
    }

    const parts = [
      i18next.t('模型倍率 {{modelRatio}}', { modelRatio }),
      i18next.t('输出倍率 {{completionRatio}}', { completionRatio }),
      i18next.t('缓存倍率 {{cacheRatio}}', { cacheRatio }),
      cacheCreationPart,
      i18next.t('{{ratioType}} {{ratio}}', {
        ratioType: ratioLabel,
        ratio: groupRatio,
      }),
    ];

    return parts.join('，');
  }
}

// 已统一至 renderModelPriceSimple，若仍有遗留引用，请改为传入 provider='claude'

/**
 * rehype 插件：将段落等文本节点拆分为逐词 <span>，并添加淡入动画 class。
 * 仅在流式渲染阶段使用，避免已渲染文字重复动画。
 */
export function rehypeSplitWordsIntoSpans(options = {}) {
  const { previousContentLength = 0 } = options;

  return (tree) => {
    let currentCharCount = 0; // 当前已处理的字符数

    visit(tree, 'element', (node) => {
      if (
        ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'strong'].includes(
          node.tagName,
        ) &&
        node.children
      ) {
        const newChildren = [];
        node.children.forEach((child) => {
          if (child.type === 'text') {
            try {
              // 使用 Intl.Segmenter 精准拆分中英文及标点
              const segmenter = new Intl.Segmenter('zh', {
                granularity: 'word',
              });
              const segments = segmenter.segment(child.value);

              Array.from(segments)
                .map((seg) => seg.segment)
                .filter(Boolean)
                .forEach((word) => {
                  const wordStartPos = currentCharCount;
                  const wordEndPos = currentCharCount + word.length;

                  // 判断这个词是否是新增的（在 previousContentLength 之后）
                  const isNewContent = wordStartPos >= previousContentLength;

                  newChildren.push({
                    type: 'element',
                    tagName: 'span',
                    properties: {
                      className: isNewContent ? ['animate-fade-in'] : [],
                    },
                    children: [{ type: 'text', value: word }],
                  });

                  currentCharCount = wordEndPos;
                });
            } catch (_) {
              // Fallback：如果浏览器不支持 Segmenter
              const textStartPos = currentCharCount;
              const isNewContent = textStartPos >= previousContentLength;

              if (isNewContent) {
                // 新内容，添加动画
                newChildren.push({
                  type: 'element',
                  tagName: 'span',
                  properties: {
                    className: ['animate-fade-in'],
                  },
                  children: [{ type: 'text', value: child.value }],
                });
              } else {
                // 旧内容，不添加动画
                newChildren.push(child);
              }

              currentCharCount += child.value.length;
            }
          } else {
            newChildren.push(child);
          }
        });
        node.children = newChildren;
      }
    });
  };
}
