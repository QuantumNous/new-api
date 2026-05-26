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
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Modal, Tag, Typography, Avatar } from '@douyinfe/semi-ui';
import { copy, showSuccess } from './utils';
import { MOBILE_BREAKPOINT } from '../hooks/common/useIsMobile';
import {
  BILLING_PRICING_VARS,
  BILLING_VAR_KEY_TO_FIELD,
  BILLING_VAR_REGEX,
} from '../constants';
import { visit } from 'unist-util-visit';

// @lobehub/icons 相关函数已拆分到 lobe-icons.jsx，按需导入以避免加载整个图标库
// 使用 import + export 而非 re-export，因为本文件的 renderModelTag 也需要使用 getModelCategories
import {
  getModelCategories,
  getChannelIcon,
  getLobeHubIcon,
} from './lobe-icons';
export { getModelCategories, getChannelIcon, getLobeHubIcon };

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
  Palette,
  Coins,
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
    case 'image-studio':
      return <Palette {...commonProps} color={iconColor} />;
    case 'commission':
      return <Coins {...commonProps} color={iconColor} />;
    default:
      return <CircleUser {...commonProps} color={iconColor} />;
  }
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
      {item._isCategoryHeader ? (
        <div style={{ width: '100%', textAlign: 'center' }}>
          <Typography.Text type='tertiary' size='small' strong>
            {label}
          </Typography.Text>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Typography.Text strong type={disabled ? 'tertiary' : undefined}>
              {value}
            </Typography.Text>
            {label && (
              <span
                className='semi-typography semi-typography-secondary semi-typography-small semi-typography-normal group-desc-html'
                style={{ lineHeight: 1.4 }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(label.replace(/\\n/g, '\n'), { breaks: true })) }}
              />
            )}
          </div>
          {item.ratio != null && item.ratio !== undefined && renderRatio(item.ratio)}
        </>
      )}
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
  const quotaDisplayType = getEffectiveDisplayType();
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
  } else if (quotaDisplayType !== 'TOKENS') {
    // 自定义货币 code
    const found = findCustomCurrency(quotaDisplayType);
    if (found) {
      return (found.symbol || '¤') + num;
    }
    return num;
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
  const quotaDisplayType = getEffectiveDisplayType();
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
  } else if (quotaDisplayType !== 'USD') {
    // 自定义货币 code
    const found = findCustomCurrency(quotaDisplayType);
    if (found) {
      return (found.symbol || '¤') + amount;
    }
  }
  return '$' + amount;
}

/**
 * 从 localStorage 中查找自定义货币配置
 * @param {string} code - 货币代码
 * @returns {Object|null} - { symbol, exchange_rate } 或 null
 */
function findCustomCurrency(code) {
  try {
    const customCurrencies = JSON.parse(
      localStorage.getItem('custom_currencies') || '[]',
    );
    return customCurrencies.find((c) => c.code === code) || null;
  } catch (e) {
    return null;
  }
}

/**
 * 获取生效的额度展示类型（优先用户偏好，其次系统默认）
 * @returns {string} - 生效的展示类型 code
 */
export function getEffectiveDisplayType() {
  const userPref = localStorage.getItem('user_currency_preference');
  try {
    const enabled = JSON.parse(localStorage.getItem('enabled_currencies') || '["USD"]');
    if (userPref && enabled.includes(userPref)) return userPref;
  } catch (e) {
    // Ignore parse errors
  }
  return localStorage.getItem('quota_display_type') || 'USD';
}

/**
 * 获取当前货币配置信息
 * @returns {Object} - { symbol, rate, type }
 */
export function getCurrencyConfig() {
  const quotaDisplayType = getEffectiveDisplayType();
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
  } else if (quotaDisplayType !== 'TOKENS') {
    // 自定义货币 code
    const found = findCustomCurrency(quotaDisplayType);
    if (found) {
      symbol = found.symbol || '¤';
      rate = found.exchange_rate || 1;
    }
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

/**
 * 根据指定的货币类型获取货币配置
 * @param {string} type - 货币类型 code
 * @returns {Object} - { symbol, rate, type }
 */
function getCurrencyConfigByType(type) {
  const statusStr = localStorage.getItem('status');
  let symbol = '$';
  let rate = 1;

  if (type === 'CNY') {
    symbol = '¥';
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        rate = s?.usd_exchange_rate || 7;
      }
    } catch (e) {}
  } else if (type === 'CUSTOM') {
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        symbol = s?.custom_currency_symbol || '¤';
        rate = s?.custom_currency_exchange_rate || 1;
      }
    } catch (e) {}
  } else if (type !== 'TOKENS' && type !== 'USD') {
    const found = findCustomCurrency(type);
    if (found) {
      symbol = found.symbol || '¤';
      rate = found.exchange_rate || 1;
    }
  }

  return { symbol, rate, type };
}

/**
 * 获取双货币显示配置
 * primary: 系统默认货币（始终展示）
 * secondary: 用户偏好货币（仅当与系统默认不同时返回，否则为 null）
 * @returns {Object} - { primary: { symbol, rate, type }, secondary: { symbol, rate, type } | null }
 */
export function getDualCurrencyConfig() {
  const systemType = localStorage.getItem('quota_display_type') || 'USD';
  const effectiveType = getEffectiveDisplayType();

  const primary = getCurrencyConfigByType(systemType);

  if (systemType === effectiveType) {
    return { primary, secondary: null };
  }

  const secondary = getCurrencyConfigByType(effectiveType);
  return { primary, secondary };
}

/**
 * 格式化双货币价格
 * 如果有次要货币，返回 "1.000000 (¥7.000000)"，否则返回 "1.000000"
 * @param {number} usdPrice - 美元价格
 * @param {Object} primary - 主要货币 { symbol, rate }
 * @param {Object|null} secondary - 次要货币 { symbol, rate }，null 表示不展示
 * @param {number} digits - 小数位数
 * @returns {string}
 */
function formatDualPrice(usdPrice, primary, secondary, digits = 6) {
  const primaryStr = (usdPrice * primary.rate).toFixed(digits);
  if (!secondary) return primaryStr;
  return `${primaryStr} (${secondary.symbol}${(usdPrice * secondary.rate).toFixed(digits)})`;
}

