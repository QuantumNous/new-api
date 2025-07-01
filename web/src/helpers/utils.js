import { Toast } from '@douyinfe/semi-ui';
import { toastConstants } from '../constants';
import React from 'react';
import { toast } from 'react-toastify';
import { THINK_TAG_REGEX, MESSAGE_ROLES } from '../constants/playground.constants';
import { TABLE_COMPACT_MODES_KEY } from '../constants';

const HTMLToastContent = ({ htmlContent }) => {
  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};
export default HTMLToastContent;
export function isAdmin() {
  let user = localStorage.getItem('user');
  if (!user) return false;
  user = JSON.parse(user);
  return user.role >= 10;
}

export function isRoot() {
  let user = localStorage.getItem('user');
  if (!user) return false;
  user = JSON.parse(user);
  return user.role >= 100;
}

export function getSystemName() {
  let system_name = localStorage.getItem('system_name');
  if (!system_name) return 'New API';
  return system_name;
}

export function getLogo() {
  let logo = localStorage.getItem('logo');
  if (!logo) return '/logo.png';
  return logo;
}

export function getUserIdFromLocalStorage() {
  let user = localStorage.getItem('user');
  if (!user) return -1;
  user = JSON.parse(user);
  return user.id;
}

export function getFooterHTML() {
  return localStorage.getItem('footer_html');
}

export async function copy(text) {
  let okay = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    try {
      // 构建input 执行 复制命令
      var _input = window.document.createElement('input');
      _input.value = text;
      window.document.body.appendChild(_input);
      _input.select();
      window.document.execCommand('Copy');
      window.document.body.removeChild(_input);
    } catch (e) {
      okay = false;
      console.error(e);
    }
  }
  return okay;
}

export function isMobile() {
  return window.innerWidth <= 600;
}

let showErrorOptions = { autoClose: toastConstants.ERROR_TIMEOUT };
let showWarningOptions = { autoClose: toastConstants.WARNING_TIMEOUT };
let showSuccessOptions = { autoClose: toastConstants.SUCCESS_TIMEOUT };
let showInfoOptions = { autoClose: toastConstants.INFO_TIMEOUT };
let showNoticeOptions = { autoClose: false };

if (isMobile()) {
  showErrorOptions.position = 'top-center';
  // showErrorOptions.transition = 'flip';

  showSuccessOptions.position = 'top-center';
  // showSuccessOptions.transition = 'flip';

  showInfoOptions.position = 'top-center';
  // showInfoOptions.transition = 'flip';

  showNoticeOptions.position = 'top-center';
  // showNoticeOptions.transition = 'flip';
}

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

export function showWarning(message) {
  Toast.warning(message);
}

export function showSuccess(message) {
  Toast.success(message);
}

export function showInfo(message) {
  Toast.info(message);
}

export function showNotice(message, isHTML = false) {
  if (isHTML) {
    toast(<HTMLToastContent htmlContent={message} />, showNoticeOptions);
  } else {
    Toast.info(message);
  }
}

export function openPage(url) {
  window.open(url);
}

export function removeTrailingSlash(url) {
  if (!url) return '';
  if (url.endsWith('/')) {
    return url.slice(0, -1);
  } else {
    return url;
  }
}

export function getTodayStartTimestamp() {
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor(now.getTime() / 1000);
}

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

export function timestamp2string1(timestamp, dataExportDefaultTime = 'hour') {
  let date = new Date(timestamp * 1000);
  // let year = date.getFullYear().toString();
  let month = (date.getMonth() + 1).toString();
  let day = date.getDate().toString();
  let hour = date.getHours().toString();
  if (day === '24') {
    console.log('timestamp', timestamp);
  }
  if (month.length === 1) {
    month = '0' + month;
  }
  if (day.length === 1) {
    day = '0' + day;
  }
  if (hour.length === 1) {
    hour = '0' + hour;
  }
  let str = month + '-' + day;
  if (dataExportDefaultTime === 'hour') {
    str += ' ' + hour + ':00';
  } else if (dataExportDefaultTime === 'week') {
    let nextWeek = new Date(timestamp * 1000 + 6 * 24 * 60 * 60 * 1000);
    let nextMonth = (nextWeek.getMonth() + 1).toString();
    let nextDay = nextWeek.getDate().toString();
    if (nextMonth.length === 1) {
      nextMonth = '0' + nextMonth;
    }
    if (nextDay.length === 1) {
      nextDay = '0' + nextDay;
    }
    str += ' - ' + nextMonth + '-' + nextDay;
  }
  return str;
}

