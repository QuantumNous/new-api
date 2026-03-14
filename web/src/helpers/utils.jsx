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

import { Toast, Pagination, InputNumber } from '@douyinfe/semi-ui';
import { toastConstants } from '../constants';
import React from 'react';
import { toast } from 'react-toastify';
import {
  THINK_TAG_REGEX,
  MESSAGE_ROLES,
} from '../constants/playground.constants';
import { TABLE_COMPACT_MODES_KEY } from '../constants';
import { MOBILE_BREAKPOINT } from '../hooks/common/useIsMobile';

/**
 * Toast content component that renders raw HTML.
 * @param {object} props
 * @param {string} props.htmlContent - HTML string to render
 * @returns {JSX.Element}
 */
const HTMLToastContent = ({ htmlContent }) => {
  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};
export default HTMLToastContent;
/**
 * Checks whether the current user has admin privileges (role >= 10).
 * @returns {boolean}
 */
export function isAdmin() {
  let user = localStorage.getItem('user');
  if (!user) return false;
  user = JSON.parse(user);
  return user.role >= 10;
}

/**
 * Checks whether the current user has root privileges (role >= 100).
 * @returns {boolean}
 */
export function isRoot() {
  let user = localStorage.getItem('user');
  if (!user) return false;
  user = JSON.parse(user);
  return user.role >= 100;
}

/**
 * Retrieves the system name from localStorage, defaults to 'New API'.
 * @returns {string}
 */
export function getSystemName() {
  let system_name = localStorage.getItem('system_name');
  if (!system_name) return 'New API';
  return system_name;
}

/**
 * Retrieves the logo URL from localStorage, defaults to '/logo.png'.
 * @returns {string}
 */
export function getLogo() {
  let logo = localStorage.getItem('logo');
  if (!logo) return '/logo.png';
  return logo;
}

/**
 * Retrieves the current user's ID from localStorage.
 * @returns {number} User ID, or -1 if not found
 */
export function getUserIdFromLocalStorage() {
  let user = localStorage.getItem('user');
  if (!user) return -1;
  user = JSON.parse(user);
  return user.id;
}

/**
 * Retrieves the footer HTML content from localStorage.
 * @returns {string|null}
 */
export function getFooterHTML() {
  return localStorage.getItem('footer_html');
}

/**
 * Copies the given text to the clipboard, with a textarea fallback for older browsers.
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Whether the copy succeeded
 */
export async function copy(text) {
  let okay = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    try {
      // 构建 textarea 执行复制命令，保留多行文本格式
      const textarea = window.document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      window.document.body.appendChild(textarea);
      textarea.select();
      window.document.execCommand('copy');
      window.document.body.removeChild(textarea);
    } catch (e) {
      okay = false;
      console.error(e);
    }
  }
  return okay;
}

// isMobile 函数已移除，请改用 useIsMobile Hook

let showErrorOptions = { autoClose: toastConstants.ERROR_TIMEOUT };
let showWarningOptions = { autoClose: toastConstants.WARNING_TIMEOUT };
let showSuccessOptions = { autoClose: toastConstants.SUCCESS_TIMEOUT };
let showInfoOptions = { autoClose: toastConstants.INFO_TIMEOUT };
let showNoticeOptions = { autoClose: false };