export function renderQuota(quota, digits = 2) {
  let quotaPerUnit = localStorage.getItem('quota_per_unit');
  const systemType = localStorage.getItem('quota_display_type') || 'USD';
  quotaPerUnit = parseFloat(quotaPerUnit);
  if (systemType === 'TOKENS') {
    return renderNumber(quota);
  }
  const resultUSD = quota / quotaPerUnit;

  const { primary, secondary } = getDualCurrencyConfig();

  // 格式化单个货币值
  const formatOne = (usdAmount, cfg, d) => {
    const val = usdAmount * cfg.rate;
    const fixed = val.toFixed(d);
    if (parseFloat(fixed) === 0 && quota > 0 && val > 0) {
      const minValue = Math.pow(10, -d);
      return cfg.symbol + minValue.toFixed(d);
    }
    return cfg.symbol + fixed;
  };

  const primaryStr = formatOne(resultUSD, primary, digits);
  if (!secondary) {
    return primaryStr;
  }
  const secondaryStr = formatOne(resultUSD, secondary, digits);
  return `${primaryStr} (${secondaryStr})`;
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

function getQuotaDisplayType() {
  return localStorage.getItem('quota_display_type') || 'USD';
}

function resolveBillingDisplayMode(displayMode, modelPrice = -1) {
  if (modelPrice !== -1) {
    return 'price';
  }
  if (getQuotaDisplayType() === 'TOKENS') {
    return 'ratio';
  }
  return displayMode === 'ratio' ? 'ratio' : 'price';
}

function isPriceDisplayMode(displayMode, modelPrice = -1) {
  return resolveBillingDisplayMode(displayMode, modelPrice) === 'price';
}

function shouldUseRatioBillingProcess(modelPrice = -1) {
  return modelPrice === -1 && getQuotaDisplayType() === 'TOKENS';
}

function formatCompactDisplayPrice(usdAmount, digits = 6) {
  const { symbol, rate } = getCurrencyConfig();
  const amount = Number((usdAmount * rate).toFixed(digits));
  return `${symbol}${amount}`;
}

function appendPricePart(parts, condition, key, vars) {
  if (!condition) {
    return;
  }
  parts.push(i18next.t(key, vars));
}

function joinBillingSummary(parts) {
  return parts.filter(Boolean).join('，');
}

function getGroupRatioText(groupRatio, user_group_ratio) {
  const { ratio, label } = getEffectiveRatio(groupRatio, user_group_ratio);
  return i18next.t('{{ratioType}} {{ratio}}', {
    ratioType: label,
    ratio,
  });
}

function formatRatioValue(value, digits = 6) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Number(num.toFixed(digits));
}

