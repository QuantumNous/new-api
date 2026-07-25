// web/classic/src/helpers/utils.jsx 的移动端替身。
// 原文件引入 Semi/react-toastify/render.js 等桌面依赖，无法直接复用；
// 此处用 antd-mobile Toast 实现提示函数，并"逐字拷贝"复用链路所需的纯函数。
// 拷贝部分注明来源，classic 侧对应函数变更时需同步（构建期 grep 校验见 M2）。
import { Toast as AmToast } from 'antd-mobile';

import {
  MESSAGE_ROLES,
  THINK_TAG_REGEX,
} from '@classic/constants/playground.constants';

const toastShow = (icon, content, durationMs = 3000) => {
  AmToast.show({ icon, content: String(content), duration: durationMs });
};

export function showError(error) {
  console.error(error);
  if (error && error.message) {
    if (error.name === 'AxiosError' && error.response) {
      switch (error.response.status) {
        case 401:
          localStorage.removeItem('user');
          window.location.href = '/m/login?expired=true';
          break;
        case 429:
          toastShow('fail', '错误：请求次数过多，请稍后再试！');
          break;
        case 500:
          toastShow('fail', '错误：服务器内部错误，请联系管理员！');
          break;
        case 405:
          toastShow(undefined, '本站仅作演示之用，无服务端！');
          break;
        default:
          toastShow('fail', '错误：' + error.message);
      }
      return;
    }
    toastShow('fail', '错误：' + error.message);
  } else {
    toastShow('fail', '错误：' + error);
  }
}

export function showWarning(message) {
  toastShow('fail', message);
}

export function showSuccess(message) {
  toastShow('success', message, 2000);
}

export function showInfo(message) {
  toastShow(undefined, message);
}

export function showNotice(message) {
  toastShow(undefined, message, 4000);
}

// ---- 以下均拷贝自 web/classic/src/helpers/utils.jsx，保持行为一致 ----

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

export function containsCJK(str) {
  return /[一-鿿㐀-䶿]/.test(str || '');
}

export async function copy(text) {
  let okay = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    try {
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
    } catch (e2) {
      okay = false;
      console.error(e2);
    }
  }
  return okay;
}

let messageId = 4;
export const generateMessageId = () => `${messageId++}`;

export const getTextContent = (message) => {
  if (!message || !message.content) return '';

  if (Array.isArray(message.content)) {
    const textContent = message.content.find((item) => item.type === 'text');
    return textContent?.text || '';
  }
  return typeof message.content === 'string' ? message.content : '';
};

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

export const createMessage = (role, content, options = {}) => ({
  role,
  content,
  createAt: Date.now(),
  id: generateMessageId(),
  ...options,
});

export const createLoadingAssistantMessage = () =>
  createMessage(MESSAGE_ROLES.ASSISTANT, '', {
    reasoningContent: '',
    isReasoningExpanded: true,
    isThinkingComplete: false,
    hasAutoCollapsed: false,
    status: 'loading',
  });

export const formatMessageForAPI = (message) => {
  if (!message) return null;

  return {
    role: message.role,
    content: message.content,
  };
};

export const isValidMessage = (message) => {
  return message && message.role && (message.content || message.content === '');
};
