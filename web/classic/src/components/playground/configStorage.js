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

import {
  STORAGE_KEYS,
  DEFAULT_CONFIG,
} from '../../constants/playground.constants';

const PLAYGROUND_DB_NAME = 'new-api-playground';
const PLAYGROUND_DB_VERSION = 2;
const PLAYGROUND_META_STORE = 'meta';
const PLAYGROUND_IMAGE_CACHE_STORE = 'image-cache';
const PLAYGROUND_CONVERSATION_STATE_KEY = 'conversation-state';
const MAX_STORAGE_TEXT_LENGTH = 4000;
const MAX_STORAGE_REASONING_LENGTH = 2000;
const DATA_URL_PLACEHOLDER = '[local image omitted from localStorage]';
const LONG_TEXT_PLACEHOLDER = '...[truncated]';
const DEFAULT_CONVERSATION_TYPE = 'chat';

export const normalizePlaygroundConversationType = (type) =>
  ['chat', 'image', 'video'].includes(type) ? type : DEFAULT_CONVERSATION_TYPE;

const getPlaygroundConversationStateKey = (userIdentity = null) => {
  const userId = userIdentity?.id ?? 'anonymous';
  const username = userIdentity?.username ?? 'anonymous';
  return `${PLAYGROUND_CONVERSATION_STATE_KEY}:user-${userId}:username-${username}`;
};

const buildConversationTitle = (messages = []) => {
  const firstUserMessage = messages.find((message) => message?.role === 'user');
  const content = firstUserMessage?.content;
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .map((item) => item?.text || '')
            .join(' ')
            .trim()
        : '';
  return text ? text.slice(0, 30) : '';
};

const isQuotaExceededError = (error) => {
  if (!error) {
    return false;
  }

  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
};