export function downloadTextAsFile(text, filename) {
  let blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

export const verifyJSON = (str) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

export function verifyJSONPromise(value) {
  try {
    JSON.parse(value);
    return Promise.resolve();
  } catch (e) {
    return Promise.reject('不是合法的 JSON 字符串');
  }
}

export function shouldShowPrompt(id) {
  let prompt = localStorage.getItem(`prompt-${id}`);
  return !prompt;
}

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

// 生成唯一ID
let messageId = 4;
export const generateMessageId = () => `${messageId++}`;

// 提取消息中的文本内容
export const getTextContent = (message) => {
  if (!message || !message.content) return '';

  if (Array.isArray(message.content)) {
    const textContent = message.content.find(item => item.type === 'text');
    return textContent?.text || '';
  }
  return typeof message.content === 'string' ? message.content : '';
};

// 处理 think 标签
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

  const processedContent = replyParts.join('').replace(/<\/?think>/g, '').trim();
  const thoughtsStr = thoughts.join('\n\n---\n\n');
  const processedReasoningContent = reasoningContent && thoughtsStr
    ? `${reasoningContent}\n\n---\n\n${thoughtsStr}`
    : reasoningContent || thoughtsStr;

  return {
    content: processedContent,
    reasoningContent: processedReasoningContent
  };
};

// 处理未完成的 think 标签
export const processIncompleteThinkTags = (content, reasoningContent = '') => {
  if (!content) return { content: '', reasoningContent };

  const lastOpenThinkIndex = content.lastIndexOf('<think>');
  if (lastOpenThinkIndex === -1) {
    return processThinkTags(content, reasoningContent);
  }

  const fragmentAfterLastOpen = content.substring(lastOpenThinkIndex);
  if (!fragmentAfterLastOpen.includes('</think>')) {
    const unclosedThought = fragmentAfterLastOpen.substring('<think>'.length).trim();
    const cleanContent = content.substring(0, lastOpenThinkIndex);
    const processedReasoningContent = unclosedThought
      ? reasoningContent ? `${reasoningContent}\n\n---\n\n${unclosedThought}` : unclosedThought
      : reasoningContent;

    return processThinkTags(cleanContent, processedReasoningContent);
  }

  return processThinkTags(content, reasoningContent);
};

// 构建消息内容（包含图片）
export const buildMessageContent = (textContent, imageUrls = [], imageEnabled = false) => {
  if (!textContent && (!imageUrls || imageUrls.length === 0)) {
    return '';
  }

  const validImageUrls = imageUrls.filter(url => url && url.trim() !== '');

  if (imageEnabled && validImageUrls.length > 0) {
    return [
      { type: 'text', text: textContent || '' },
      ...validImageUrls.map(url => ({
        type: 'image_url',
        image_url: { url: url.trim() }
      }))
    ];
  }

  return textContent || '';
};

// 创建新消息
export const createMessage = (role, content, options = {}) => ({
  role,
  content,
  createAt: Date.now(),
  id: generateMessageId(),
  ...options
});

// 创建加载中的助手消息
export const createLoadingAssistantMessage = () => createMessage(
  MESSAGE_ROLES.ASSISTANT,
  '',
  {
    reasoningContent: '',
    isReasoningExpanded: true,
    isThinkingComplete: false,
    hasAutoCollapsed: false,
    status: 'loading'
  }
);

// 检查消息是否包含图片
export const hasImageContent = (message) => {
  return message &&
    Array.isArray(message.content) &&
    message.content.some(item => item.type === 'image_url');
};

// 格式化消息用于API请求
export const formatMessageForAPI = (message) => {
  if (!message) return null;

  return {
    role: message.role,
    content: message.content
  };
};

// 验证消息是否有效
export const isValidMessage = (message) => {
  return message &&
    message.role &&
    (message.content || message.content === '');
};

// 获取最后一条用户消息
export const getLastUserMessage = (messages) => {
  if (!Array.isArray(messages)) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === MESSAGE_ROLES.USER) {
      return messages[i];
    }
  }
  return null;
};

// 获取最后一条助手消息
export const getLastAssistantMessage = (messages) => {
  if (!Array.isArray(messages)) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === MESSAGE_ROLES.ASSISTANT) {
      return messages[i];
    }
  }
  return null;
};

// 计算相对时间（几天前、几小时前等）
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

// 格式化日期字符串
export const formatDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 格式化日期时间字符串（包含时间）
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

export function getTableCompactMode(tableKey = 'global') {
  const modes = readTableCompactModes();
  return !!modes[tableKey];
}

export function setTableCompactMode(compact, tableKey = 'global') {
  const modes = readTableCompactModes();
  modes[tableKey] = compact;
  writeTableCompactModes(modes);
}