function renderDisplayAmountFromUsd(usdAmount, digits = 6) {
  return renderQuotaWithAmount(Number(Number(usdAmount || 0).toFixed(digits)));
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
  saveServerSurcharge = 0,
  displayMode = 'price',
}) {
  const { ratio: effectiveGroupRatio, label: ratioLabel } = getEffectiveRatio(
    groupRatio,
    user_group_ratio,
  );
  const finalGroupRatio = effectiveGroupRatio;

  const { primary, secondary } = getDualCurrencyConfig();
  const { symbol, rate } = primary;
  const dp = (usdPrice, digits = 6) =>
    formatDualPrice(usdPrice, primary, secondary, digits);
  if (modelPrice !== -1) {
    const displayPrice = dp(modelPrice);
    let result = i18next.t('价格：{{symbol}}{{price}} * {{ratioType}}：{{ratio}}', {
      symbol: symbol,
      price: displayPrice,
      ratioType: ratioLabel,
      ratio: finalGroupRatio,
    });
    if (saveServerSurcharge > 0) {
      const pct = Math.round((saveServerSurcharge - 1) * 100);
      result += '，' + i18next.t('存储费 {{pct}}%', { pct });
    }
    return result;
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

  if (isPriceDisplayMode(displayMode, modelPrice)) {
    const parts = [];
    if (modelPrice !== -1) {
      parts.push(
        i18next.t('按次 {{price}} / 次', {
          price: formatCompactDisplayPrice(modelPrice),
        }),
      );
      parts.push(getGroupRatioText(groupRatio, user_group_ratio));
      if (saveServerSurcharge > 0) {
        const pct = Math.round((saveServerSurcharge - 1) * 100);
        parts.push(i18next.t('存储费 {{pct}}%', { pct }));
      }
      return joinBillingSummary(parts);
    }

    parts.push(
      i18next.t('输入 {{price}} / 1M tokens', {
        price: formatCompactDisplayPrice(modelRatio * 2.0),
      }),
    );

    if (shouldShowCache) {
      parts.push(
        i18next.t('缓存读取 {{price}}', {
          price: formatCompactDisplayPrice(modelRatio * 2.0 * cacheRatio),
        }),
      );
    }

    if (hasSplitCacheCreation && shouldShowCacheCreation5m) {
      parts.push(
        i18next.t('5m缓存创建 {{price}}', {
          price: formatCompactDisplayPrice(modelRatio * 2.0 * cacheCreationRatio5m),
        }),
      );
    }
    if (hasSplitCacheCreation && shouldShowCacheCreation1h) {
      parts.push(
        i18next.t('1h缓存创建 {{price}}', {
          price: formatCompactDisplayPrice(modelRatio * 2.0 * cacheCreationRatio1h),
        }),
      );
    }
    if (!hasSplitCacheCreation && shouldShowLegacyCacheCreation) {
      parts.push(
        i18next.t('缓存创建 {{price}}', {
          price: formatCompactDisplayPrice(modelRatio * 2.0 * cacheCreationRatio),
        }),
      );
    }

    if (image) {
      parts.push(
        i18next.t('图片输入 {{price}}', {
          price: formatCompactDisplayPrice(modelRatio * 2.0 * imageRatio),
        }),
      );
    }

    parts.push(getGroupRatioText(groupRatio, user_group_ratio));

    if (saveServerSurcharge > 0) {
      const pct = Math.round((saveServerSurcharge - 1) * 100);
      parts.push(i18next.t('存储费 {{pct}}%', { pct }));
    }

    let result = joinBillingSummary(parts);
    if (isSystemPromptOverride) {
      result += '\n\r' + i18next.t('系统提示覆盖');
    }
    return result;
  }

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

  if (saveServerSurcharge > 0) {
    const pct = Math.round((saveServerSurcharge - 1) * 100);
    result += '，' + i18next.t('存储费 {{pct}}%', { pct });
  }

  return result;
}

function formatBillingDisplayPrice(usdAmount, rate, digits = 6) {
  return (usdAmount * rate).toFixed(digits);
}

function buildBillingText(key, vars) {
  return i18next.t(key, vars);
}

function buildBillingPriceText(
  key,
  { symbol, usdAmount, rate, amountKey = 'price', digits = 6, ...vars },
) {
  return buildBillingText(key, {
    symbol,
    [amountKey]: formatBillingDisplayPrice(usdAmount, rate, digits),
    ...vars,
  });
}

function renderBillingArticle(lines, { showReferenceNote = true } = {}) {
  const articleLines = lines.filter(Boolean);

  if (showReferenceNote) {
    articleLines.push(buildBillingText('仅供参考，以实际扣费为准'));
  }

  return (
    <article>
      {articleLines.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </article>
  );
}

export function renderTaskBillingProcess(other, content) {
  if (other?.task_id != null) {
    return renderBillingArticle(
      [content].filter(Boolean),
      { showReferenceNote: false },
    );
  }
  return renderBillingArticle([
    buildBillingText('任务预扣费（将在任务完成后按实际token重算）'),
  ]);
}

export function renderModelPrice(opts) {
  const {
    prompt_tokens: inputTokens = 0,
    completion_tokens: completionTokens = 0,
    model_ratio: modelRatio = 0,
    model_price: modelPrice = -1,
    completion_ratio: _completionRatio,
    group_ratio: _groupRatio,
    user_group_ratio,
    cache_tokens: cacheTokens = 0,
    cache_ratio: cacheRatio = 1.0,
    image = false,
    image_ratio: imageRatio = 1.0,
    image_output: imageOutputTokens = 0,
    web_search: webSearch = false,
    web_search_call_count: webSearchCallCount = 0,
    web_search_price: webSearchPrice = 0,
    file_search: fileSearch = false,
    file_search_call_count: fileSearchCallCount = 0,
    file_search_price: fileSearchPrice = 0,
    audio_input_seperate_price: audioInputSeperatePrice = false,
    audio_input_token_count: audioInputTokens = 0,
    audio_input_price: audioInputPrice = 0,
    image_generation_call: imageGenerationCall = false,
    image_generation_call_price: imageGenerationCallPrice = 0,
    save_server_surcharge: saveServerSurcharge = 0,
    displayMode = 'price',
  } = opts;
  const { ratio: effectiveGroupRatio, label: ratioLabel } = getEffectiveRatio(
    _groupRatio,
    user_group_ratio,
  );
  let groupRatio = effectiveGroupRatio;
  const completionRatio = _completionRatio ?? 0;

  // 获取双货币配置：primary=系统默认，secondary=用户偏好（不同时才有值）
  const { primary, secondary } = getDualCurrencyConfig();
  const { symbol, rate } = primary;
  const dp = (usdPrice, digits = 6) =>
    formatDualPrice(usdPrice, primary, secondary, digits);

  if (modelPrice !== -1) {
    const displayPrice = dp(modelPrice);
    let total = modelPrice * groupRatio;
    if (saveServerSurcharge > 0) {
      const pct = Math.round((saveServerSurcharge - 1) * 100);
      total = total * saveServerSurcharge;
      const displayTotal = dp(total);
      return (
        <>
          <article>
            <p>{i18next.t('模型价格：{{symbol}}{{price}} * {{ratioType}}：{{ratio}}', {
              symbol: symbol,
              price: displayPrice,
              ratio: groupRatio,
              ratioType: ratioLabel,
            })}</p>
            <p>{i18next.t('+ 服务端存储服务费（7天） {{pct}}%', { pct })}</p>
            <p>{i18next.t('= {{symbol}}{{total}}', { symbol: symbol, total: displayTotal })}</p>
          </article>
        </>
      );
    }
    const displayTotal = dp(total);
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
  }

  const inputRatioPrice = modelRatio * 2.0;
    const completionRatioPrice = modelRatio * 2.0 * completionRatio;
    const cacheRatioPrice = modelRatio * 2.0 * cacheRatio;
    const imageRatioPrice = modelRatio * 2.0 * imageRatio;
    let effectiveInputTokens =
      inputTokens - cacheTokens + cacheTokens * cacheRatio;
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
    if (saveServerSurcharge > 0) {
      price = price * saveServerSurcharge;
    }

    return (
      <>
        <article>
          <p>
            {i18next.t(
              '输入价格：{{symbol}}{{price}} / 1M tokens{{audioPrice}}',
              {
                symbol: symbol,
                price: dp(inputRatioPrice),
                audioPrice: audioInputSeperatePrice
                  ? `，音频 ${symbol}${dp(audioInputPrice)} / 1M tokens`
                  : '',
              },
            )}
          </p>
          <p>
            {i18next.t(
              '输出价格：{{symbol}}{{price}} * {{completionRatio}} = {{symbol}}{{total}} / 1M tokens (补全倍率: {{completionRatio}})',
              {
                symbol: symbol,
                price: dp(inputRatioPrice),
                total: dp(completionRatioPrice),
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
                  price: dp(inputRatioPrice),
                  total: dp(inputRatioPrice * cacheRatio),
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
                  price: dp(imageRatioPrice),
                  ratio: groupRatio,
                  total: dp(imageRatioPrice * groupRatio),
                  imageRatio: imageRatio,
                },
              )}
            </p>
          )}
          {webSearch && webSearchCallCount > 0 && (
            <p>
              {i18next.t('Web搜索价格：{{symbol}}{{price}} / 1K 次', {
                symbol: symbol,
                price: dp(webSearchPrice),
              })}
            </p>
          )}
          {fileSearch && fileSearchCallCount > 0 && (
            <p>
              {i18next.t('文件搜索价格：{{symbol}}{{price}} / 1K 次', {
                symbol: symbol,
                price: dp(fileSearchPrice),
              })}
            </p>
          )}
          {imageGenerationCall && imageGenerationCallPrice > 0 && (
            <p>
              {i18next.t('图片生成调用：{{symbol}}{{price}} / 1次', {
                symbol: symbol,
                price: dp(imageGenerationCallPrice),
              })}
            </p>
          )}
          <p>
            {(() => {
              let inputDesc = '';
              if (image && imageOutputTokens > 0) {
                inputDesc = i18next.t(
                  '(输入 {{nonImageInput}} tokens + 图片输入 {{imageInput}} tokens / 1M tokens * {{symbol}}{{price}}',
                  {
                    nonImageInput: inputTokens - imageOutputTokens,
                    imageInput: imageOutputTokens,
                    symbol: symbol,
                    price: dp(inputRatioPrice),
                  },
                );
              } else if (cacheTokens > 0) {
                inputDesc = i18next.t(
                  '(输入 {{nonCacheInput}} tokens / 1M tokens * {{symbol}}{{price}} + 缓存 {{cacheInput}} tokens / 1M tokens * {{symbol}}{{cachePrice}}',
                  {
                    nonCacheInput: inputTokens - cacheTokens,
                    cacheInput: cacheTokens,
                    symbol: symbol,
                    price: dp(inputRatioPrice),
                    cachePrice: dp(cacheRatioPrice),
                  },
                );
              } else if (audioInputSeperatePrice && audioInputTokens > 0) {
                inputDesc = i18next.t(
                  '(输入 {{nonAudioInput}} tokens / 1M tokens * {{symbol}}{{price}} + 音频输入 {{audioInput}} tokens / 1M tokens * {{symbol}}{{audioPrice}}',
                  {
                    nonAudioInput: inputTokens - audioInputTokens,
                    audioInput: audioInputTokens,
                    symbol: symbol,
                    price: dp(inputRatioPrice),
                    audioPrice: dp(audioInputPrice),
                  },
                );
              } else {
                inputDesc = i18next.t(
                  '(输入 {{input}} tokens / 1M tokens * {{symbol}}{{price}}',
                  {
                    input: inputTokens,
                    symbol: symbol,
                    price: dp(inputRatioPrice),
                  },
                );
              }

              const outputDesc = i18next.t(
                '输出 {{completion}} tokens / 1M tokens * {{symbol}}{{compPrice}}) * {{ratioType}} {{ratio}}',
                {
                  completion: completionTokens,
                  symbol: symbol,
                  compPrice: dp(completionRatioPrice),
                  ratio: groupRatio,
                  ratioType: ratioLabel,
                },
              );

              const extraServices = [
                webSearch && webSearchCallCount > 0
                  ? i18next.t(
                      ' + Web搜索 {{count}}次 / 1K 次 * {{symbol}}{{price}} * {{ratioType}} {{ratio}}',
                      {
                        count: webSearchCallCount,
                        symbol: symbol,
                        price: dp(webSearchPrice),
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
                        price: dp(fileSearchPrice),
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
                        price: dp(imageGenerationCallPrice),
                        ratio: groupRatio,
                        ratioType: ratioLabel,
                      },
                    )
                  : '',
              ].join('');

              const surchargeDesc = saveServerSurcharge > 0
                ? i18next.t(' + 服务端存储服务费（7天） {{pct}}%', { pct: Math.round((saveServerSurcharge - 1) * 100) })
                : '';
              return i18next.t(
                '{{inputDesc}} + {{outputDesc}}{{extraServices}}{{surchargeDesc}} = {{symbol}}{{total}}',
                {
                  inputDesc,
                  outputDesc,
                  extraServices,
                  surchargeDesc,
                  symbol: symbol,
                  total: dp(price),
                },
              );
            })()}
          </p>
          <p>{i18next.t('仅供参考，以实际扣费为准')}</p>
        </article>
      </>
    );
  }