const isMobileScreen = window.matchMedia(
  `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
).matches;
if (isMobileScreen) {
  showErrorOptions.position = 'top-center';
  // showErrorOptions.transition = 'flip';

  showSuccessOptions.position = 'top-center';
  // showSuccessOptions.transition = 'flip';

  showInfoOptions.position = 'top-center';
  // showInfoOptions.transition = 'flip';

  showNoticeOptions.position = 'top-center';
  // showNoticeOptions.transition = 'flip';
}

/**
 * Displays an error toast. Handles Axios errors with status-specific messages.
 * @param {Error|string} error - Error object or message string
 */
export function showError(error) {
  console.error(error);
  if (error.message) {
    if (error.name === 'AxiosError') {
      switch (error.response.status) {
        case 401:
          // 清除用户状态
          localStorage.removeItem('user');
          // toast.error('错误：未登录或登录已过期，请重新登录！', showErrorOptions);
          window.location.href = '/login?expired=true';
          break;
        case 429:
          Toast.error('错误：请求次数过多，请稍后再试！');
          break;
        case 500:
          Toast.error('错误：服务器内部错误，请联系管理员！');
          break;
        case 405:
          Toast.info('本站仅作演示之用，无服务端！');
          break;
        default:
          Toast.error('错误：' + error.message);
      }
      return;
    }
    Toast.error('错误：' + error.message);
  } else {
    Toast.error('错误：' + error);
  }
}

/**
 * Displays a warning toast.
 * @param {string} message
 */
export function showWarning(message) {
  Toast.warning(message);
}

/**
 * Displays a success toast.
 * @param {string} message
 */
export function showSuccess(message) {
  Toast.success(message);
}

/**
 * Displays an info toast.
 * @param {string} message
 */
export function showInfo(message) {
  Toast.info(message);
}

/**
 * Displays a persistent info toast, optionally rendering HTML content.
 * @param {string} message - Text or HTML content
 * @param {boolean} [isHTML=false] - Whether to render as HTML
 */
export function showNotice(message, isHTML = false) {
  if (isHTML) {
    toast(<HTMLToastContent htmlContent={message} />, showNoticeOptions);
  } else {
    Toast.info(message);
  }
}

/**
 * Opens the given URL in a new browser tab/window.
 * @param {string} url
 */
export function openPage(url) {
  window.open(url);
}

/**
 * Removes the trailing slash from a URL string.
 * @param {string} url
 * @returns {string}
 */
export function removeTrailingSlash(url) {
  if (!url) return '';
  if (url.endsWith('/')) {
    return url.slice(0, -1);
  } else {
    return url;
  }
}

/**
 * Returns the Unix timestamp (seconds) for the start of today (00:00:00).
 * @returns {number}
 */
export function getTodayStartTimestamp() {
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor(now.getTime() / 1000);
}

/**
 * Formats a Unix timestamp (seconds) to "YYYY-MM-DD HH:mm:ss".
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string}
 */
export function timestamp2string(timestamp) {
  let date = new Date(timestamp * 1000);
  let year = date.getFullYear().toString();
  let month = (date.getMonth() + 1).toString();
  let day = date.getDate().toString();
  let hour = date.getHours().toString();
  let minute = date.getMinutes().toString();
  let second = date.getSeconds().toString();
  if (month.length === 1) {
    month = '0' + month;
  }
  if (day.length === 1) {
    day = '0' + day;
  }
  if (hour.length === 1) {
    hour = '0' + hour;
  }
  if (minute.length === 1) {
    minute = '0' + minute;
  }
  if (second.length === 1) {
    second = '0' + second;
  }
  return (
    year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second
  );
}

/**
 * Formats a Unix timestamp with configurable granularity (hour, day, or week range).
 * @param {number} timestamp - Unix timestamp in seconds
 * @param {string} [dataExportDefaultTime='hour'] - Granularity: 'hour', 'day', or 'week'
 * @param {boolean} [showYear=false] - Whether to include the year
 * @returns {string}
 */
export function timestamp2string1(
  timestamp,
  dataExportDefaultTime = 'hour',
  showYear = false,
) {
  let date = new Date(timestamp * 1000);
  let year = date.getFullYear();
  let month = (date.getMonth() + 1).toString();
  let day = date.getDate().toString();
  let hour = date.getHours().toString();
  if (month.length === 1) {
    month = '0' + month;
  }
  if (day.length === 1) {
    day = '0' + day;
  }
  if (hour.length === 1) {
    hour = '0' + hour;
  }
  // 仅在跨年时显示年份
  let str = showYear ? year + '-' + month + '-' + day : month + '-' + day;
  if (dataExportDefaultTime === 'hour') {
    str += ' ' + hour + ':00';
  } else if (dataExportDefaultTime === 'week') {
    let nextWeek = new Date(timestamp * 1000 + 6 * 24 * 60 * 60 * 1000);
    let nextWeekYear = nextWeek.getFullYear();
    let nextMonth = (nextWeek.getMonth() + 1).toString();
    let nextDay = nextWeek.getDate().toString();
    if (nextMonth.length === 1) {
      nextMonth = '0' + nextMonth;
    }
    if (nextDay.length === 1) {
      nextDay = '0' + nextDay;
    }
    // 周视图结束日期也仅在跨年时显示年份
    let nextStr = showYear
      ? nextWeekYear + '-' + nextMonth + '-' + nextDay
      : nextMonth + '-' + nextDay;
    str += ' - ' + nextStr;
  }
  return str;
}

/**
 * Checks whether a set of Unix timestamps span across multiple calendar years.
 * @param {number[]} timestamps - Array of Unix timestamps in seconds
 * @returns {boolean}
 */
export function isDataCrossYear(timestamps) {
  if (!timestamps || timestamps.length === 0) return false;
  const years = new Set(
    timestamps.map((ts) => new Date(ts * 1000).getFullYear()),
  );
  return years.size > 1;
}

/**
 * Downloads the given text content as a file.
 * @param {string} text - File content
 * @param {string} filename - Download filename
 */
export function downloadTextAsFile(text, filename) {
  let blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

/**
 * Validates whether a string is valid JSON.
 * @param {string} str
 * @returns {boolean}
 */
export const verifyJSON = (str) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

/**
 * Validates a JSON string, returning a resolved or rejected Promise.
 * @param {string} value
 * @returns {Promise<void>}
 */
export function verifyJSONPromise(value) {
  try {
    JSON.parse(value);
    return Promise.resolve();
  } catch (e) {
    return Promise.reject('不是合法的 JSON 字符串');
  }
}

/**
 * Checks if a one-time prompt with the given ID should be displayed.
 * @param {string} id - Prompt identifier
 * @returns {boolean}
 */
export function shouldShowPrompt(id) {
  let prompt = localStorage.getItem(`prompt-${id}`);
  return !prompt;
}

/**
 * Marks a one-time prompt as shown so it won't display again.
 * @param {string} id - Prompt identifier
 */
export function setPromptShown(id) {
  localStorage.setItem(`prompt-${id}`, 'true');
}

/**
 * 比较两个对象的属性，找出有变化的属性，并返回包含变化属性信息的数组
 * @param {Object} oldObject - 旧对象
 * @param {Object} newObject - 新对象
 * @return {Array} 包含变化属性信息的数组，每个元素是一个对象，包含 key, oldValue 和 newValue
 */
export function compareObjects(oldObject, newObject) {
  const changedProperties = [];

  // 比较两个对象的属性
  for (const key in oldObject) {
    if (oldObject.hasOwnProperty(key) && newObject.hasOwnProperty(key)) {
      if (oldObject[key] !== newObject[key]) {
        changedProperties.push({
          key: key,
          oldValue: oldObject[key],
          newValue: newObject[key],
        });
      }
    }
  }

  return changedProperties;
}

// playground message

/**
 * Generates a unique auto-incrementing message ID string.
 * @returns {string}
 */
let messageId = 4;
export const generateMessageId = () => `${messageId++}`;

/**
 * Extracts the text content from a message object.
 * @param {object} message - Message with string or array content
 * @returns {string}
 */
export const getTextContent = (message) => {
  if (!message || !message.content) return '';

  if (Array.isArray(message.content)) {
    const textContent = message.content.find((item) => item.type === 'text');
    return textContent?.text || '';
  }
  return typeof message.content === 'string' ? message.content : '';
};

/**
 * Extracts and separates `<think>` tag content from the main content string.
 * @param {string} content - Raw content possibly containing <think> tags
 * @param {string} [reasoningContent=''] - Existing reasoning content to append to
 * @returns {{content: string, reasoningContent: string}}
 */
export const processThinkTags = (content, reasoningContent = '') => {
  if (!content || !content.includes('<think>')) {
    return { content, reasoningContent };
  }

  const thoughts = [];
  const replyParts = [];
  let lastIndex = 0;
  let match;

  THINK_TAG_REGEX.lastIndex = 0;
  while ((match = THINK_TAG_REGEX.exec(content)) !== null) {
    replyParts.push(content.substring(lastIndex, match.index));
    thoughts.push(match[1]);
    lastIndex = match.index + match[0].length;
  }
  replyParts.push(content.substring(lastIndex));

  const processedContent = replyParts
    .join('')
    .replace(/<\/?think>/g, '')
    .trim();
  const thoughtsStr = thoughts.join('\n\n---\n\n');
  const processedReasoningContent =
    reasoningContent && thoughtsStr
      ? `${reasoningContent}\n\n---\n\n${thoughtsStr}`
      : reasoningContent || thoughtsStr;

  return {
    content: processedContent,
    reasoningContent: processedReasoningContent,
  };
};

/**
 * Processes content with potentially unclosed `<think>` tags during streaming.
 * @param {string} content - Raw streaming content
 * @param {string} [reasoningContent=''] - Existing reasoning content
 * @returns {{content: string, reasoningContent: string}}
 */
export const processIncompleteThinkTags = (content, reasoningContent = '') => {
  if (!content) return { content: '', reasoningContent };

  const lastOpenThinkIndex = content.lastIndexOf('<think>');
  if (lastOpenThinkIndex === -1) {
    return processThinkTags(content, reasoningContent);
  }

  const fragmentAfterLastOpen = content.substring(lastOpenThinkIndex);
  if (!fragmentAfterLastOpen.includes('</think>')) {
    const unclosedThought = fragmentAfterLastOpen
      .substring('<think>'.length)
      .trim();
    const cleanContent = content.substring(0, lastOpenThinkIndex);
    const processedReasoningContent = unclosedThought
      ? reasoningContent
        ? `${reasoningContent}\n\n---\n\n${unclosedThought}`
        : unclosedThought
      : reasoningContent;

    return processThinkTags(cleanContent, processedReasoningContent);
  }

  return processThinkTags(content, reasoningContent);
};

/**
 * Builds message content, optionally including image URLs as multimodal content parts.
 * @param {string} textContent - Text content of the message
 * @param {string[]} [imageUrls=[]] - Array of image URLs
 * @param {boolean} [imageEnabled=false] - Whether image mode is active
 * @returns {string|Array<object>}
 */
export const buildMessageContent = (
  textContent,
  imageUrls = [],
  imageEnabled = false,
) => {
  if (!textContent && (!imageUrls || imageUrls.length === 0)) {
    return '';
  }

  const validImageUrls = imageUrls.filter((url) => url && url.trim() !== '');

  if (imageEnabled && validImageUrls.length > 0) {
    return [
      { type: 'text', text: textContent || '' },
      ...validImageUrls.map((url) => ({
        type: 'image_url',
        image_url: { url: url.trim() },
      })),
    ];
  }

  return textContent || '';
};

/**
 * Creates a new message object with auto-generated ID and timestamp.
 * @param {string} role - Message role (e.g. 'user', 'assistant', 'system')
 * @param {string|Array} content - Message content
 * @param {object} [options={}] - Additional message properties
 * @returns {object}
 */
export const createMessage = (role, content, options = {}) => ({
  role,
  content,
  createAt: Date.now(),
  id: generateMessageId(),
  ...options,
});

/**
 * Creates a loading placeholder assistant message for streaming responses.
 * @returns {object}
 */
export const createLoadingAssistantMessage = () =>
  createMessage(MESSAGE_ROLES.ASSISTANT, '', {
    reasoningContent: '',
    isReasoningExpanded: true,
    isThinkingComplete: false,
    hasAutoCollapsed: false,
    status: 'loading',
  });

/**
 * Checks whether a message contains image_url content parts.
 * @param {object} message
 * @returns {boolean}
 */
export const hasImageContent = (message) => {
  return (
    message &&
    Array.isArray(message.content) &&
    message.content.some((item) => item.type === 'image_url')
  );
};

/**
 * Formats a message object into the shape expected by the chat API.
 * @param {object} message
 * @returns {{role: string, content: string|Array}|null}
 */
export const formatMessageForAPI = (message) => {
  if (!message) return null;

  return {
    role: message.role,
    content: message.content,
  };
};

/**
 * Checks whether a message object has a valid role and content.
 * @param {object} message
 * @returns {boolean}
 */
export const isValidMessage = (message) => {
  return message && message.role && (message.content || message.content === '');
};

/**
 * Returns the last message with role 'user' from the messages array.
 * @param {object[]} messages
 * @returns {object|null}
 */
export const getLastUserMessage = (messages) => {
  if (!Array.isArray(messages)) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === MESSAGE_ROLES.USER) {
      return messages[i];
    }
  }
  return null;
};

/**
 * Returns the last message with role 'assistant' from the messages array.
 * @param {object[]} messages
 * @returns {object|null}
 */
export const getLastAssistantMessage = (messages) => {
  if (!Array.isArray(messages)) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === MESSAGE_ROLES.ASSISTANT) {
      return messages[i];
    }
  }
  return null;
};

/**
 * Returns a human-readable relative time string (e.g. "3 hours ago") for the given date.
 * @param {string|Date} publishDate
 * @returns {string}
 */
export const getRelativeTime = (publishDate) => {
  if (!publishDate) return '';

  const now = new Date();
  const pubDate = new Date(publishDate);

  // 如果日期无效，返回原始字符串
  if (isNaN(pubDate.getTime())) return publishDate;

  const diffMs = now.getTime() - pubDate.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  // 如果是未来时间，显示具体日期
  if (diffMs < 0) {
    return formatDateString(pubDate);
  }

  // 根据时间差返回相应的描述
  if (diffSeconds < 60) {
    return '刚刚';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours} 小时前`;
  } else if (diffDays < 7) {
    return `${diffDays} 天前`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks} 周前`;
  } else if (diffMonths < 12) {
    return `${diffMonths} 个月前`;
  } else if (diffYears < 2) {
    return '1 年前';
  } else {
    // 超过2年显示具体日期
    return formatDateString(pubDate);
  }
};

/**
 * Formats a Date object to "YYYY-MM-DD" string.
 * @param {Date} date
 * @returns {string}
 */
export const formatDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formats a Date object to "YYYY-MM-DD HH:mm" string.
 * @param {Date} date
 * @returns {string}
 */
export const formatDateTimeString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

function readTableCompactModes() {
  try {
    const json = localStorage.getItem(TABLE_COMPACT_MODES_KEY);
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

function writeTableCompactModes(modes) {
  try {
    localStorage.setItem(TABLE_COMPACT_MODES_KEY, JSON.stringify(modes));
  } catch {
    // ignore
  }
}

/**
 * Gets the compact mode setting for a specific table from localStorage.
 * @param {string} [tableKey='global'] - Table identifier
 * @returns {boolean}
 */
export function getTableCompactMode(tableKey = 'global') {
  const modes = readTableCompactModes();
  return !!modes[tableKey];
}

/**
 * Persists the compact mode setting for a specific table to localStorage.
 * @param {boolean} compact
 * @param {string} [tableKey='global'] - Table identifier
 */
export function setTableCompactMode(compact, tableKey = 'global') {
  const modes = readTableCompactModes();
  modes[tableKey] = compact;
  writeTableCompactModes(modes);
}

// -------------------------------
// Select 组件统一过滤逻辑
/**
 * Unified Select component filter function that matches against both option value and label.
 * @param {string} input - Search keyword
 * @param {object} option - Select option with value and label
 * @returns {boolean}
 */
export const selectFilter = (input, option) => {
  if (!input) return true;

  const keyword = input.trim().toLowerCase();
  const valueText = (option?.value ?? '').toString().toLowerCase();
  const labelText = (option?.label ?? '').toString().toLowerCase();

  return valueText.includes(keyword) || labelText.includes(keyword);
};

// -------------------------------
/**
 * Calculates display prices for a model based on its billing type, group ratio, and currency.
 * @param {object} params
 * @param {object} params.record - Model record with pricing fields
 * @param {string} params.selectedGroup - Selected user group
 * @param {object} params.groupRatio - Map of group names to ratio multipliers
 * @param {string} params.tokenUnit - Token unit ('K' or 'M')
 * @param {Function} params.displayPrice - Function to convert USD price to display value
 * @param {string} params.currency - Currency code ('USD', 'CNY', 'CUSTOM')
 * @param {string} [params.quotaDisplayType='USD'] - Display type
 * @param {number} [params.precision=4] - Decimal precision
 * @returns {object} Computed price data
 */
export const calculateModelPrice = ({
  record,
  selectedGroup,
  groupRatio,
  tokenUnit,
  displayPrice,
  currency,
  quotaDisplayType = 'USD',
  precision = 4,
}) => {
  // 1. 选择实际使用的分组
  let usedGroup = selectedGroup;
  let usedGroupRatio = groupRatio[selectedGroup];

  if (selectedGroup === 'all' || usedGroupRatio === undefined) {
    // 在模型可用分组中选择倍率最小的分组，若无则使用 1
    let minRatio = Number.POSITIVE_INFINITY;
    if (
      Array.isArray(record.enable_groups) &&
      record.enable_groups.length > 0
    ) {
      record.enable_groups.forEach((g) => {
        const r = groupRatio[g];
        if (r !== undefined && r < minRatio) {
          minRatio = r;
          usedGroup = g;
          usedGroupRatio = r;
        }
      });
    }

    // 如果找不到合适分组倍率，回退为 1
    if (usedGroupRatio === undefined) {
      usedGroupRatio = 1;
    }
  }

  // 2. 根据计费类型计算价格
  if (record.quota_type === 0) {
    // 按量计费
    const isTokensDisplay = quotaDisplayType === 'TOKENS';
    const inputRatioPriceUSD = record.model_ratio * 2 * usedGroupRatio;
    const unitDivisor = tokenUnit === 'K' ? 1000 : 1;
    const unitLabel = tokenUnit === 'K' ? 'K' : 'M';
    const hasRatioValue = (value) =>
      value !== undefined &&
      value !== null &&
      value !== '' &&
      Number.isFinite(Number(value));

    const formatRatio = (value) =>
      hasRatioValue(value) ? Number(Number(value).toFixed(6)) : null;

    if (isTokensDisplay) {
      return {
        inputRatio: formatRatio(record.model_ratio),
        completionRatio: formatRatio(record.completion_ratio),
        cacheRatio: formatRatio(record.cache_ratio),
        createCacheRatio: formatRatio(record.create_cache_ratio),
        imageRatio: formatRatio(record.image_ratio),
        audioInputRatio: formatRatio(record.audio_ratio),
        audioOutputRatio: formatRatio(record.audio_completion_ratio),
        isPerToken: true,
        isTokensDisplay: true,
        usedGroup,
        usedGroupRatio,
      };
    }

    let symbol = '$';
    if (currency === 'CNY') {
      symbol = '¥';
    } else if (currency === 'CUSTOM') {
      try {
        const statusStr = localStorage.getItem('status');
        if (statusStr) {
          const s = JSON.parse(statusStr);
          symbol = s?.custom_currency_symbol || '¤';
        } else {
          symbol = '¤';
        }
      } catch (e) {
        symbol = '¤';
      }
    }

    const formatTokenPrice = (priceUSD) => {
      const rawDisplayPrice = displayPrice(priceUSD);
      const numericPrice =
        parseFloat(rawDisplayPrice.replace(/[^0-9.]/g, '')) / unitDivisor;
      return `${symbol}${numericPrice.toFixed(precision)}`;
    };

    const inputPrice = formatTokenPrice(inputRatioPriceUSD);
    const audioInputPrice = hasRatioValue(record.audio_ratio)
      ? formatTokenPrice(inputRatioPriceUSD * Number(record.audio_ratio))
      : null;

    return {
      inputPrice,
      completionPrice: formatTokenPrice(
        inputRatioPriceUSD * Number(record.completion_ratio),
      ),
      cachePrice: hasRatioValue(record.cache_ratio)
        ? formatTokenPrice(inputRatioPriceUSD * Number(record.cache_ratio))
        : null,
      createCachePrice: hasRatioValue(record.create_cache_ratio)
        ? formatTokenPrice(inputRatioPriceUSD * Number(record.create_cache_ratio))
        : null,
      imagePrice: hasRatioValue(record.image_ratio)
        ? formatTokenPrice(inputRatioPriceUSD * Number(record.image_ratio))
        : null,
      audioInputPrice,
      audioOutputPrice:
        audioInputPrice && hasRatioValue(record.audio_completion_ratio)
          ? formatTokenPrice(
              inputRatioPriceUSD *
                Number(record.audio_ratio) *
                Number(record.audio_completion_ratio),
            )
          : null,
      unitLabel,
      isPerToken: true,
      isTokensDisplay: false,
      usedGroup,
      usedGroupRatio,
    };
  }

  if (record.quota_type === 1) {
    // 按次计费
    const priceUSD = parseFloat(record.model_price) * usedGroupRatio;
    const displayVal = displayPrice(priceUSD);

    return {
      price: displayVal,
      isPerToken: false,
      isTokensDisplay: false,
      usedGroup,
      usedGroupRatio,
    };
  }

  // 未知计费类型，返回占位信息
  return {
    price: '-',
    isPerToken: false,
    isTokensDisplay: false,
    usedGroup,
    usedGroupRatio,
  };
};

/**
 * Converts computed price data into an array of label/value items for display.
 * @param {object} priceData - Price data from calculateModelPrice
 * @param {Function} t - i18n translation function
 * @param {string} [quotaDisplayType='USD'] - Display type
 * @returns {Array<{key: string, label: string, value: string, suffix: string}>}
 */
export const getModelPriceItems = (
  priceData,
  t,
  quotaDisplayType = 'USD',
) => {
  if (priceData.isPerToken) {
    if (quotaDisplayType === 'TOKENS' || priceData.isTokensDisplay) {
      return [
        {
          key: 'input-ratio',
          label: t('输入倍率'),
          value: priceData.inputRatio,
          suffix: 'x',
        },
        {
          key: 'completion-ratio',
          label: t('补全倍率'),
          value: priceData.completionRatio,
          suffix: 'x',
        },
        {
          key: 'cache-ratio',
          label: t('缓存读取倍率'),
          value: priceData.cacheRatio,
          suffix: 'x',
        },
        {
          key: 'create-cache-ratio',
          label: t('缓存创建倍率'),
          value: priceData.createCacheRatio,
          suffix: 'x',
        },
        {
          key: 'image-ratio',
          label: t('图片输入倍率'),
          value: priceData.imageRatio,
          suffix: 'x',
        },
        {
          key: 'audio-input-ratio',
          label: t('音频输入倍率'),
          value: priceData.audioInputRatio,
          suffix: 'x',
        },
        {
          key: 'audio-output-ratio',
          label: t('音频补全倍率'),
          value: priceData.audioOutputRatio,
          suffix: 'x',
        },
      ].filter(
        (item) =>
          item.value !== null && item.value !== undefined && item.value !== '',
      );
    }

    const unitSuffix = ` / 1${priceData.unitLabel} Tokens`;
    return [
      {
        key: 'input',
        label: t('输入价格'),
        value: priceData.inputPrice,
        suffix: unitSuffix,
      },
      {
        key: 'completion',
        label: t('补全价格'),
        value: priceData.completionPrice,
        suffix: unitSuffix,
      },
      {
        key: 'cache',
        label: t('缓存读取价格'),
        value: priceData.cachePrice,
        suffix: unitSuffix,
      },
      {
        key: 'create-cache',
        label: t('缓存创建价格'),
        value: priceData.createCachePrice,
        suffix: unitSuffix,
      },
      {
        key: 'image',
        label: t('图片输入价格'),
        value: priceData.imagePrice,
        suffix: unitSuffix,
      },
      {
        key: 'audio-input',
        label: t('音频输入价格'),
        value: priceData.audioInputPrice,
        suffix: unitSuffix,
      },
      {
        key: 'audio-output',
        label: t('音频补全价格'),
        value: priceData.audioOutputPrice,
        suffix: unitSuffix,
      },
    ].filter((item) => item.value !== null && item.value !== undefined && item.value !== '');
  }

  return [
    {
      key: 'fixed',
      label: t('模型价格'),
      value: priceData.price,
      suffix: ` / ${t('次')}`,
    },
  ].filter((item) => item.value !== null && item.value !== undefined && item.value !== '');
};

/**
 * Renders price data as inline JSX spans for card views.
 * @param {object} priceData - Price data from calculateModelPrice
 * @param {Function} t - i18n translation function
 * @param {string} [quotaDisplayType='USD'] - Display type
 * @returns {JSX.Element}
 */
export const formatPriceInfo = (priceData, t, quotaDisplayType = 'USD') => {
  const items = getModelPriceItems(priceData, t, quotaDisplayType);
  return (
    <>
      {items.map((item) => (
        <span key={item.key} style={{ color: 'var(--semi-color-text-1)' }}>
          {item.label} {item.value}
          {item.suffix}
        </span>
      ))}
    </>
  );
};

// -------------------------------
/**
 * Creates a pagination area element for CardPro components with page navigation and page size input.
 * @param {object} params
 * @param {number} params.currentPage - Current page number
 * @param {number} params.pageSize - Items per page
 * @param {number} params.total - Total item count
 * @param {Function} params.onPageChange - Page change callback
 * @param {Function} params.onPageSizeChange - Page size change callback
 * @param {boolean} [params.isMobile=false] - Whether in mobile viewport
 * @param {Function} [params.t] - i18n translation function
 * @returns {JSX.Element|null}
 */
export const createCardProPagination = ({
  currentPage,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  isMobile = false,
  t = (key) => key,
}) => {
  if (!total || total <= 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  const totalText = `${t('显示第')} ${start} ${t('条 - 第')} ${end} ${t('条，共')} ${total} ${t('条')}`;

  return (
    <>
      {/* 桌面端左侧总数信息 */}
      {!isMobile && (
        <span
          className='text-sm select-none'
          style={{ color: 'var(--semi-color-text-2)' }}
        >
          {totalText}
        </span>
      )}

      {/* 右侧分页控件 */}
      <div className='flex items-center gap-2'>
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          total={total}
          showSizeChanger={false}
          onPageChange={onPageChange}
          size={isMobile ? 'small' : 'default'}
          showQuickJumper={isMobile}
          showTotal
        />
        <span
          className='text-sm select-none'
          style={{ color: 'var(--semi-color-text-2)', whiteSpace: 'nowrap' }}
        >
          {t('每页条数')}
        </span>
        <InputNumber
          size='small'
          min={1}
          value={pageSize}
          onChange={(val) => {
            if (val && val >= 1) {
              onPageSizeChange(Math.floor(val));
            }
          }}
          style={{ width: 80 }}
        />
      </div>
    </>
  );
};

// 模型定价筛选条件默认值
const DEFAULT_PRICING_FILTERS = {
  search: '',
  showWithRecharge: false,
  currency: 'USD',
  showRatio: false,
  viewMode: 'card',
  tokenUnit: 'M',
  filterGroup: 'all',
  filterQuotaType: 'all',
  filterEndpointType: 'all',
  filterVendor: 'all',
  filterTag: 'all',
  currentPage: 1,
};

/**
 * Resets all model pricing filter states to their default values.
 * @param {object} params - Object containing setter functions for each filter
 */
export const resetPricingFilters = ({
  handleChange,
  setShowWithRecharge,
  setCurrency,
  setShowRatio,
  setViewMode,
  setFilterGroup,
  setFilterQuotaType,
  setFilterEndpointType,
  setFilterVendor,
  setFilterTag,
  setCurrentPage,
  setTokenUnit,
}) => {
  handleChange?.(DEFAULT_PRICING_FILTERS.search);
  setShowWithRecharge?.(DEFAULT_PRICING_FILTERS.showWithRecharge);
  setCurrency?.(DEFAULT_PRICING_FILTERS.currency);
  setShowRatio?.(DEFAULT_PRICING_FILTERS.showRatio);
  setViewMode?.(DEFAULT_PRICING_FILTERS.viewMode);
  setTokenUnit?.(DEFAULT_PRICING_FILTERS.tokenUnit);
  setFilterGroup?.(DEFAULT_PRICING_FILTERS.filterGroup);
  setFilterQuotaType?.(DEFAULT_PRICING_FILTERS.filterQuotaType);
  setFilterEndpointType?.(DEFAULT_PRICING_FILTERS.filterEndpointType);
  setFilterVendor?.(DEFAULT_PRICING_FILTERS.filterVendor);
  setFilterTag?.(DEFAULT_PRICING_FILTERS.filterTag);
  setCurrentPage?.(DEFAULT_PRICING_FILTERS.currentPage);
};
