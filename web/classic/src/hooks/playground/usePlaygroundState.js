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

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getDefaultMessages,
  DEFAULT_CONFIG,
  API_ENDPOINTS,
  DEBUG_TABS,
  MESSAGE_ROLES,
  MESSAGE_STATUS,
  PLAYGROUND_I18N_KEYS,
} from '../../constants/playground.constants';
import { API } from '../../helpers/api';
import { generateMessageId } from '../../helpers';
import {
  loadConfig,
  saveConfig,
  createStoredConversation,
  normalizePlaygroundConversationType,
  loadConversationStateFromIndexedDB,
  saveConversationStateToIndexedDB,
  migrateConversationStateToIndexedDB,
  sanitizeMessagesForStorage,
} from '../../components/playground/configStorage';
import { processIncompleteThinkTags } from '../../helpers';

export const usePlaygroundState = (userIdentity = null) => {
  const { t } = useTranslation();
  const userId = userIdentity?.id ?? null;
  const username = userIdentity?.username ?? 'anonymous';
  const normalizedUserIdentity = useMemo(
    () =>
      userId || username
        ? {
            id: userId,
            username,
          }
        : null,
    [userId, username],
  );

  const normalizeConversationTitle = useCallback(
    (conversation) => {
      const title =
        typeof conversation?.title === 'string' ? conversation.title : '';
      const legacyEmptyTitles = new Set([
        PLAYGROUND_I18N_KEYS.NEW_CONVERSATION,
        'New conversation',
        'Nouvelle conversation',
        '新しい会話',
        'Новый диалог',
        'Cuộc trò chuyện mới',
        '新對話',
        t(PLAYGROUND_I18N_KEYS.NEW_CONVERSATION),
      ]);
      const isLegacyEmptyTitle = legacyEmptyTitles.has(title.trim());

      if (
        isLegacyEmptyTitle &&
        (!Array.isArray(conversation?.messages) ||
          conversation.messages.length === 0)
      ) {
        return '';
      }

      return title;
    },
    [t],
  );

  // 使用惰性初始化，确保只在组件首次挂载时加载配置和消息
  const [savedConfig] = useState(() => loadConfig());
  const [initialPlaygroundMode] = useState(() =>
    normalizePlaygroundConversationType(
      savedConfig.playgroundMode || DEFAULT_CONFIG.playgroundMode,
    ),
  );
  const [initialConversation] = useState(() =>
    createStoredConversation([], null, initialPlaygroundMode),
  );

  // 基础配置状态
  const [inputs, setInputs] = useState(
    savedConfig.inputs || DEFAULT_CONFIG.inputs,
  );
  const [parameterEnabled, setParameterEnabled] = useState(
    savedConfig.parameterEnabled || DEFAULT_CONFIG.parameterEnabled,
  );
  const [showDebugPanel, setShowDebugPanel] = useState(
    savedConfig.showDebugPanel || DEFAULT_CONFIG.showDebugPanel,
  );
  const [customRequestMode, setCustomRequestMode] = useState(
    savedConfig.customRequestMode || DEFAULT_CONFIG.customRequestMode,
  );
  const [customRequestBody, setCustomRequestBody] = useState(
    savedConfig.customRequestBody || DEFAULT_CONFIG.customRequestBody,
  );
  const [playgroundMode, setPlaygroundMode] = useState(initialPlaygroundMode);

  // UI状态
  const [showSettings, setShowSettings] = useState(false);
  const [models, setModels] = useState([]);
  const [imageModels, setImageModels] = useState([]);
  const [videoModels, setVideoModels] = useState([]);
  const [groups, setGroups] = useState([]);
  const [status, setStatus] = useState({});
  const [conversationStorageReady, setConversationStorageReady] =
    useState(false);
  const [conversations, setConversations] = useState([initialConversation]);
  const [activeConversationId, setActiveConversationId] = useState(
    initialConversation.id,
  );

  // 消息相关状态 - 使用加载的消息或默认消息初始化
  const [message, setMessage] = useState(() => getDefaultMessages(t));

  // 当语言改变时，如果是默认消息则更新
  useEffect(() => {
    // 只在当前没有真实会话消息时才更新默认消息
    setMessage((prevMessages) =>
      !Array.isArray(prevMessages) || prevMessages.length === 0
        ? getDefaultMessages(t)
        : prevMessages,
    );
  }, [t]); // 当语言改变时

  // 调试状态
  const [debugData, setDebugData] = useState({
    request: null,
    response: null,
    timestamp: null,
    previewRequest: null,
    previewTimestamp: null,
  });
  const [activeDebugTab, setActiveDebugTab] = useState(DEBUG_TABS.PREVIEW);
  const [previewPayload, setPreviewPayload] = useState(null);

  // 编辑状态
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Refs
  const sseSourceRef = useRef(null);
  const chatRef = useRef(null);
  const saveConfigTimeoutRef = useRef(null);
  const saveRemoteConversationTimeoutRef = useRef(null);
  const deletedConversationIdsRef = useRef(new Set());
  const currentConversationIdRef = useRef(initialConversation.id);
  const localConversationStateRef = useRef({
    conversations: [initialConversation],
    activeConversationId: initialConversation.id,
  });
  const playgroundModeRef = useRef(playgroundMode);

  useEffect(() => {
    playgroundModeRef.current =
      normalizePlaygroundConversationType(playgroundMode);
  }, [playgroundMode]);

  const persistConversationState = useCallback(
    (nextConversations = [], nextActiveConversationId = null) => {
      const payload = {
        conversations: nextConversations,
        activeConversationId: nextActiveConversationId,
      };

      localConversationStateRef.current = payload;
      saveConversationStateToIndexedDB(
        nextConversations,
        nextActiveConversationId,
        normalizedUserIdentity,
      ).catch((error) => {
        console.error('保存 IndexedDB 会话状态失败:', error);
      });
    },
    [normalizedUserIdentity],
  );

  const isConversationEmpty = useCallback((conversation) => {
    return (
      !Array.isArray(conversation?.messages) ||
      conversation.messages.length === 0
    );
  }, []);

  const getConversationSignature = useCallback(
    (conversation) => {
      if (!conversation) {
        return '';
      }
      const normalizedTitle = normalizeConversationTitle(conversation);
      const normalizedType = normalizePlaygroundConversationType(
        conversation.type,
      );
      if (isConversationEmpty(conversation)) {
        return `empty:${normalizedType}:${normalizedTitle}`;
      }
      return JSON.stringify({
        type: normalizedType,
        title: normalizedTitle,
        messages: conversation.messages,
      });
    },
    [isConversationEmpty, normalizeConversationTitle],
  );

  const dedupeConversations = useCallback(
    (conversationList) => {
      const seenSignatures = new Set();
      const duplicates = [];
      const uniqueConversations = [];

      const sortedConversations = (conversationList || [])
        .slice()
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      for (const conversation of sortedConversations) {
        const signature = getConversationSignature(conversation);
        if (signature && seenSignatures.has(signature)) {
          duplicates.push(conversation);
          continue;
        }
        if (signature) {
          seenSignatures.add(signature);
        }
        uniqueConversations.push(conversation);
      }

      return {
        conversations: uniqueConversations,
        duplicates,
      };
    },
    [getConversationSignature],
  );

  const normalizeConversation = useCallback(
    (conversation) => {
      if (!conversation) {
        return null;
      }

      const seenMessageIds = new Set();
      const normalizedMessages = Array.isArray(conversation.messages)
        ? conversation.messages.map((msg) => {
            const rawId =
              typeof msg?.id === 'string' && msg.id.trim() !== '' ? msg.id : '';
            const nextId =
              rawId && !seenMessageIds.has(rawId) ? rawId : generateMessageId();
            seenMessageIds.add(nextId);
            return {
              ...msg,
              id: nextId,
            };
          })
        : [];

      return {
        id: conversation.conversation_id || conversation.id,
        type: normalizePlaygroundConversationType(conversation.type),
        title: normalizeConversationTitle(conversation),
        messages: normalizedMessages,
        createdAt:
          conversation.created_at || conversation.createdAt || Date.now(),
        updatedAt:
          conversation.updated_at || conversation.updatedAt || Date.now(),
      };
    },
    [normalizeConversationTitle],
  );

  const getLatestConversationForMode = useCallback(
    (conversationList = [], mode = playgroundModeRef.current) => {
      const normalizedMode = normalizePlaygroundConversationType(mode);
      return (conversationList || [])
        .filter(
          (conversation) =>
            normalizePlaygroundConversationType(conversation?.type) ===
            normalizedMode,
        )
        .slice()
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    },
    [],
  );

  const mergeConversationLists = useCallback(
    (localList = [], remoteList = []) => {
      const mergedById = new Map();

      [...localList, ...remoteList].forEach((conversation) => {
        if (!conversation?.id) {
          return;
        }
        const existingConversation = mergedById.get(conversation.id);
        if (!existingConversation) {
          mergedById.set(conversation.id, conversation);
          return;
        }

        const existingUpdatedAt = Number(existingConversation.updatedAt || 0);
        const nextUpdatedAt = Number(conversation.updatedAt || 0);
        mergedById.set(
          conversation.id,
          nextUpdatedAt >= existingUpdatedAt
            ? conversation
            : existingConversation,
        );
      });

      return Array.from(mergedById.values()).sort(
        (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
      );
    },
    [],
  );

  const persistConversationToServer = useCallback(
    async (conversation) => {
      if (!conversation?.id) {
        return;
      }
      if (isConversationEmpty(conversation)) {
        return;
      }
      if (deletedConversationIdsRef.current.has(conversation.id)) {
        return;
      }

      await API.post(
        API_ENDPOINTS.PLAYGROUND_CONVERSATIONS,
        {
          conversation_id: conversation.id,
          type: normalizePlaygroundConversationType(conversation.type),
          title: normalizeConversationTitle(conversation),
          messages: Array.isArray(conversation.messages)
            ? sanitizeMessagesForStorage(conversation.messages)
            : [],
          created_at: conversation.createdAt || Date.now(),
          updated_at: conversation.updatedAt || Date.now(),
        },
        { skipErrorHandler: true },
      );
    },
    [isConversationEmpty, normalizeConversationTitle],
  );

  const scheduleRemoteConversationSave = useCallback(
    (conversation) => {
      if (saveRemoteConversationTimeoutRef.current) {
        clearTimeout(saveRemoteConversationTimeoutRef.current);
      }

      saveRemoteConversationTimeoutRef.current = setTimeout(() => {
        persistConversationToServer(conversation).catch((error) => {
          console.error('保存后端会话失败:', error);
        });
      }, 500);
    },
    [persistConversationToServer],
  );

  const persistMessagesSnapshot = useCallback(
    (messagesToSave, options = {}) => {
      const nextMessages = messagesToSave || [];
      const { flushRemote = false } = options;

      const now = Date.now();
      const currentConversationId =
        activeConversationId || currentConversationIdRef.current || `pg-${now}`;
      const currentConversations =
        localConversationStateRef.current.conversations || [];
      const existingConversation = currentConversations.find(
        (conversation) => conversation.id === currentConversationId,
      );

      deletedConversationIdsRef.current.delete(currentConversationId);
      currentConversationIdRef.current = currentConversationId;

      const nextConversation = {
        ...(existingConversation ||
          createStoredConversation(
            nextMessages,
            currentConversationId,
            playgroundModeRef.current,
          )),
        id: currentConversationId,
        type: normalizePlaygroundConversationType(
          existingConversation?.type || playgroundModeRef.current,
        ),
        title: createStoredConversation(nextMessages, currentConversationId)
          .title,
        messages: nextMessages,
        updatedAt: now,
      };

      const updatedConversations = existingConversation
        ? currentConversations.map((conversation) =>
            conversation.id === currentConversationId
              ? nextConversation
              : conversation,
          )
        : [nextConversation, ...currentConversations];

      persistConversationState(updatedConversations, currentConversationId);
      if (flushRemote) {
        if (saveRemoteConversationTimeoutRef.current) {
          clearTimeout(saveRemoteConversationTimeoutRef.current);
          saveRemoteConversationTimeoutRef.current = null;
        }
        persistConversationToServer(nextConversation).catch((error) => {
          console.error('立即保存后端会话失败:', error);
        });
      } else {
        scheduleRemoteConversationSave(nextConversation);
      }

      return {
        currentConversationId,
        nextConversation,
        updatedConversations,
      };
    },
    [
      activeConversationId,
      persistConversationState,
      persistConversationToServer,
      scheduleRemoteConversationSave,
    ],
  );

  // 配置更新函数
  const handleInputChange = useCallback((name, value) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleParameterToggle = useCallback((paramName) => {
    setParameterEnabled((prev) => ({
      ...prev,
      [paramName]: !prev[paramName],
    }));
  }, []);

  // 消息保存函数 - 改为立即保存，可以接受参数
  const saveMessagesImmediately = useCallback(
    (messagesToSave) => {
      const nextMessages = messagesToSave || message;
      const { currentConversationId, updatedConversations } =
        persistMessagesSnapshot(nextMessages);
      setConversations(updatedConversations);
      if (!activeConversationId) {
        setActiveConversationId(currentConversationId);
      }
    },
    [activeConversationId, message, persistMessagesSnapshot],
  );

  const createConversation = useCallback(
    (messages = [], type = playgroundModeRef.current) => {
      const conversation = createStoredConversation(messages, null, type);
      deletedConversationIdsRef.current.delete(conversation.id);
      setConversations((prevConversations) => {
        const updatedConversations = [conversation, ...prevConversations];
        persistConversationState(updatedConversations, conversation.id);
        scheduleRemoteConversationSave(conversation);
        return updatedConversations;
      });
      currentConversationIdRef.current = conversation.id;
      setActiveConversationId(conversation.id);
      setMessage(messages);
      return conversation.id;
    },
    [persistConversationState, scheduleRemoteConversationSave],
  );

  const startNewConversation = useCallback(() => {
    const currentConversation = conversations.find(
      (conversation) => conversation.id === currentConversationIdRef.current,
    );
    const currentMode = playgroundModeRef.current;

    if (
      currentConversation &&
      normalizePlaygroundConversationType(currentConversation.type) ===
        currentMode &&
      isConversationEmpty(currentConversation)
    ) {
      currentConversationIdRef.current = currentConversation.id;
      setActiveConversationId(currentConversation.id);
      setMessage([]);
      persistConversationState(conversations, currentConversation.id);
      return currentConversation.id;
    }

    const nextConversation = createStoredConversation(
      [],
      null,
      playgroundModeRef.current,
    );
    const updatedConversations = [nextConversation, ...conversations];
    deletedConversationIdsRef.current.delete(nextConversation.id);
    currentConversationIdRef.current = nextConversation.id;
    setConversations(updatedConversations);
    setActiveConversationId(nextConversation.id);
    setMessage([]);
    persistConversationState(updatedConversations, nextConversation.id);
    return nextConversation.id;
  }, [conversations, isConversationEmpty, persistConversationState]);

  const switchConversation = useCallback(
    (conversationId) => {
      const conversation = conversations.find(
        (item) => item.id === conversationId,
      );
      if (!conversation) {
        return;
      }
      deletedConversationIdsRef.current.delete(conversationId);
      currentConversationIdRef.current = conversationId;
      setActiveConversationId(conversationId);
      setMessage(conversation.messages || []);
      persistConversationState(conversations, conversationId);
    },
    [conversations, persistConversationState],
  );

  const deleteConversation = useCallback(
    (conversationId) => {
      deletedConversationIdsRef.current.add(conversationId);
      if (saveRemoteConversationTimeoutRef.current) {
        clearTimeout(saveRemoteConversationTimeoutRef.current);
        saveRemoteConversationTimeoutRef.current = null;
      }
      setConversations((prevConversations) => {
        const updatedConversations = prevConversations.filter(
          (conversation) => conversation.id !== conversationId,
        );
        const nextActiveConversation =
          activeConversationId === conversationId
            ? getLatestConversationForMode(updatedConversations)
            : null;
        const nextActiveId =
          activeConversationId === conversationId
            ? nextActiveConversation?.id || null
            : activeConversationId;
        persistConversationState(updatedConversations, nextActiveId);
        currentConversationIdRef.current = nextActiveId;
        setActiveConversationId(nextActiveId);
        if (activeConversationId === conversationId) {
          const nextMessages = nextActiveConversation?.messages || [];
          setMessage(nextMessages);
        }
        return updatedConversations;
      });
      API.delete(
        `${API_ENDPOINTS.PLAYGROUND_CONVERSATIONS}/${conversationId}`,
        { skipErrorHandler: true },
      ).catch((error) => {
        console.error('删除后端会话失败:', error);
      });
    },
    [
      activeConversationId,
      getLatestConversationForMode,
      persistConversationState,
    ],
  );

  useEffect(() => {
    let isCancelled = false;

    const hydrateIndexedConversations = async () => {
      const migratedState = await migrateConversationStateToIndexedDB(
        normalizedUserIdentity,
      );
      const indexedState =
        (await loadConversationStateFromIndexedDB(normalizedUserIdentity)) ||
        migratedState;

      if (isCancelled) {
        return;
      }

      if (!indexedState?.conversations?.length) {
        setConversationStorageReady(true);
        return;
      }

      const { conversations: dedupedIndexedConversations } =
        dedupeConversations(indexedState.conversations);
      const nextActiveConversation =
        getLatestConversationForMode(
          dedupedIndexedConversations,
          playgroundModeRef.current,
        ) || dedupedIndexedConversations[0];
      const nextActiveConversationId = nextActiveConversation?.id || null;

      localConversationStateRef.current = {
        conversations: dedupedIndexedConversations,
        activeConversationId: nextActiveConversationId,
      };
      currentConversationIdRef.current = nextActiveConversationId;
      setConversations(dedupedIndexedConversations);
      setActiveConversationId(nextActiveConversationId);
      setMessage(
        nextActiveConversation?.messages?.length
          ? nextActiveConversation.messages
          : [],
      );
      setConversationStorageReady(true);
    };

    hydrateIndexedConversations().catch((error) => {
      console.error('Hydrate IndexedDB 会话失败:', error);
      setConversationStorageReady(true);
    });

    return () => {
      isCancelled = true;
    };
  }, [
    dedupeConversations,
    getLatestConversationForMode,
    normalizedUserIdentity,
  ]);

  useEffect(() => {
    if (!conversationStorageReady) {
      return undefined;
    }

    let isCancelled = false;

    const hydrateRemoteConversations = async () => {
      try {
        const res = await API.get(API_ENDPOINTS.PLAYGROUND_CONVERSATIONS, {
          disableDuplicate: true,
          skipErrorHandler: true,
        });
        const { success, data } = res.data || {};
        if (!success || isCancelled) {
          return;
        }

        const remoteConversations = (Array.isArray(data) ? data : [])
          .map(normalizeConversation)
          .filter((item) => item && item.id);
        const { conversations: normalizedRemoteConversations, duplicates } =
          dedupeConversations(remoteConversations);

        if (duplicates.length > 0) {
          duplicates.forEach((conversation) => {
            API.delete(
              `${API_ENDPOINTS.PLAYGROUND_CONVERSATIONS}/${conversation.id}`,
              { skipErrorHandler: true },
            ).catch((error) => {
              console.error('清理重复会话失败:', error);
            });
          });
        }

        const mergedConversations = mergeConversationLists(
          localConversationStateRef.current.conversations || [],
          normalizedRemoteConversations,
        );
        const { conversations: dedupedMergedConversations } =
          dedupeConversations(mergedConversations);
        const nextConversations =
          dedupedMergedConversations.length > 0
            ? dedupedMergedConversations
            : [createStoredConversation([], null, playgroundModeRef.current)];
        const nextActiveConversation =
          getLatestConversationForMode(
            nextConversations,
            playgroundModeRef.current,
          ) || nextConversations[0];
        const nextActiveConversationId = nextActiveConversation?.id || null;

        setConversations(nextConversations);
        currentConversationIdRef.current = nextActiveConversationId;
        setActiveConversationId(nextActiveConversationId);
        setMessage(
          nextActiveConversation?.messages?.length
            ? nextActiveConversation.messages
            : [],
        );
        persistConversationState(nextConversations, nextActiveConversationId);
      } catch (error) {
        console.error('加载后端会话失败:', error);
      }
    };

    hydrateRemoteConversations();

    return () => {
      isCancelled = true;
    };
  }, [
    dedupeConversations,
    mergeConversationLists,
    getLatestConversationForMode,
    normalizeConversation,
    conversationStorageReady,
    persistConversationState,
    normalizedUserIdentity,
  ]);

  useEffect(() => {
    if (!conversationStorageReady) {
      return;
    }

    const currentMode = normalizePlaygroundConversationType(playgroundMode);
    const activeConversation = conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );

    if (
      activeConversation &&
      normalizePlaygroundConversationType(activeConversation.type) ===
        currentMode
    ) {
      return;
    }

    const nextConversation = getLatestConversationForMode(
      conversations,
      currentMode,
    );

    if (nextConversation) {
      currentConversationIdRef.current = nextConversation.id;
      setActiveConversationId(nextConversation.id);
      setMessage(nextConversation.messages || []);
      persistConversationState(conversations, nextConversation.id);
      return;
    }

    const emptyConversation = createStoredConversation([], null, currentMode);
    const updatedConversations = [emptyConversation, ...conversations];
    deletedConversationIdsRef.current.delete(emptyConversation.id);
    currentConversationIdRef.current = emptyConversation.id;
    setConversations(updatedConversations);
    setActiveConversationId(emptyConversation.id);
    setMessage([]);
    persistConversationState(updatedConversations, emptyConversation.id);
  }, [
    activeConversationId,
    conversationStorageReady,
    conversations,
    getLatestConversationForMode,
    persistConversationState,
    playgroundMode,
  ]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }
    const activeConversation = conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );
    if (!activeConversation) {
      return;
    }
    const nextMessages = activeConversation.messages || [];
    setMessage((prevMessages) =>
      prevMessages === nextMessages ? prevMessages : nextMessages,
    );
  }, [activeConversationId, conversations]);

  useEffect(() => {
    localConversationStateRef.current = {
      conversations,
      activeConversationId,
    };
  }, [activeConversationId, conversations]);

  // 配置保存
  const debouncedSaveConfig = useCallback(() => {
    if (saveConfigTimeoutRef.current) {
      clearTimeout(saveConfigTimeoutRef.current);
    }

    saveConfigTimeoutRef.current = setTimeout(() => {
      const configToSave = {
        inputs,
        parameterEnabled,
        showDebugPanel,
        customRequestMode,
        customRequestBody,
        playgroundMode,
      };
      saveConfig(configToSave);
    }, 1000);
  }, [
    inputs,
    parameterEnabled,
    showDebugPanel,
    customRequestMode,
    customRequestBody,
    playgroundMode,
  ]);

  // 配置导入/重置
  const handleConfigImport = useCallback((importedConfig) => {
    if (importedConfig.inputs) {
      const parsedMaxTokens = parseInt(importedConfig.inputs.max_tokens, 10);
      setInputs((prev) => ({
        ...prev,
        ...importedConfig.inputs,
        max_tokens: Number.isNaN(parsedMaxTokens)
          ? importedConfig.inputs.max_tokens
          : parsedMaxTokens,
      }));
    }
    if (importedConfig.parameterEnabled) {
      setParameterEnabled((prev) => ({
        ...prev,
        ...importedConfig.parameterEnabled,
      }));
    }
    if (typeof importedConfig.showDebugPanel === 'boolean') {
      setShowDebugPanel(importedConfig.showDebugPanel);
    }
    if (importedConfig.customRequestMode) {
      setCustomRequestMode(importedConfig.customRequestMode);
    }
    if (importedConfig.customRequestBody) {
      setCustomRequestBody(importedConfig.customRequestBody);
    }
    // 如果导入的配置包含消息，也恢复消息
    if (importedConfig.messages && Array.isArray(importedConfig.messages)) {
      setMessage(importedConfig.messages);
    }
  }, []);

  const handleConfigReset = useCallback((options = {}) => {
    const { resetMessages = false } = options;

    setInputs(DEFAULT_CONFIG.inputs);
    setParameterEnabled(DEFAULT_CONFIG.parameterEnabled);
    setShowDebugPanel(DEFAULT_CONFIG.showDebugPanel);
    setCustomRequestMode(DEFAULT_CONFIG.customRequestMode);
    setCustomRequestBody(DEFAULT_CONFIG.customRequestBody);
    setPlaygroundMode(DEFAULT_CONFIG.playgroundMode);

    // 只有在明确指定时才重置消息
    if (resetMessages) {
      setMessage([]);
      setTimeout(() => {
        setMessage(getDefaultMessages(t));
      }, 0);
    }
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveConfigTimeoutRef.current) {
        clearTimeout(saveConfigTimeoutRef.current);
      }
      if (saveRemoteConversationTimeoutRef.current) {
        clearTimeout(saveRemoteConversationTimeoutRef.current);
      }
    };
  }, []);

  // 页面首次加载时，若最后一条消息仍处于 LOADING/INCOMPLETE 状态，自动修复
  useEffect(() => {
    if (!Array.isArray(message) || message.length === 0) return;

    const lastMsg = message[message.length - 1];
    const prevMsg = message.length > 1 ? message[message.length - 2] : null;
    if (lastMsg?.taskId) {
      return;
    }
    if (
      lastMsg.status === MESSAGE_STATUS.LOADING ||
      lastMsg.status === MESSAGE_STATUS.INCOMPLETE
    ) {
      const contentText =
        typeof lastMsg.content === 'string' ? lastMsg.content : '';
      const reasoningText =
        typeof lastMsg.reasoningContent === 'string'
          ? lastMsg.reasoningContent
          : '';
      const hasThinkContent =
        reasoningText.trim() !== '' || contentText.includes('<think>');

      // This repair path is only for chat-style incomplete thinking output.
      // Do not rewrite image/video placeholder messages like "正在生成图片...".
      if (!hasThinkContent) {
        return;
      }

      // Only repair messages that were restored from persisted conversation
      // state. If the previous message is a user message, we are in an active
      // request lifecycle and the streaming hook should own status changes.
      if (prevMsg?.role === MESSAGE_ROLES.USER) {
        return;
      }

      const processed = processIncompleteThinkTags(contentText, reasoningText);

      const fixedLastMsg = {
        ...lastMsg,
        status: MESSAGE_STATUS.COMPLETE,
        content: processed.content,
        reasoningContent: processed.reasoningContent || null,
        isThinkingComplete: true,
      };

      const updatedMessages = [...message.slice(0, -1), fixedLastMsg];
      setMessage(updatedMessages);

      // 保存修复后的消息列表
      persistMessagesSnapshot(updatedMessages);
      setConversations(localConversationStateRef.current.conversations || []);
    }
  }, [message, persistMessagesSnapshot]);

  return {
    // 配置状态
    inputs,
    parameterEnabled,
    showDebugPanel,
    customRequestMode,
    customRequestBody,
    playgroundMode,

    // UI状态
    showSettings,
    models,
    imageModels,
    videoModels,
    groups,
    status,
    conversations,
    activeConversationId,

    // 消息状态
    message,

    // 调试状态
    debugData,
    activeDebugTab,
    previewPayload,

    // 编辑状态
    editingMessageId,
    editValue,

    // Refs
    sseSourceRef,
    chatRef,
    saveConfigTimeoutRef,

    // 更新函数
    setInputs,
    setParameterEnabled,
    setShowDebugPanel,
    setCustomRequestMode,
    setCustomRequestBody,
    setPlaygroundMode,
    setShowSettings,
    setModels,
    setImageModels,
    setVideoModels,
    setGroups,
    setStatus,
    setConversations,
    setActiveConversationId,
    setMessage,
    setDebugData,
    setActiveDebugTab,
    setPreviewPayload,
    setEditingMessageId,
    setEditValue,

    // 处理函数
    handleInputChange,
    handleParameterToggle,
    debouncedSaveConfig,
    saveMessagesImmediately,
    persistMessagesSnapshot,
    createConversation,
    startNewConversation,
    switchConversation,
    deleteConversation,
    handleConfigImport,
    handleConfigReset,
  };
};