export function renderLogContent(opts) {
  const {
    model_ratio: modelRatio,
    completion_ratio: completionRatio,
    model_price: modelPrice = -1,
    group_ratio: groupRatio,
    user_group_ratio,
    cache_ratio: cacheRatio = 1.0,
    image = false,
    image_ratio: imageRatio = 1.0,
    web_search: webSearch = false,
    web_search_call_count: webSearchCallCount = 0,
    file_search: fileSearch = false,
    file_search_call_count: fileSearchCallCount = 0,
    displayMode = 'price',
  } = opts;
  const {
    ratio,
    label: ratioLabel,
    useUserGroupRatio: useUserGroupRatio,
  } = getEffectiveRatio(groupRatio, user_group_ratio);

  // 获取双货币配置
  const { primary, secondary } = getDualCurrencyConfig();
  const { symbol, rate } = primary;
  const dp = (usdPrice, digits = 6) =>
    formatDualPrice(usdPrice, primary, secondary, digits);

  if (isPriceDisplayMode(displayMode, modelPrice)) {
    if (modelPrice !== -1) {
      return joinBillingSummary([
        i18next.t('模型价格 {{symbol}}{{price}} / 次', {
          symbol,
          price: (modelPrice * rate).toFixed(6),
        }),
        getGroupRatioText(groupRatio, user_group_ratio),
      ]);
    }

    const parts = [
      i18next.t('输入价格 {{symbol}}{{price}} / 1M tokens', {
        symbol,
        price: (modelRatio * 2.0 * rate).toFixed(6),
      }),
      i18next.t('补全价格 {{symbol}}{{price}} / 1M tokens', {
        symbol,
        price: (modelRatio * 2.0 * completionRatio * rate).toFixed(6),
      }),
    ];
    appendPricePart(parts, cacheRatio !== 1.0, '缓存读取价格 {{symbol}}{{price}} / 1M tokens', {
      symbol,
      price: (modelRatio * 2.0 * cacheRatio * rate).toFixed(6),
    });
    appendPricePart(parts, image, '图片输入价格 {{symbol}}{{price}} / 1M tokens', {
      symbol,
      price: (modelRatio * 2.0 * imageRatio * rate).toFixed(6),
    });
    appendPricePart(parts, webSearch, 'Web 搜索调用 {{webSearchCallCount}} 次', {
      webSearchCallCount,
    });
    appendPricePart(parts, fileSearch, '文件搜索调用 {{fileSearchCallCount}} 次', {
      fileSearchCallCount,
    });
    parts.push(getGroupRatioText(groupRatio, user_group_ratio));
    return joinBillingSummary(parts);
  }

  if (modelPrice !== -1) {
    return i18next.t('模型价格 {{symbol}}{{price}}，{{ratioType}} {{ratio}}', {
      symbol: symbol,
      price: dp(modelPrice),
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

export function stripExprVersion(exprStr) {
  if (!exprStr) return { version: 1, body: '' };
  const m = exprStr.match(/^v(\d+):([\s\S]*)$/);
  if (m) return { version: Number(m[1]), body: m[2] };
  return { version: 1, body: exprStr };
}

function parseTierBody(bodyStr) {
  const coeffs = {};
  const re = new RegExp(BILLING_VAR_REGEX.source, 'g');
  let m;
  while ((m = re.exec(bodyStr)) !== null) {
    if (!(m[1] in coeffs)) coeffs[m[1]] = Number(m[2]);
  }
  const tier = {};
  for (const [varName, field] of Object.entries(BILLING_VAR_KEY_TO_FIELD)) {
    tier[field] = coeffs[varName] || 0;
  }
  return tier;
}

export function parseTiersFromExpr(exprStr) {
  if (!exprStr) return [];
  try {
    const { body } = stripExprVersion(exprStr);
    const condGroup = `((?:(?:p|c|len)\\s*(?:<|<=|>|>=)\\s*[\\d.eE+]+)(?:\\s*&&\\s*(?:p|c|len)\\s*(?:<|<=|>|>=)\\s*[\\d.eE+]+)*)`;
    const tierRe = new RegExp(`(?:${condGroup}\\s*\\?\\s*)?tier\\("([^"]*)",\\s*([^)]+)\\)`, 'g');
    const tiers = [];
    let m;
    while ((m = tierRe.exec(body)) !== null) {
      const condStr = m[1] || '';
      const conditions = [];
      if (condStr) {
        for (const cp of condStr.split(/\s*&&\s*/)) {
          const cm = cp.trim().match(/^(p|c|len)\s*(<|<=|>|>=)\s*([\d.eE+]+)$/);
          if (cm) conditions.push({ var: cm[1], op: cm[2], value: Number(cm[3]) });
        }
      }
      const tier = parseTierBody(m[3]);
      tier.label = m[2];
      tier.conditions = conditions;
      tiers.push(tier);
    }
    return tiers;
  } catch {
    return [];
  }
}

export function renderTieredModelPrice(opts) {
  const {
    prompt_tokens: inputTokens = 0,
    completion_tokens: completionTokens = 0,
    expr_b64: exprB64,
    matched_tier: matchedTier,
    group_ratio: groupRatio,
    cache_tokens: cacheTokens = 0,
    cache_creation_tokens: cacheCreationTokens = 0,
    cache_creation_tokens_5m: cacheCreationTokens5m = 0,
    cache_creation_tokens_1h: cacheCreationTokens1h = 0,
  } = opts;
  let exprStr = '';
  try { exprStr = atob(exprB64); } catch { /* ignore */ }
  const tiers = parseTiersFromExpr(exprStr);
  if (tiers.length === 0) {
    return i18next.t('阶梯计费（表达式解析失败）');
  }

  const tier = tiers.find((t) => t.label === matchedTier) || tiers[0];
  const { symbol, rate } = getCurrencyConfig();
  const gr = groupRatio || 1;

  const priceLines = BILLING_PRICING_VARS.map((v) => [v.field, v.label]);

  const lines = [
    buildBillingText('命中档位：{{tier}}', { tier: matchedTier || tier.label }),
    ...priceLines
      .filter(([field]) => tier[field] > 0)
      .map(([field, label]) =>
        buildBillingPriceText(`${label}：{{symbol}}{{price}} / 1M tokens`, { symbol, usdAmount: tier[field], rate }),
      ),
  ];

  return renderBillingArticle(lines);
}

export function renderTieredModelPriceSimple(opts) {
  const {
    expr_b64: exprB64,
    matched_tier: matchedTier,
    group_ratio: groupRatio,
    user_group_ratio,
    cache_tokens: cacheTokens = 0,
    cache_creation_tokens_5m: cacheCreationTokens5m = 0,
    cache_creation_tokens_1h: cacheCreationTokens1h = 0,
    cache_creation_tokens: cacheCreationTokens = 0,
    displayMode = 'price',
    outputMode = 'segments',
  } = opts;
  let exprStr = '';
  try { exprStr = atob(exprB64); } catch { /* ignore */ }
  const tiers = parseTiersFromExpr(exprStr);
  const tier = tiers.find((t) => t.label === matchedTier) || tiers[0];

  if (outputMode === 'segments') {
    const segments = [
      {
        tone: 'primary',
        text: getGroupRatioText(groupRatio, user_group_ratio),
      },
    ];

    if (tier && isPriceDisplayMode(displayMode)) {
      const priceSegments = BILLING_PRICING_VARS.map((v) => [v.field, v.shortLabel]);
      for (const [field, label] of priceSegments) {
        if (tier[field] > 0) {
          segments.push({
            tone: 'secondary',
            text: i18next.t('{{label}} {{price}} / 1M tokens', {
              label: i18next.t(label),
              price: formatCompactDisplayPrice(tier[field]),
            }),
          });
        }
      }
    }

    return segments;
  }

  return [];
}

export function renderModelPriceSimple(opts) {
  const {
    model_ratio: modelRatio,
    model_price: modelPrice = -1,
    group_ratio: groupRatio,
    user_group_ratio,
    cache_tokens: cacheTokens = 0,
    cache_ratio: cacheRatio = 1.0,
    cache_creation_tokens: cacheCreationTokens = 0,
    cache_creation_ratio: cacheCreationRatio = 1.0,
    cache_creation_tokens_5m: cacheCreationTokens5m = 0,
    cache_creation_ratio_5m: cacheCreationRatio5m = 1.0,
    cache_creation_tokens_1h: cacheCreationTokens1h = 0,
    cache_creation_ratio_1h: cacheCreationRatio1h = 1.0,
    image = false,
    image_ratio: imageRatio = 1.0,
    is_system_prompt_overwritten: isSystemPromptOverride = false,
    save_server_surcharge: saveServerSurcharge = 0,
    provider = 'openai',
    displayMode = 'price',
    outputMode = 'text',
  } = opts;
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
    saveServerSurcharge,
    displayMode,
  });
}

export function renderAudioModelPrice(opts) {
  const {
    prompt_tokens: inputTokens = 0,
    completion_tokens: completionTokens = 0,
    model_ratio: modelRatio = 0,
    model_price: modelPrice = -1,
    completion_ratio: _completionRatio,
    audio_input: audioInputTokens = 0,
    audio_output: audioCompletionTokens = 0,
    audio_ratio: _audioRatio,
    audio_completion_ratio: _audioCompletionRatio,
    group_ratio: _groupRatio,
    user_group_ratio,
    cache_tokens: cacheTokens = 0,
    cache_ratio: cacheRatio = 1.0,
    displayMode = 'price',
  } = opts;
  const { ratio: effectiveGroupRatio, label: ratioLabel } = getEffectiveRatio(
    _groupRatio,
    user_group_ratio,
  );
  let groupRatio = effectiveGroupRatio;
  const completionRatio = _completionRatio ?? 0;
  const audioRatio = parseFloat(_audioRatio ?? 0).toFixed(6);
  const audioCompletionRatio = _audioCompletionRatio ?? 0;

  // 获取双货币配置
  const { primary, secondary } = getDualCurrencyConfig();
  const { symbol, rate } = primary;
  const dp = (usdPrice, digits = 6) =>
    formatDualPrice(usdPrice, primary, secondary, digits);

  if (!shouldUseRatioBillingProcess(modelPrice)) {
    if (modelPrice !== -1) {
      return (
        <>
          <article>
            <p>
              {i18next.t('模型价格：{{symbol}}{{price}} / 次', {
                symbol,
                price: (modelPrice * rate).toFixed(6),
              })}
            </p>
            <p>
              {i18next.t(
                '模型价格 {{symbol}}{{price}} / 次 * {{ratioType}} {{ratio}} = {{symbol}}{{total}}',
                {
                  symbol,
                  price: (modelPrice * rate).toFixed(6),
                  ratioType: ratioLabel,
                  ratio: groupRatio,
                  total: (modelPrice * groupRatio * rate).toFixed(6),
                },
              )}
            </p>
            <p>{i18next.t('仅供参考，以实际扣费为准')}</p>
          </article>
        </>
      );
    }

    const inputRatioPrice = modelRatio * 2.0;
    const completionRatioPrice = modelRatio * 2.0 * completionRatio;
    const textPrice =
      ((inputTokens - cacheTokens + cacheTokens * cacheRatio) / 1000000) *
        inputRatioPrice *
        groupRatio +
      (completionTokens / 1000000) * completionRatioPrice * groupRatio;
    const audioPrice =
      (audioInputTokens / 1000000) * inputRatioPrice * audioRatio * groupRatio +
      (audioCompletionTokens / 1000000) *
        inputRatioPrice *
        audioRatio *
        audioCompletionRatio *
        groupRatio;
    const totalPrice = textPrice + audioPrice;

    return (
      <>
        <article>
          <p>
            {i18next.t('输入价格：{{symbol}}{{price}} / 1M tokens', {
              symbol,
              price: (inputRatioPrice * rate).toFixed(6),
            })}
          </p>
          <p>
            {i18next.t('补全价格：{{symbol}}{{price}} / 1M tokens', {
              symbol,
              price: (completionRatioPrice * rate).toFixed(6),
            })}
          </p>
          {cacheTokens > 0 && (
            <p>
              {i18next.t('缓存读取价格：{{symbol}}{{price}} / 1M tokens', {
                symbol,
                price: (inputRatioPrice * cacheRatio * rate).toFixed(6),
              })}
            </p>
          )}
          <p>
            {i18next.t('音频输入价格：{{symbol}}{{price}} / 1M tokens', {
              symbol,
              price: (inputRatioPrice * audioRatio * rate).toFixed(6),
            })}
          </p>
          <p>
            {i18next.t('音频补全价格：{{symbol}}{{price}} / 1M tokens', {
              symbol,
              price: (
                inputRatioPrice *
                audioRatio *
                audioCompletionRatio *
                rate
              ).toFixed(6),
            })}
          </p>
          <p>
            {i18next.t(
              '文字提示 {{input}} tokens / 1M tokens * {{symbol}}{{textInputPrice}} + 文字补全 {{completion}} tokens / 1M tokens * {{symbol}}{{textCompPrice}} + 音频提示 {{audioInput}} tokens / 1M tokens * {{symbol}}{{audioInputPrice}} + 音频补全 {{audioCompletion}} tokens / 1M tokens * {{symbol}}{{audioCompPrice}} * {{ratioType}} {{ratio}} = {{symbol}}{{total}}',
              {
                input: inputTokens,
                completion: completionTokens,
                audioInput: audioInputTokens,
                audioCompletion: audioCompletionTokens,
                textInputPrice: (inputRatioPrice * rate).toFixed(6),
                textCompPrice: (completionRatioPrice * rate).toFixed(6),
                audioInputPrice: (audioRatio * inputRatioPrice * rate).toFixed(6),
                audioCompPrice: (
                  audioRatio *
                  audioCompletionRatio *
                  inputRatioPrice *
                  rate
                ).toFixed(6),
                ratioType: ratioLabel,
                ratio: groupRatio,
                symbol,
                total: (totalPrice * rate).toFixed(6),
              },
            )}
          </p>
          <p>{i18next.t('仅供参考，以实际扣费为准')}</p>
        </article>
      </>
    );
  }

  // 1 ratio = $0.002 / 1K tokens
  if (modelPrice !== -1) {
    return i18next.t(
      '模型价格：{{symbol}}{{price}} * {{ratioType}}：{{ratio}} = {{symbol}}{{total}}',
      {
        symbol: symbol,
        price: dp(modelPrice),
        ratio: groupRatio,
        total: dp(modelPrice * groupRatio),
        ratioType: ratioLabel,
      },
    );
  } else {
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
              price: dp(inputRatioPrice),
            })}
          </p>
          <p>
            {i18next.t(
              '补全价格：{{symbol}}{{price}} * {{completionRatio}} = {{symbol}}{{total}} / 1M tokens (补全倍率: {{completionRatio}})',
              {
                symbol: symbol,
                price: dp(inputRatioPrice),
                total: dp(completionRatioPrice),
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
                  price: dp(inputRatioPrice),
                  total: dp(inputRatioPrice * cacheRatio),
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
                price: dp(inputRatioPrice),
                total: dp(inputRatioPrice * audioRatio),
                audioRatio: audioRatio,
              },
            )}
          </p>
          <p>
            {i18next.t(
              '音频补全价格：{{symbol}}{{price}} * {{audioRatio}} * {{audioCompRatio}} = {{symbol}}{{total}} / 1M tokens (音频补全倍率: {{audioCompRatio}})',
              {
                symbol: symbol,
                price: dp(inputRatioPrice),
                total: dp(
                  inputRatioPrice * audioRatio * audioCompletionRatio,
                ),
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
                    cachePrice: dp(inputRatioPrice * cacheRatio),
                    price: dp(inputRatioPrice),
                    completion: completionTokens,
                    compPrice: dp(completionRatioPrice),
                    total: dp(textPrice),
                  },
                )
              : i18next.t(
                  '文字提示 {{input}} tokens / 1M tokens * {{symbol}}{{price}} + 文字补全 {{completion}} tokens / 1M tokens * {{symbol}}{{compPrice}} = {{symbol}}{{total}}',
                  {
                    input: inputTokens,
                    symbol: symbol,
                    price: dp(inputRatioPrice),
                    completion: completionTokens,
                    compPrice: dp(completionRatioPrice),
                    total: dp(textPrice),
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
                audioInputPrice: dp(audioRatio * inputRatioPrice),
                audioCompPrice: dp(
                  audioRatio * audioCompletionRatio * inputRatioPrice,
                ),
                total: dp(audioPrice),
              },
            )}
          </p>
          <p>
            {i18next.t(
              '总价：文字价格 {{textPrice}} + 音频价格 {{audioPrice}} = {{symbol}}{{total}}',
              {
                symbol: symbol,
                total: dp(price),
                textPrice: dp(textPrice),
                audioPrice: dp(audioPrice),
              },
            )}
          </p>
          <p>{i18next.t('仅供参考，以实际扣费为准')}</p>
        </article>
      </>
    );
  }

  const modelRatioValue = formatRatioValue(modelRatio);
  const completionRatioValue = formatRatioValue(completionRatio);
  const cacheRatioValue = formatRatioValue(cacheRatio);
  const audioRatioValue = formatRatioValue(audioRatio);
  const audioCompletionRatioValue = formatRatioValue(audioCompletionRatio);

  const inputRatioPrice = modelRatio * 2.0;
  const completionRatioPrice = modelRatio * 2.0 * completionRatioValue;

  const effectiveInputTokens =
    inputTokens - cacheTokens + cacheTokens * cacheRatioValue;

  const textPrice =
    (effectiveInputTokens / 1000000) * inputRatioPrice * groupRatio +
    (completionTokens / 1000000) * completionRatioPrice * groupRatio;
  const audioPrice =
    (audioInputTokens / 1000000) * inputRatioPrice * audioRatioValue * groupRatio +
    (audioCompletionTokens / 1000000) *
      inputRatioPrice *
      audioRatioValue *
      audioCompletionRatioValue *
      groupRatio;
  const totalPrice = textPrice + audioPrice;

  return (
    <>
      <article>
        <p>
          {i18next.t(
            '模型倍率 {{modelRatio}}，补全倍率 {{completionRatio}}，音频倍率 {{audioRatio}}，音频补全倍率 {{audioCompletionRatio}}，{{cachePart}}{{ratioType}} {{ratio}}',
            {
              modelRatio: modelRatioValue,
              completionRatio: completionRatioValue,
              audioRatio: audioRatioValue,
              audioCompletionRatio: audioCompletionRatioValue,
              cachePart:
                cacheTokens > 0
                  ? `${i18next.t('缓存倍率')} ${cacheRatioValue}，`
                  : '',
              ratioType: ratioLabel,
              ratio: groupRatio,
            },
          )}
        </p>
        <p>
          {i18next.t(
            '普通输入：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
            {
              tokens: Math.max(inputTokens - cacheTokens, 0),
              modelRatio: modelRatioValue,
              ratioType: ratioLabel,
              ratio: groupRatio,
              amount: renderDisplayAmountFromUsd(
                ((Math.max(inputTokens - cacheTokens, 0) / 1000000) *
                  inputRatioPrice *
                  groupRatio),
              ),
            },
          )}
        </p>
        {cacheTokens > 0 && (
          <p>
            {i18next.t(
              '缓存输入：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 缓存倍率 {{cacheRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
              {
                tokens: cacheTokens,
                modelRatio: modelRatioValue,
                cacheRatio: cacheRatioValue,
                ratioType: ratioLabel,
                ratio: groupRatio,
                amount: renderDisplayAmountFromUsd(
                  ((cacheTokens / 1000000) *
                    inputRatioPrice *
                    cacheRatioValue *
                    groupRatio),
                ),
              },
            )}
          </p>
        )}
        <p>
          {i18next.t(
            '文字输出：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 补全倍率 {{completionRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
            {
              tokens: completionTokens,
              modelRatio: modelRatioValue,
              completionRatio: completionRatioValue,
              ratioType: ratioLabel,
              ratio: groupRatio,
              amount: renderDisplayAmountFromUsd(
                ((completionTokens / 1000000) *
                  inputRatioPrice *
                  completionRatioValue *
                  groupRatio),
              ),
            },
          )}
        </p>
        <p>
          {i18next.t(
            '音频输入：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 音频倍率 {{audioRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
            {
              tokens: audioInputTokens,
              modelRatio: modelRatioValue,
              audioRatio: audioRatioValue,
              ratioType: ratioLabel,
              ratio: groupRatio,
              amount: renderDisplayAmountFromUsd(
                ((audioInputTokens / 1000000) *
                  inputRatioPrice *
                  audioRatioValue *
                  groupRatio),
              ),
            },
          )}
        </p>
        <p>
          {i18next.t(
            '音频输出：{{tokens}} / 1M * 模型倍率 {{modelRatio}} * 音频倍率 {{audioRatio}} * 音频补全倍率 {{audioCompletionRatio}} * {{ratioType}} {{ratio}} = {{amount}}',
            {
              tokens: audioCompletionTokens,
              modelRatio: modelRatioValue,
              audioRatio: audioRatioValue,
              audioCompletionRatio: audioCompletionRatioValue,
              ratioType: ratioLabel,
              ratio: groupRatio,
              amount: renderDisplayAmountFromUsd(
                ((audioCompletionTokens / 1000000) *
                  inputRatioPrice *
                  audioRatioValue *
                  audioCompletionRatioValue *
                  groupRatio),
              ),
            },
          )}
        </p>
        <p>
          {i18next.t(
            '合计：文字部分 {{textTotal}} + 音频部分 {{audioTotal}} = {{total}}',
            {
              textTotal: renderDisplayAmountFromUsd(textPrice),
              audioTotal: renderDisplayAmountFromUsd(audioPrice),
              total: renderDisplayAmountFromUsd(totalPrice),
            },
          )}
        </p>
        <p>{i18next.t('仅供参考，以实际扣费为准')}</p>
      </article>
    </>
  );
}