const trimTextForStorage = (value, maxLength = MAX_STORAGE_TEXT_LENGTH) => {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.startsWith('data:image/')) {
    return DATA_URL_PLACEHOLDER;
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}${LONG_TEXT_PLACEHOLDER}`;
};

const sanitizeMessageContentForStorage = (content) => {
  if (typeof content === 'string') {
    return trimTextForStorage(content);
  }

  if (Array.isArray(content)) {
    return content.map((item) => {
      if (!item || typeof item !== 'object') {
        return item;
      }

      if (item.type === 'image_url') {
        const url = item.image_url?.url;
        return {
          ...item,
          image_url: {
            ...item.image_url,
            url: trimTextForStorage(url),
          },
        };
      }

      if (item.type === 'file') {
        return {
          ...item,
          file: {
            filename: item.file?.filename || item.file?.file_name || '',
            file_id: item.file?.file_id || undefined,
          },
        };
      }

      return {
        ...item,
        text: trimTextForStorage(item.text),
      };
    });
  }

  return content;
};

const sanitizeMessageForStorage = (message) => {
  if (!message || typeof message !== 'object') {
    return message;
  }

  const { apiContent, ...messageToStore } = message;
  const sanitized = {
    ...messageToStore,
    content: sanitizeMessageContentForStorage(messageToStore.content),
  };

  if (typeof sanitized.reasoningContent === 'string') {
    sanitized.reasoningContent = trimTextForStorage(
      sanitized.reasoningContent,
      MAX_STORAGE_REASONING_LENGTH,
    );
  }

  if (Array.isArray(sanitized.imageUrls)) {
    sanitized.imageUrls = sanitized.imageUrls.map((url) =>
      trimTextForStorage(url),
    );
  }

  return sanitized;
};

export const sanitizeMessagesForStorage = (messages) =>
  Array.isArray(messages) ? messages.map(sanitizeMessageForStorage) : [];

const sanitizeConversationsForStorage = (conversations) =>
  Array.isArray(conversations)
    ? conversations.map((conversation) => ({
        ...conversation,
        messages: sanitizeMessagesForStorage(conversation?.messages),
      }))
    : [];

const hasPlaceholderValue = (value) => {
  if (typeof value === 'string') {
    return value.includes(DATA_URL_PLACEHOLDER);
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasPlaceholderValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.values(value).some((item) => hasPlaceholderValue(item));
  }

  return false;
};

const hasPlaceholderInMessages = (messages) =>
  Array.isArray(messages) &&
  messages.some((message) => hasPlaceholderValue(message));

const hasPlaceholderInConversations = (conversations) =>
  Array.isArray(conversations) &&
  conversations.some((conversation) =>
    hasPlaceholderInMessages(conversation?.messages),
  );

const buildMessageStorageFallback = () => ({
  messages: [],
  timestamp: new Date().toISOString(),
  overflow: true,
});

const buildConversationStorageFallback = (conversations = []) => ({
  conversations: Array.isArray(conversations)
    ? conversations.map((conversation) => ({
        id: conversation?.id || `pg-${Date.now()}`,
        type: normalizePlaygroundConversationType(conversation?.type),
        title: conversation?.title || '',
        messages: [],
        createdAt: conversation?.createdAt || Date.now(),
        updatedAt: conversation?.updatedAt || Date.now(),
      }))
    : [],
  timestamp: new Date().toISOString(),
  overflow: true,
});

const setStorageItemSafely = (key, value, fallbackValue, errorLabel) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      console.error(errorLabel, error);
      return false;
    }
  }

  try {
    localStorage.setItem(key, JSON.stringify(fallbackValue));
    console.warn(`${errorLabel}，已自动降级为轻量存储`);
    return true;
  } catch (fallbackError) {
    console.error(errorLabel, fallbackError);
    return false;
  }
};

/**
 * 保存配置到 localStorage
 * @param {Object} config - 要保存的配置对象
 */
export const saveConfig = (config) => {
  try {
    const configToSave = {
      ...config,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(configToSave));
  } catch (error) {
    console.error('保存配置失败:', error);
  }
};

/**
 * 保存消息到 localStorage
 * @param {Array} messages - 要保存的消息数组
 */
export const saveMessages = (messages) => {
  const messagesToSave = {
    messages: sanitizeMessagesForStorage(messages),
    timestamp: new Date().toISOString(),
  };
  const fallbackMessagesToSave = buildMessageStorageFallback();

  setStorageItemSafely(
    STORAGE_KEYS.MESSAGES,
    messagesToSave,
    fallbackMessagesToSave,
    '保存消息失败',
  );
};

/**
 * 从 localStorage 加载配置
 * @returns {Object} 配置对象，如果不存在则返回默认配置
 */
export const loadConfig = () => {
  try {
    const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (savedConfig) {
      const parsedConfig = JSON.parse(savedConfig);
      const parsedMaxTokens = parseInt(parsedConfig?.inputs?.max_tokens, 10);

      const mergedConfig = {
        inputs: {
          ...DEFAULT_CONFIG.inputs,
          ...parsedConfig.inputs,
          max_tokens: Number.isNaN(parsedMaxTokens)
            ? parsedConfig?.inputs?.max_tokens
            : parsedMaxTokens,
        },
        parameterEnabled: {
          ...DEFAULT_CONFIG.parameterEnabled,
          ...parsedConfig.parameterEnabled,
        },
        showDebugPanel:
          parsedConfig.showDebugPanel || DEFAULT_CONFIG.showDebugPanel,
        customRequestMode:
          parsedConfig.customRequestMode || DEFAULT_CONFIG.customRequestMode,
        customRequestBody:
          parsedConfig.customRequestBody || DEFAULT_CONFIG.customRequestBody,
        playgroundMode:
          parsedConfig.playgroundMode || DEFAULT_CONFIG.playgroundMode,
      };

      return mergedConfig;
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }

  return DEFAULT_CONFIG;
};

/**
 * 从 localStorage 加载消息
 * @returns {Array} 消息数组，如果不存在则返回 null
 */
export const loadMessages = () => {
  try {
    const savedMessages = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    if (savedMessages) {
      const parsedMessages = JSON.parse(savedMessages);
      if (parsedMessages?.overflow) {
        return null;
      }
      if (hasPlaceholderInMessages(parsedMessages.messages)) {
        localStorage.removeItem(STORAGE_KEYS.MESSAGES);
        return null;
      }
      return parsedMessages.messages || null;
    }
  } catch (error) {
    console.error('加载消息失败:', error);
  }

  return null;
};

export const createStoredConversation = (
  messages = [],
  id = null,
  type = DEFAULT_CONVERSATION_TYPE,
) => {
  const now = Date.now();
  return {
    id: id || `pg-${now}`,
    type: normalizePlaygroundConversationType(type),
    title: buildConversationTitle(messages),
    messages,
    createdAt: now,
    updatedAt: now,
  };
};

const normalizeConversationState = (state) => {
  const conversations = Array.isArray(state?.conversations)
    ? state.conversations.map((conversation) => ({
        ...conversation,
        type: normalizePlaygroundConversationType(conversation?.type),
      }))
    : [];
  const activeConversationId =
    state?.activeConversationId || conversations[0]?.id || null;

  return {
    conversations,
    activeConversationId,
  };
};

const openPlaygroundDB = () =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    const request = window.indexedDB.open(
      PLAYGROUND_DB_NAME,
      PLAYGROUND_DB_VERSION,
    );

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PLAYGROUND_META_STORE)) {
        db.createObjectStore(PLAYGROUND_META_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(PLAYGROUND_IMAGE_CACHE_STORE)) {
        db.createObjectStore(PLAYGROUND_IMAGE_CACHE_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const runMetaTransaction = async (mode, executor) => {
  const db = await openPlaygroundDB();
  if (!db) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PLAYGROUND_META_STORE, mode);
    const store = transaction.objectStore(PLAYGROUND_META_STORE);

    transaction.oncomplete = () => {
      db.close();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };

    executor(store, resolve, reject);
  });
};

const runImageCacheTransaction = async (mode, executor) => {
  const db = await openPlaygroundDB();
  if (!db) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PLAYGROUND_IMAGE_CACHE_STORE, mode);
    const store = transaction.objectStore(PLAYGROUND_IMAGE_CACHE_STORE);

    transaction.oncomplete = () => {
      db.close();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };

    executor(store, resolve, reject);
  });
};

export const loadCachedImageDataUrl = async (url) => {
  if (typeof url !== 'string' || url.trim() === '') {
    return null;
  }

  try {
    return await runImageCacheTransaction('readonly', (store, resolve) => {
      const request = store.get(url);
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => resolve(null);
    });
  } catch (error) {
    console.error('从 IndexedDB 加载图片缓存失败:', error);
    return null;
  }
};

export const saveCachedImageDataUrl = async (url, dataUrl) => {
  if (
    typeof url !== 'string' ||
    url.trim() === '' ||
    typeof dataUrl !== 'string' ||
    !dataUrl.startsWith('data:image/')
  ) {
    return;
  }

  try {
    await runImageCacheTransaction('readwrite', (store, resolve, reject) => {
      const request = store.put({
        key: url,
        value: dataUrl,
        timestamp: new Date().toISOString(),
      });
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('保存 IndexedDB 图片缓存失败:', error);
  }
};

export const loadConversationStateFromIndexedDB = async (
  userIdentity = null,
) => {
  try {
    const payload = await runMetaTransaction('readonly', (store, resolve) => {
      const request = store.get(
        getPlaygroundConversationStateKey(userIdentity),
      );
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => resolve(null);
    });

    if (!payload) {
      return null;
    }

    if (hasPlaceholderInConversations(payload.conversations)) {
      clearConversationStateFromIndexedDB(userIdentity).catch((error) => {
        console.error('清理被占位符污染的 IndexedDB 会话失败:', error);
      });
      return null;
    }

    return normalizeConversationState(payload);
  } catch (error) {
    console.error('从 IndexedDB 加载会话失败:', error);
    return null;
  }
};

export const saveConversationStateToIndexedDB = async (
  conversations = [],
  activeConversationId = null,
  userIdentity = null,
) => {
  const sanitizedConversations = sanitizeConversationsForStorage(conversations);

  try {
    await runMetaTransaction('readwrite', (store, resolve, reject) => {
      const request = store.put({
        key: getPlaygroundConversationStateKey(userIdentity),
        value: {
          conversations: sanitizedConversations,
          activeConversationId,
          timestamp: new Date().toISOString(),
        },
      });
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('保存 IndexedDB 会话失败:', error);
  }
};

export const clearConversationStateFromIndexedDB = async (
  userIdentity = null,
) => {
  try {
    await runMetaTransaction('readwrite', (store, resolve, reject) => {
      const request = store.delete(
        getPlaygroundConversationStateKey(userIdentity),
      );
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('清理 IndexedDB 会话失败:', error);
  }
};

export const migrateConversationStateToIndexedDB = async (
  userIdentity = null,
) => {
  const indexedState = await loadConversationStateFromIndexedDB(userIdentity);
  if (indexedState?.conversations?.length) {
    return indexedState;
  }

  const localState = loadConversationState();
  if (localState?.conversations?.length) {
    await saveConversationStateToIndexedDB(
      localState.conversations,
      localState.activeConversationId,
      userIdentity,
    );
    return localState;
  }

  return null;
};

export const saveConversationState = (
  conversations = [],
  activeConversationId = null,
) => {
  const sanitizedConversations = sanitizeConversationsForStorage(conversations);
  const payload = {
    conversations: sanitizedConversations,
    timestamp: new Date().toISOString(),
  };
  const fallbackPayload = buildConversationStorageFallback(
    sanitizedConversations,
  );

  const saved = setStorageItemSafely(
    STORAGE_KEYS.CONVERSATIONS,
    payload,
    fallbackPayload,
    '保存会话失败',
  );

  if (!saved) {
    return;
  }

  try {
    if (activeConversationId) {
      localStorage.setItem(
        STORAGE_KEYS.ACTIVE_CONVERSATION,
        activeConversationId,
      );
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONVERSATION);
    }
  } catch (error) {
    console.error('保存当前会话失败:', error);
  }
};

export const loadConversationState = () => {
  try {
    const savedConversations = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    const activeConversationId = localStorage.getItem(
      STORAGE_KEYS.ACTIVE_CONVERSATION,
    );

    if (savedConversations) {
      const parsed = JSON.parse(savedConversations);
      if (parsed?.overflow) {
        localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS);
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONVERSATION);
      } else {
        const conversations = Array.isArray(parsed?.conversations)
          ? parsed.conversations
          : [];

        if (hasPlaceholderInConversations(conversations)) {
          localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS);
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONVERSATION);
        } else if (conversations.length > 0) {
          return {
            conversations,
            activeConversationId:
              activeConversationId || conversations[0]?.id || null,
          };
        }
      }
    }

    const messages = loadMessages();
    const fallbackConversation = createStoredConversation(messages || []);
    return {
      conversations: [fallbackConversation],
      activeConversationId: fallbackConversation.id,
    };
  } catch (error) {
    console.error('加载会话失败:', error);
  }

  const fallbackConversation = createStoredConversation([]);
  return {
    conversations: [fallbackConversation],
    activeConversationId: fallbackConversation.id,
  };
};

/**
 * 清除保存的配置
 */
export const clearConfig = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CONFIG);
    localStorage.removeItem(STORAGE_KEYS.MESSAGES); // 同时清除消息
  } catch (error) {
    console.error('清除配置失败:', error);
  }
};

/**
 * 清除保存的消息
 */
export const clearMessages = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
  } catch (error) {
    console.error('清除消息失败:', error);
  }
};

/**
 * 检查是否有保存的配置
 * @returns {boolean} 是否存在保存的配置
 */
export const hasStoredConfig = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.CONFIG) !== null;
  } catch (error) {
    console.error('检查配置失败:', error);
    return false;
  }
};

/**
 * 获取配置的最后保存时间
 * @returns {string|null} 最后保存时间的 ISO 字符串
 */
export const getConfigTimestamp = () => {
  try {
    const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (savedConfig) {
      const parsedConfig = JSON.parse(savedConfig);
      return parsedConfig.timestamp || null;
    }
  } catch (error) {
    console.error('获取配置时间戳失败:', error);
  }
  return null;
};

/**
 * 导出配置为 JSON 文件（包含消息）
 * @param {Object} config - 要导出的配置
 * @param {Array} messages - 要导出的消息
 */
export const exportConfig = (config, messages = null) => {
  try {
    const configToExport = {
      ...config,
      messages: messages || loadMessages(), // 包含消息数据
      exportTime: new Date().toISOString(),
      version: '1.0',
    };

    const dataStr = JSON.stringify(configToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `playground-config-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error('导出配置失败:', error);
  }
};

/**
 * 从文件导入配置（包含消息）
 * @param {File} file - 包含配置的 JSON 文件
 * @returns {Promise<Object>} 导入的配置对象
 */
export const importConfig = (file) => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedConfig = JSON.parse(e.target.result);

          if (importedConfig.inputs && importedConfig.parameterEnabled) {
            // 如果导入的配置包含消息，也一起导入
            if (
              importedConfig.messages &&
              Array.isArray(importedConfig.messages)
            ) {
              saveMessages(importedConfig.messages);
            }

            resolve(importedConfig);
          } else {
            reject(new Error('配置文件格式无效'));
          }
        } catch (parseError) {
          reject(new Error('解析配置文件失败: ' + parseError.message));
        }
      };
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsText(file);
    } catch (error) {
      reject(new Error('导入配置失败: ' + error.message));
    }
  });
};