export function renderQuotaWithPrompt(quota, digits) {
  const quotaDisplayType = getEffectiveDisplayType();
  if (quotaDisplayType !== 'TOKENS') {
    return i18next.t('等价金额：') + renderQuota(quota, digits);
  }
  return '';
}

export function renderClaudeModelPrice(opts) {
  const {
    prompt_tokens: inputTokens = 0,
    completion_tokens: completionTokens = 0,
    model_ratio: modelRatio = 0,
    model_price: modelPrice = -1,
    completion_ratio: _completionRatio,
    group_ratio: _groupRatio,
    user_group_ratio,
    cache_tokens: cacheTokens = 0,
    cache_ratio: cacheRatio = 1.0,
    cache_creation_tokens: cacheCreationTokens = 0,
    cache_creation_ratio: cacheCreationRatio = 1.0,
    cache_creation_tokens_5m: cacheCreationTokens5m = 0,
    cache_creation_ratio_5m: cacheCreationRatio5m = 1.0,
    cache_creation_tokens_1h: cacheCreationTokens1h = 0,
    cache_creation_ratio_1h: cacheCreationRatio1h = 1.0,
    displayMode = 'price',
  } = opts;
  const { ratio: effectiveGroupRatio, label: ratioLabel } = getEffectiveRatio(
    _groupRatio,
    user_group_ratio,
  );
  let groupRatio = effectiveGroupRatio;
  const completionRatio = _completionRatio ?? 0;

  // 获取双货币配置
  const { primary, secondary } = getDualCurrencyConfig();
  const { symbol, rate } = primary;
  const dp = (usdPrice, digits = 6) =>
    formatDualPrice(usdPrice, primary, secondary, digits);

  if (modelPrice !== -1) {
    return i18next.t(
      '模型价格：{{symbol}}{{price}} * {{ratioType}}：{{ratio}} = {{symbol}}{{total}}',
      {
        symbol: symbol,
        price: dp(modelPrice),
        ratioType: ratioLabel,
        ratio: groupRatio,
        total: dp(modelPrice * groupRatio),
      },
    );
  }

  const inputRatioPrice = modelRatio * 2.0;
    const completionRatioPrice = modelRatio * 2.0 * completionRatio;
    const cacheRatioPrice = modelRatio * 2.0 * cacheRatio;
    const cacheCreationRatioPrice = modelRatio * 2.0 * cacheCreationRatio;
    const cacheCreationRatioPrice5m = modelRatio * 2.0 * cacheCreationRatio5m;
    const cacheCreationRatioPrice1h = modelRatio * 2.0 * cacheCreationRatio1h;
    const hasSplitCacheCreation =
      cacheCreationTokens5m > 0 || cacheCreationTokens1h > 0;
    const legacyCacheCreationTokens = hasSplitCacheCreation
      ? 0
      : cacheCreationTokens;
    const effectiveInputTokens =
      inputTokens +
      cacheTokens * cacheRatio +
      legacyCacheCreationTokens * cacheCreationRatio +
      cacheCreationTokens5m * cacheCreationRatio5m +
      cacheCreationTokens1h * cacheCreationRatio1h;
    const price =
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
    const shouldShowCache = cacheTokens > 0;
    const shouldShowLegacyCacheCreation =
      !hasSplitCacheCreation && cacheCreationTokens > 0;
    const shouldShowCacheCreation5m =
      hasSplitCacheCreation && cacheCreationTokens5m > 0;
    const shouldShowCacheCreation1h =
      hasSplitCacheCreation && cacheCreationTokens1h > 0;

    const breakdownSegments = [
      i18next.t('提示 {{input}} tokens / 1M tokens * {{symbol}}{{price}}', {
        input: inputTokens,
        symbol,
        price: dp(inputRatioPrice),
      }),
    ];

    if (shouldShowCache) {
      breakdownSegments.push(
        i18next.t(
          '缓存 {{tokens}} tokens / 1M tokens * {{symbol}}{{price}} (倍率: {{ratio}})',
          {
            tokens: cacheTokens,
            symbol,
            price: dp(cacheRatioPrice),
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
            price: dp(cacheCreationRatioPrice),
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
            price: dp(cacheCreationRatioPrice5m),
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
            price: dp(cacheCreationRatioPrice1h),
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
          price: dp(completionRatioPrice),
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
              price: dp(inputRatioPrice),
            })}
          </p>
          <p>
            {i18next.t(
              '补全价格：{{symbol}}{{price}} * {{ratio}} = {{symbol}}{{total}} / 1M tokens',
              {
                symbol: symbol,
                price: dp(inputRatioPrice),
                ratio: completionRatio,
                total: dp(completionRatioPrice),
              },
            )}
          </p>
          {cacheTokens > 0 && (
            <p>
              {i18next.t(
                '缓存价格：{{symbol}}{{price}} * {{ratio}} = {{symbol}}{{total}} / 1M tokens (缓存倍率: {{cacheRatio}})',
                {
                  symbol: symbol,
                  price: dp(inputRatioPrice),
                  ratio: cacheRatio,
                  total: dp(cacheRatioPrice),
                  cacheRatio: cacheRatio,
                },
              )}
            </p>
          )}
          {!hasSplitCacheCreation && cacheCreationTokens > 0 && (
            <p>
              {i18next.t(
                '缓存创建价格：{{symbol}}{{price}} * {{ratio}} = {{symbol}}{{total}} / 1M tokens (缓存创建倍率: {{cacheCreationRatio}})',
                {
                  symbol: symbol,
                  price: dp(inputRatioPrice),
                  ratio: cacheCreationRatio,
                  total: dp(cacheCreationRatioPrice),
                  cacheCreationRatio: cacheCreationRatio,
                },
              )}
            </p>
          )}
          {hasSplitCacheCreation && cacheCreationTokens5m > 0 && (
            <p>
              {i18next.t(
                '5m缓存创建价格：{{symbol}}{{price}} * {{ratio}} = {{symbol}}{{total}} / 1M tokens (5m缓存创建倍率: {{cacheCreationRatio5m}})',
                {
                  symbol: symbol,
                  price: dp(inputRatioPrice),
                  ratio: cacheCreationRatio5m,
                  total: dp(cacheCreationRatioPrice5m),
                  cacheCreationRatio5m: cacheCreationRatio5m,
                },
              )}
            </p>
          )}
          {hasSplitCacheCreation && cacheCreationTokens1h > 0 && (
            <p>
              {i18next.t(
                '1h缓存创建价格：{{symbol}}{{price}} * {{ratio}} = {{symbol}}{{total}} / 1M tokens (1h缓存创建倍率: {{cacheCreationRatio1h}})',
                {
                  symbol: symbol,
                  price: dp(inputRatioPrice),
                  ratio: cacheCreationRatio1h,
                  total: dp(cacheCreationRatioPrice1h),
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
                  five: dp(cacheCreationRatioPrice5m),
                  one: dp(cacheCreationRatioPrice1h),
                  total: dp(
                    cacheCreationRatioPrice5m + cacheCreationRatioPrice1h,
                  ),
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
                total: dp(price),
              },
            )}
          </p>
          <p>{i18next.t('仅供参考，以实际扣费为准')}</p>
        </article>
      </>
    );
  }

export function renderClaudeLogContent(opts) {
  const {
    model_ratio: modelRatio,
    completion_ratio: completionRatio,
    model_price: modelPrice = -1,
    group_ratio: _groupRatio,
    user_group_ratio,
    cache_ratio: cacheRatio = 1.0,
    cache_creation_ratio: cacheCreationRatio = 1.0,
    cache_creation_tokens_5m: cacheCreationTokens5m = 0,
    cache_creation_ratio_5m: cacheCreationRatio5m = 1.0,
    cache_creation_tokens_1h: cacheCreationTokens1h = 0,
    cache_creation_ratio_1h: cacheCreationRatio1h = 1.0,
    displayMode = 'price',
  } = opts;
  const { ratio: effectiveGroupRatio, label: ratioLabel } = getEffectiveRatio(
    _groupRatio,
    user_group_ratio,
  );
  let groupRatio = effectiveGroupRatio;

  // 获取双货币配置
  const { primary, secondary } = getDualCurrencyConfig();
  const { symbol, rate } = primary;
  const dp = (usdPrice, digits = 6) =>
    formatDualPrice(usdPrice, primary, secondary, digits);

  if (isPriceDisplayMode(displayMode, modelPrice)) {
    if (modelPrice !== -1) {
      return joinBillingSummary([
        i18next.t('模型价格 {{symbol}}{{price}} / 次', {
          symbol,
          price: (modelPrice * rate).toFixed(6),
        }),
        getGroupRatioText(groupRatio, user_group_ratio),
      ]);
    }

    const parts = [
      i18next.t('输入价格 {{symbol}}{{price}} / 1M tokens', {
        symbol,
        price: (modelRatio * 2.0 * rate).toFixed(6),
      }),
      i18next.t('补全价格 {{symbol}}{{price}} / 1M tokens', {
        symbol,
        price: (modelRatio * 2.0 * completionRatio * rate).toFixed(6),
      }),
      i18next.t('缓存读取价格 {{symbol}}{{price}} / 1M tokens', {
        symbol,
        price: (modelRatio * 2.0 * cacheRatio * rate).toFixed(6),
      }),
    ];
    const hasSplitCacheCreation =
      cacheCreationTokens5m > 0 || cacheCreationTokens1h > 0;
    appendPricePart(
      parts,
      hasSplitCacheCreation && cacheCreationTokens5m > 0,
      '5m缓存创建价格 {{symbol}}{{price}} / 1M tokens',
      {
        symbol,
        price: (modelRatio * 2.0 * cacheCreationRatio5m * rate).toFixed(6),
      },
    );
    appendPricePart(
      parts,
      hasSplitCacheCreation && cacheCreationTokens1h > 0,
      '1h缓存创建价格 {{symbol}}{{price}} / 1M tokens',
      {
        symbol,
        price: (modelRatio * 2.0 * cacheCreationRatio1h * rate).toFixed(6),
      },
    );
    appendPricePart(
      parts,
      !hasSplitCacheCreation,
      '缓存创建价格 {{symbol}}{{price}} / 1M tokens',
      {
        symbol,
        price: (modelRatio * 2.0 * cacheCreationRatio * rate).toFixed(6),
      },
    );
    parts.push(getGroupRatioText(groupRatio, user_group_ratio));
    return joinBillingSummary(parts);
  }

  if (modelPrice !== -1) {
    return i18next.t('模型价格 {{symbol}}{{price}}，{{ratioType}} {{ratio}}', {
      symbol: symbol,
      price: dp(modelPrice),
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
