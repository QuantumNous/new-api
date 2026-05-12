import React, {
  useContext,
  useEffect,
  useCallback,
  useState,
  useRef,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Toast } from '@douyinfe/semi-ui';
import './index.css';

// Context
import { UserContext } from '../../context/User';
import { useIsMobile } from '../../hooks/common/useIsMobile';

// hooks
import { usePlaygroundState } from '../../hooks/playground/usePlaygroundState';
import { useMessageActions } from '../../hooks/playground/useMessageActions';
import { useApiRequest } from '../../hooks/playground/useApiRequest';
import { useSyncMessageAndCustomBody } from '../../hooks/playground/useSyncMessageAndCustomBody';
import { useMessageEdit } from '../../hooks/playground/useMessageEdit';
import { useDataLoader } from '../../hooks/playground/useDataLoader';

// Constants and utils
import {
  API_ENDPOINTS,
  DEBUG_TABS,
  MESSAGE_STATUS,
  MESSAGE_ROLES,
  ERROR_MESSAGES,
} from '../../constants/playground.constants';
import {
  getLogo,
  stringToColor,
  buildMessageContent,
  createMessage,
  createLoadingAssistantMessage,
  getTextContent,
  buildApiPayload,
  encodeToBase64,
  getUserIdFromLocalStorage,
} from '../../helpers';

// Components
import {
  OptimizedMessageContent,
  OptimizedMessageActions,
} from '../../components/playground/OptimizedComponents';
import ChatArea from '../../components/playground/ChatArea2';
import PlaygroundSidebar from '../../components/playground/PlaygroundSidebar';
import { PlaygroundProvider } from '../../contexts/PlaygroundContext';

// 生成头像
const generateAvatarDataUrl = (username) => {
  if (!username) {
    return 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png';
  }
  const firstLetter = username[0].toUpperCase();
  const bgColor = stringToColor(username);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="${bgColor}" />
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="16" fill="#ffffff" font-family="sans-serif">${firstLetter}</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${encodeToBase64(svg)}`;
};

const Playground = () => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const isMobile = useIsMobile();
  const styleState = { isMobile };
  const [searchParams] = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const videoPollingRef = useRef(new Set());

  const state = usePlaygroundState();
  const {
    inputs,
    parameterEnabled,
    showDebugPanel,
    customRequestMode,
    customRequestBody,
    playgroundMode,
    models,
    imageModels,
    videoModels,
    conversations,
    activeConversationId,
    message,
    sseSourceRef,
    chatRef,
    handleInputChange,
    debouncedSaveConfig,
    saveMessagesImmediately,
    startNewConversation,
    switchConversation,
    deleteConversation,
    setShowSettings,
    setModels,
    setImageModels,
    setVideoModels,
    setGroups,
    setMessage,
    setDebugData,
    setActiveDebugTab,
    setPreviewPayload,
    setCustomRequestBody,
    setPlaygroundMode,
  } = state;

  // API 请求相关
  const { sendRequest, onStopGenerator } = useApiRequest(
    setMessage,
    setDebugData,
    setActiveDebugTab,
    sseSourceRef,
    saveMessagesImmediately,
  );

  // 数据加载
  useDataLoader(
    userState,
    inputs,
    handleInputChange,
    setModels,
    setImageModels,
    setVideoModels,
    setGroups,
  );

  // 消息编辑
  const {
    editingMessageId,
    editValue,
    setEditValue,
    handleMessageEdit,
    handleEditSave,
    handleEditCancel,
  } = useMessageEdit(
    setMessage,
    inputs,
    parameterEnabled,
    sendRequest,
    saveMessagesImmediately,
  );

  // 消息和自定义请求体同步
  const { syncMessageToCustomBody, syncCustomBodyToMessage } =
    useSyncMessageAndCustomBody(
      customRequestMode,
      customRequestBody,
      message,
      inputs,
      setCustomRequestBody,
      setMessage,
      debouncedSaveConfig,
    );

  // 角色信息
  const roleInfo = {
    user: {
      name: userState?.user?.username || 'User',
      avatar: generateAvatarDataUrl(userState?.user?.username),
    },
    assistant: {
      name: 'Assistant',
      avatar: getLogo(),
    },
    system: {
      name: 'System',
      avatar: getLogo(),
    },
  };

  // 消息操作
  const messageActions = useMessageActions(
    message,
    setMessage,
    onMessageSend,
    saveMessagesImmediately,
  );

  // 构建预览请求体
  const constructPreviewPayload = useCallback(() => {
    try {
      // 如果是自定义请求体模式且有自定义内容，直接返回解析后的自定义请求体
      if (customRequestMode && customRequestBody && customRequestBody.trim()) {
        try {
          return JSON.parse(customRequestBody);
        } catch (parseError) {
          console.warn('自定义请求体JSON解析失败，回退到默认预览:', parseError);
        }
      }

      // 默认预览逻辑
      if (playgroundMode === 'image') {
        return {
          model: inputs.imageModel,
          prompt: getTextContent(message[message.length - 1]) || '',
          n: Number(inputs.imageCount) || 1,
          size: inputs.imageSize || '1024x1024',
          quality: inputs.imageQuality || 'auto',
          response_format: 'b64_json',
          ...(inputs.group ? { group: inputs.group } : {}),
        };
      }

      let messages = [...message];

      // 如果存在用户消息
      if (
        !(
          messages.length === 0 ||
          messages.every((msg) => msg.role !== MESSAGE_ROLES.USER)
        )
      ) {
        // 处理最后一个用户消息的图片
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === MESSAGE_ROLES.USER) {
            if (inputs.imageEnabled && inputs.imageUrls) {
              const validImageUrls = inputs.imageUrls.filter(
                (url) => url.trim() !== '',
              );
              if (validImageUrls.length > 0) {
                const textContent = getTextContent(messages[i]) || '示例消息';
                const content = buildMessageContent(
                  textContent,
                  validImageUrls,
                  true,
                );
                messages[i] = { ...messages[i], content };
              }
            }
            break;
          }
        }
      }

      return buildApiPayload(messages, null, inputs, parameterEnabled);
    } catch (error) {
      console.error('构造预览请求体失败:', error);
      return null;
    }
  }, [
    inputs,
    parameterEnabled,
    message,
    playgroundMode,
    customRequestMode,
    customRequestBody,
  ]);

  // 发送消息
  function onMessageSend(content, attachment) {
    console.log('attachment: ', attachment);

    if (playgroundMode === 'image') {
      submitImageGeneration(content);
      return;
    }

    if (playgroundMode === 'video') {
      submitVideoGeneration(content);
      return;
    }

    // 创建用户消息和加载消息
    const userMessage = createMessage(MESSAGE_ROLES.USER, content);
    const loadingMessage = createLoadingAssistantMessage();

    // 如果是自定义请求体模式
    if (customRequestMode && customRequestBody) {
      try {
        const customPayload = JSON.parse(customRequestBody);

        setMessage((prevMessage) => {
          const newMessages = [...prevMessage, userMessage, loadingMessage];

          // 发送自定义请求体
          sendRequest(customPayload, customPayload.stream !== false);

          // 发送消息后保存，传入新消息列表
          setTimeout(() => saveMessagesImmediately(newMessages), 0);

          return newMessages;
        });
        return;
      } catch (error) {
        console.error('自定义请求体JSON解析失败:', error);
        Toast.error(ERROR_MESSAGES.JSON_PARSE_ERROR);
        return;
      }
    }

    // 默认模式
    const validImageUrls = inputs.imageUrls.filter((url) => url.trim() !== '');
    const messageContent = buildMessageContent(
      content,
      validImageUrls,
      inputs.imageEnabled,
    );
    const userMessageWithImages = createMessage(
      MESSAGE_ROLES.USER,
      messageContent,
    );

    setMessage((prevMessage) => {
      const newMessages = [...prevMessage, userMessageWithImages];

      const payload = buildApiPayload(
        newMessages,
        null,
        inputs,
        parameterEnabled,
      );
      sendRequest(payload, inputs.stream);

      // 禁用图片模式
      if (inputs.imageEnabled) {
        setTimeout(() => {
          handleInputChange('imageEnabled', false);
        }, 100);
      }

      // 发送消息后保存，传入新消息列表（包含用户消息和加载消息）
      const messagesWithLoading = [...newMessages, loadingMessage];
      setTimeout(() => saveMessagesImmediately(messagesWithLoading), 0);

      return messagesWithLoading;
    });
  }

  const extractTaskId = useCallback((data) => {
    return (
      data?.id ||
      data?.task_id ||
      data?.data?.id ||
      data?.data?.task_id ||
      data?.data?.TaskID
    );
  }, []);

  const parseJsonLikeValue = useCallback((value) => {
    if (!value) {
      return null;
    }
    if (typeof value === 'object') {
      return value;
    }
    if (typeof value !== 'string') {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }, []);

  const collectImageUrls = useCallback(
    (value, collector = []) => {
      if (value == null) {
        return collector;
      }

      if (typeof value === 'string') {
        const parsed = parseJsonLikeValue(value);
        if (parsed && parsed !== value) {
          collectImageUrls(parsed, collector);
          return collector;
        }
        if (
          value.startsWith('data:image/') ||
          value.includes('http://') ||
          value.includes('https://')
        ) {
          collector.push(value);
        }
        return collector;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => collectImageUrls(item, collector));
        return collector;
      }

      if (typeof value !== 'object') {
        return collector;
      }

      Object.entries(value).forEach(([key, nestedValue]) => {
        const lowerKey = key.toLowerCase();

        if (
          lowerKey === 'b64_json' &&
          typeof nestedValue === 'string' &&
          nestedValue.trim() !== ''
        ) {
          collector.push(`data:image/png;base64,${nestedValue}`);
          return;
        }

        if (
          (lowerKey === 'url' ||
            lowerKey === 'result_url' ||
            lowerKey.includes('image_url')) &&
          typeof nestedValue === 'string' &&
          nestedValue.trim() !== ''
        ) {
          collector.push(nestedValue);
        }

        collectImageUrls(nestedValue, collector);
      });

      return collector;
    },
    [parseJsonLikeValue],
  );

  const extractImageUrls = useCallback(
    (responseData) => {
      const responsePayload = parseJsonLikeValue(responseData) || responseData;
      return collectImageUrls(responsePayload, []).filter(
        (url, index, array) =>
          typeof url === 'string' &&
          url.trim() !== '' &&
          array.indexOf(url) === index,
      );
    },
    [collectImageUrls, parseJsonLikeValue],
  );

  const buildImagePayload = useCallback(
    (prompt) => {
      const payload = {
        model: inputs.imageModel,
        prompt,
        n: Number(inputs.imageCount) || 1,
        size: inputs.imageSize || '1024x1024',
        quality: inputs.imageQuality || 'auto',
        response_format: 'b64_json',
      };

      if (inputs.group) {
        payload.group = inputs.group;
      }

      return payload;
    },
    [inputs],
  );

  const updateImageAssistantMessage = useCallback(
    (messageId, patch) => {
      setMessage((prevMessages) => {
        const nextMessages = prevMessages.map((msg) =>
          msg.id === messageId ? { ...msg, ...patch } : msg,
        );
        setTimeout(() => saveMessagesImmediately(nextMessages), 0);
        return nextMessages;
      });
    },
    [saveMessagesImmediately, setMessage],
  );

  const buildImageAssistantContent = useCallback(
    (prompt, imageUrls) => {
      const lines = [t('图片生成完成')];
      if (prompt) {
        lines.push(prompt);
      }
      return [
        {
          type: 'text',
          text: lines.join('\n\n'),
        },
        ...imageUrls.map((url) => ({
          type: 'image_url',
          image_url: { url },
        })),
      ];
    },
    [t],
  );

  const isProxyVideoUrl = useCallback((url) => {
    if (typeof url !== 'string' || url.trim() === '') {
      return false;
    }

    return (
      url.includes('/v1/videos/') ||
      url.includes('/pg/videos/') ||
      url.startsWith('http://localhost') ||
      url.startsWith('https://localhost') ||
      url.startsWith('http://127.0.0.1') ||
      url.startsWith('https://127.0.0.1')
    );
  }, []);

  const collectVideoUrls = useCallback(
    (value, collector = []) => {
      if (!value) {
        return collector;
      }

      const parsedValue = parseJsonLikeValue(value);
      if (parsedValue == null) {
        return collector;
      }

      if (typeof parsedValue === 'string') {
        if (
          parsedValue.includes('http://') ||
          parsedValue.includes('https://') ||
          parsedValue.includes('/v1/videos/') ||
          parsedValue.includes('/pg/videos/')
        ) {
          collector.push(parsedValue);
        }
        return collector;
      }

      if (Array.isArray(parsedValue)) {
        parsedValue.forEach((item) => collectVideoUrls(item, collector));
        return collector;
      }

      if (typeof parsedValue !== 'object') {
        return collector;
      }

      Object.entries(parsedValue || {}).forEach(([key, nestedValue]) => {
        const lowerKey = key.toLowerCase();
        if (
          (lowerKey.includes('video') || lowerKey.includes('url')) &&
          typeof nestedValue === 'string'
        ) {
          collector.push(nestedValue);
        }
        collectVideoUrls(nestedValue, collector);
      });

      return collector;
    },
    [parseJsonLikeValue],
  );

  const extractVideoUrl = useCallback(
    (data, taskId) => {
      const taskPayload =
        parseJsonLikeValue(data?.data?.data) ||
        parseJsonLikeValue(data?.data?.Data) ||
        parseJsonLikeValue(data?.data);

      const directCandidates = [
        taskPayload?.content?.video_url,
        taskPayload?.content?.videoUrl,
        taskPayload?.video_url,
        taskPayload?.videoUrl,
        taskPayload?.result_url,
        taskPayload?.data?.content?.video_url,
        taskPayload?.data?.content?.videoUrl,
        taskPayload?.data?.result_url,
        data?.data?.content?.video_url,
        data?.data?.content?.videoUrl,
        data?.data?.result_url,
        data?.data?.metadata?.url,
        data?.data?.PrivateData?.result_url,
        data?.metadata?.url,
        data?.url,
        data?.result_url,
        data?.data?.url,
      ];

      const recursiveCandidates = collectVideoUrls(data, []);
      const candidateUrls = [
        ...directCandidates,
        ...recursiveCandidates,
      ].filter(
        (url, index, array) =>
          typeof url === 'string' &&
          url.trim() !== '' &&
          array.indexOf(url) === index,
      );

      const upstreamUrl = candidateUrls.find((url) => !isProxyVideoUrl(url));
      if (upstreamUrl) {
        return upstreamUrl;
      }

      if (candidateUrls.length > 0) {
        return candidateUrls[0];
      }

      return taskId ? `${API_ENDPOINTS.VIDEO_CONTENT}/${taskId}/content` : '';
    },
    [collectVideoUrls, isProxyVideoUrl, parseJsonLikeValue],
  );

  const normalizeTaskStatus = useCallback((data) => {
    return (
      data?.status ||
      data?.data?.status ||
      data?.data?.Status ||
      'queued'
    ).toLowerCase();
  }, []);

  const buildVideoPayload = useCallback(
    (prompt) => {
      const duration = Number(inputs.videoDuration) || 5;
      const images = (inputs.imageUrls || []).filter(
        (url) => url.trim() !== '',
      );
      const payload = {
        model: inputs.videoModel,
        prompt,
        seconds: String(duration),
        metadata: {
          ratio: inputs.videoRatio || '16:9',
          duration,
        },
      };

      if (inputs.videoResolution) {
        payload.metadata.resolution = inputs.videoResolution;
      }
      if (inputs.imageEnabled && images.length > 0) {
        payload.images = images;
      }
      if (inputs.group) {
        payload.group = inputs.group;
      }

      return payload;
    },
    [inputs],
  );

  const updateVideoAssistantMessage = useCallback(
    (messageId, patch) => {
      setMessage((prevMessages) => {
        const nextMessages = prevMessages.map((msg) =>
          msg.id === messageId ? { ...msg, ...patch } : msg,
        );
        setTimeout(() => saveMessagesImmediately(nextMessages), 0);
        return nextMessages;
      });
    },
    [saveMessagesImmediately, setMessage],
  );

  const parseVideoErrorMessage = useCallback(
    (rawError) => {
      const fallback = t('视频任务创建失败');
      if (!rawError) {
        return fallback;
      }

      const parseJsonLike = (value) => {
        if (!value || typeof value !== 'string') {
          return null;
        }
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      };

      const collectError = (value) => {
        if (!value) {
          return null;
        }

        if (typeof value === 'string') {
          const parsed = parseJsonLike(value);
          if (parsed) {
            return collectError(parsed);
          }
          return { message: value };
        }

        if (typeof value === 'object') {
          if (value.error) {
            return collectError(value.error);
          }
          if (value.message) {
            const nested = collectError(value.message);
            if (nested?.message && nested.message !== value.message) {
              return {
                code: nested.code || value.code,
                type: nested.type || value.type,
                message: nested.message,
              };
            }
            return {
              code: value.code,
              type: value.type,
              message: value.message,
            };
          }
        }

        return null;
      };

      const details = collectError(rawError);
      if (!details?.message) {
        return fallback;
      }

      if (details.code === 'AccountOverdueError') {
        return t('视频渠道上游账号已欠费，请充值或更换可用渠道。');
      }

      return details.message;
    },
    [t],
  );

  const fetchVideoTaskSnapshot = useCallback(
    async (taskId) => {
      const taskResponse = await fetch(
        `${API_ENDPOINTS.VIDEO_GENERATION_TASK}/${taskId}`,
        {
          headers: {
            'New-Api-User': getUserIdFromLocalStorage(),
          },
        },
      );
      const taskData = await taskResponse.json();
      const taskStatus = normalizeTaskStatus(taskData);

      setDebugData((prev) => ({
        ...prev,
        response: JSON.stringify(taskData, null, 2),
      }));

      if (!taskResponse.ok) {
        throw new Error(parseVideoErrorMessage(taskData));
      }

      return {
        taskData,
        taskStatus,
      };
    },
    [normalizeTaskStatus, parseVideoErrorMessage, setDebugData],
  );

  const formatVideoTaskMessage = useCallback((taskId, status, label) => {
    const segments = [label];
    if (taskId) {
      segments.push(`Task ID: ${taskId}`);
    }
    if (status) {
      segments.push(`Status: ${status}`);
    }
    return segments.join('\n\n');
  }, []);

  const pollVideoTask = useCallback(
    async (messageId, taskId, options = {}) => {
      if (!messageId || !taskId || videoPollingRef.current.has(messageId)) {
        return;
      }

      const {
        attempts = 150,
        intervalMs = 2000,
        pendingLabel = t('Seedance 视频生成中...'),
        timeoutLabel = t('视频生成仍在处理中，请稍后通过任务 ID 查询'),
      } = options;

      videoPollingRef.current.add(messageId);

      try {
        for (let i = 0; i < attempts; i++) {
          if (i > 0) {
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
          }

          const { taskData, taskStatus } = await fetchVideoTaskSnapshot(taskId);

          if (['succeeded', 'success', 'completed'].includes(taskStatus)) {
            const videoUrl = extractVideoUrl(taskData, taskId);
            updateVideoAssistantMessage(messageId, {
              content: `${t('视频生成完成')}\n\n[${t('点击播放视频')}](${videoUrl})`,
              videoUrl,
              taskId,
              status: MESSAGE_STATUS.COMPLETE,
              isThinkingComplete: true,
            });
            return;
          }

          if (['failed', 'failure', 'error'].includes(taskStatus)) {
            throw new Error(
              taskData?.error?.message ||
                taskData?.data?.error?.message ||
                taskData?.data?.fail_reason ||
                t('视频生成失败'),
            );
          }

          updateVideoAssistantMessage(messageId, {
            content: formatVideoTaskMessage(taskId, taskStatus, pendingLabel),
            taskId,
            status: MESSAGE_STATUS.INCOMPLETE,
          });
        }

        updateVideoAssistantMessage(messageId, {
          content: formatVideoTaskMessage(taskId, 'processing', timeoutLabel),
          taskId,
          status: MESSAGE_STATUS.COMPLETE,
          isThinkingComplete: true,
        });
      } catch (error) {
        updateVideoAssistantMessage(messageId, {
          content: t('视频请求发生错误: ') + error.message,
          taskId,
          status: MESSAGE_STATUS.ERROR,
          errorCode: error.errorCode || null,
        });
      } finally {
        videoPollingRef.current.delete(messageId);
      }
    },
    [
      extractVideoUrl,
      fetchVideoTaskSnapshot,
      formatVideoTaskMessage,
      normalizeTaskStatus,
      t,
      updateVideoAssistantMessage,
    ],
  );

  const submitVideoGeneration = useCallback(
    async (content) => {
      const prompt = typeof content === 'string' ? content.trim() : '';
      if (!prompt) {
        Toast.warning(t('请输入视频提示词'));
        return;
      }

      const userMessage = createMessage(MESSAGE_ROLES.USER, prompt);
      const assistantMessage = createMessage(
        MESSAGE_ROLES.ASSISTANT,
        t('正在创建 Seedance 视频任务...'),
        {
          status: MESSAGE_STATUS.LOADING,
          reasoningContent: '',
          isReasoningExpanded: false,
          isThinkingComplete: false,
        },
      );
      const payload = buildVideoPayload(prompt);

      setMessage((prevMessage) => {
        const nextMessages = [...prevMessage, userMessage, assistantMessage];
        setTimeout(() => saveMessagesImmediately(nextMessages), 0);
        return nextMessages;
      });
      setDebugData((prev) => ({
        ...prev,
        request: payload,
        response: null,
        timestamp: new Date().toISOString(),
      }));
      setActiveDebugTab(DEBUG_TABS.REQUEST);

      try {
        const createResponse = await fetch(API_ENDPOINTS.VIDEO_GENERATIONS, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'New-Api-User': getUserIdFromLocalStorage(),
          },
          body: JSON.stringify(payload),
        });

        const createData = await createResponse.json();
        setDebugData((prev) => ({
          ...prev,
          response: JSON.stringify(createData, null, 2),
        }));
        setActiveDebugTab(DEBUG_TABS.RESPONSE);

        if (!createResponse.ok) {
          throw new Error(parseVideoErrorMessage(createData));
        }

        const taskId = extractTaskId(createData);
        if (!taskId) {
          throw new Error(t('视频任务创建失败：未返回任务 ID'));
        }

        updateVideoAssistantMessage(assistantMessage.id, {
          content: formatVideoTaskMessage(
            taskId,
            'queued',
            t('Seedance 视频任务已提交，正在生成...'),
          ),
          taskId,
          status: MESSAGE_STATUS.INCOMPLETE,
        });

        await pollVideoTask(assistantMessage.id, taskId, {
          pendingLabel: t('Seedance 视频生成中...'),
          timeoutLabel: t('视频生成仍在处理中，请稍后通过任务 ID 查询'),
        });
      } catch (error) {
        updateVideoAssistantMessage(assistantMessage.id, {
          content: t('视频请求发生错误: ') + error.message,
          status: MESSAGE_STATUS.ERROR,
          errorCode: error.errorCode || null,
        });
      }
    },
    [
      buildVideoPayload,
      extractTaskId,
      extractVideoUrl,
      formatVideoTaskMessage,
      normalizeTaskStatus,
      pollVideoTask,
      saveMessagesImmediately,
      setActiveDebugTab,
      setDebugData,
      setMessage,
      t,
      updateVideoAssistantMessage,
    ],
  );

  const submitImageGeneration = useCallback(
    async (content) => {
      const prompt = typeof content === 'string' ? content.trim() : '';
      if (!prompt) {
        Toast.warning(t('请输入图片提示词'));
        return;
      }

      const userMessage = createMessage(MESSAGE_ROLES.USER, prompt);
      const assistantMessage = createMessage(
        MESSAGE_ROLES.ASSISTANT,
        t('正在生成图片...'),
        {
          status: MESSAGE_STATUS.LOADING,
          reasoningContent: '',
          isReasoningExpanded: false,
          isThinkingComplete: false,
        },
      );
      const payload = buildImagePayload(prompt);

      setMessage((prevMessage) => {
        const nextMessages = [...prevMessage, userMessage, assistantMessage];
        setTimeout(() => saveMessagesImmediately(nextMessages), 0);
        return nextMessages;
      });
      setDebugData((prev) => ({
        ...prev,
        request: payload,
        response: null,
        timestamp: new Date().toISOString(),
      }));
      setActiveDebugTab(DEBUG_TABS.REQUEST);

      try {
        const createResponse = await fetch(API_ENDPOINTS.IMAGE_GENERATIONS, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'New-Api-User': getUserIdFromLocalStorage(),
          },
          body: JSON.stringify(payload),
        });

        const createData = await createResponse.json();
        setDebugData((prev) => ({
          ...prev,
          response: JSON.stringify(createData, null, 2),
        }));
        setActiveDebugTab(DEBUG_TABS.RESPONSE);

        if (!createResponse.ok) {
          throw new Error(
            createData?.error?.message ||
              createData?.message ||
              t('图片生成失败'),
          );
        }

        const imageUrls = extractImageUrls(createData);
        if (imageUrls.length === 0) {
          throw new Error(t('图片生成完成，但未返回图片地址'));
        }

        updateImageAssistantMessage(assistantMessage.id, {
          content: buildImageAssistantContent(prompt, imageUrls),
          imageUrls,
          status: MESSAGE_STATUS.COMPLETE,
          isThinkingComplete: true,
        });
      } catch (error) {
        updateImageAssistantMessage(assistantMessage.id, {
          content: t('图片请求发生错误: ') + error.message,
          status: MESSAGE_STATUS.ERROR,
          errorCode: error.errorCode || null,
        });
      }
    },
    [
      buildImageAssistantContent,
      buildImagePayload,
      extractImageUrls,
      saveMessagesImmediately,
      setActiveDebugTab,
      setDebugData,
      setMessage,
      t,
      updateImageAssistantMessage,
    ],
  );

  // 切换推理展开状态
  const toggleReasoningExpansion = useCallback(
    (messageId) => {
      setMessage((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId && msg.role === MESSAGE_ROLES.ASSISTANT
            ? { ...msg, isReasoningExpanded: !msg.isReasoningExpanded }
            : msg,
        ),
      );
    },
    [setMessage],
  );

  // 渲染函数
  const renderCustomChatContent = useCallback(
    ({ message, className }) => {
      const isCurrentlyEditing = editingMessageId === message.id;

      return (
        <OptimizedMessageContent
          message={message}
          className={className}
          styleState={styleState}
          onToggleReasoningExpansion={toggleReasoningExpansion}
          isEditing={isCurrentlyEditing}
          onEditSave={handleEditSave}
          onEditCancel={handleEditCancel}
          editValue={editValue}
          onEditValueChange={setEditValue}
        />
      );
    },
    [
      styleState,
      editingMessageId,
      editValue,
      handleEditSave,
      handleEditCancel,
      setEditValue,
      toggleReasoningExpansion,
    ],
  );

  const renderChatBoxAction = useCallback(
    (props) => {
      const { message: currentMessage } = props;
      const isAnyMessageGenerating = message.some(
        (msg) => msg.status === 'loading' || msg.status === 'incomplete',
      );
      const isCurrentlyEditing = editingMessageId === currentMessage.id;

      return (
        <OptimizedMessageActions
          message={currentMessage}
          styleState={styleState}
          onMessageReset={messageActions.handleMessageReset}
          onMessageCopy={messageActions.handleMessageCopy}
          onMessageDelete={messageActions.handleMessageDelete}
          onRoleToggle={messageActions.handleRoleToggle}
          onMessageEdit={handleMessageEdit}
          isAnyMessageGenerating={isAnyMessageGenerating}
          isEditing={isCurrentlyEditing}
        />
      );
    },
    [messageActions, styleState, message, editingMessageId, handleMessageEdit],
  );

  // Effects

  // 同步消息和自定义请求体
  useEffect(() => {
    syncMessageToCustomBody();
  }, [message, syncMessageToCustomBody]);

  useEffect(() => {
    syncCustomBodyToMessage();
  }, [customRequestBody, syncCustomBodyToMessage]);

  // 处理URL参数
  useEffect(() => {
    if (searchParams.get('expired')) {
      Toast.warning(t('登录过期，请重新登录！'));
    }
  }, [searchParams, t]);

  // Playground 组件无需再监听窗口变化，isMobile 由 useIsMobile Hook 自动更新

  // 构建预览payload
  useEffect(() => {
    const timer = setTimeout(() => {
      const preview = constructPreviewPayload();
      setPreviewPayload(preview);
      setDebugData((prev) => ({
        ...prev,
        previewRequest: preview ? JSON.stringify(preview, null, 2) : null,
        previewTimestamp: preview ? new Date().toISOString() : null,
      }));
    }, 300);

    return () => clearTimeout(timer);
  }, [
    message,
    inputs,
    parameterEnabled,
    customRequestMode,
    customRequestBody,
    constructPreviewPayload,
    setPreviewPayload,
    setDebugData,
  ]);

  useEffect(() => {
    if (!Array.isArray(message) || message.length === 0) {
      return;
    }

    message.forEach((msg) => {
      if (
        msg?.role !== MESSAGE_ROLES.ASSISTANT ||
        !msg?.taskId ||
        msg?.videoUrl ||
        msg?.status === MESSAGE_STATUS.COMPLETE ||
        msg?.status === MESSAGE_STATUS.ERROR
      ) {
        return;
      }

      pollVideoTask(msg.id, msg.taskId, {
        pendingLabel: t('Seedance 视频生成中...'),
        timeoutLabel: t('视频生成仍在处理中，请稍后通过任务 ID 查询'),
      });
    });
  }, [message, pollVideoTask, t]);

  useEffect(() => {
    if (!Array.isArray(message) || message.length === 0) {
      return;
    }

    message.forEach((msg) => {
      if (
        msg?.role !== MESSAGE_ROLES.ASSISTANT ||
        !msg?.taskId ||
        videoPollingRef.current.has(`${msg.id}:refresh`)
      ) {
        return;
      }

      const hasRecoverableVideoError =
        msg?.status === MESSAGE_STATUS.ERROR &&
        typeof msg?.content === 'string' &&
        msg.content.includes('Cannot convert undefined or null to object');
      const needsRefresh =
        !msg?.videoUrl ||
        isProxyVideoUrl(msg.videoUrl) ||
        hasRecoverableVideoError ||
        (typeof msg?.content === 'string' && isProxyVideoUrl(msg.content));

      if (!needsRefresh) {
        return;
      }

      const refreshKey = `${msg.id}:refresh`;
      videoPollingRef.current.add(refreshKey);

      fetchVideoTaskSnapshot(msg.taskId)
        .then(({ taskData, taskStatus }) => {
          if (!['succeeded', 'success', 'completed'].includes(taskStatus)) {
            return;
          }

          const nextVideoUrl = extractVideoUrl(taskData, msg.taskId);
          if (!nextVideoUrl || isProxyVideoUrl(nextVideoUrl)) {
            return;
          }

          updateVideoAssistantMessage(msg.id, {
            content: `${t('视频生成完成')}\n\n[${t('点击播放视频')}](${nextVideoUrl})`,
            videoUrl: nextVideoUrl,
            taskId: msg.taskId,
            status: MESSAGE_STATUS.COMPLETE,
            isThinkingComplete: true,
          });
        })
        .catch((error) => {
          console.error('刷新视频任务真实地址失败:', error);
        })
        .finally(() => {
          videoPollingRef.current.delete(refreshKey);
        });
    });
  }, [
    extractVideoUrl,
    fetchVideoTaskSnapshot,
    isProxyVideoUrl,
    message,
    t,
    updateVideoAssistantMessage,
  ]);

  // 自动保存配置
  useEffect(() => {
    debouncedSaveConfig();
  }, [
    inputs,
    parameterEnabled,
    showDebugPanel,
    customRequestMode,
    customRequestBody,
    playgroundMode,
    debouncedSaveConfig,
  ]);

  // 清空对话的处理函数
  const handleClearMessages = useCallback(() => {
    setMessage([]);
    // 清空对话后保存，传入空数组
    setTimeout(() => saveMessagesImmediately([]), 0);
  }, [setMessage, saveMessagesImmediately]);

  const handleNewConversation = useCallback(() => {
    startNewConversation();
  }, [startNewConversation]);

  // 处理粘贴图片
  const handlePasteImage = useCallback(
    (base64Data) => {
      if (!inputs.imageEnabled) {
        return;
      }
      // 添加图片到 imageUrls 数组
      const newUrls = [...(inputs.imageUrls || []), base64Data];
      handleInputChange('imageUrls', newUrls);
    },
    [inputs.imageEnabled, inputs.imageUrls, handleInputChange],
  );

  // Playground Context 值
  const playgroundContextValue = {
    onPasteImage: handlePasteImage,
    imageUrls: inputs.imageUrls || [],
    imageEnabled: inputs.imageEnabled || false,
  };

  return (
    <PlaygroundProvider value={playgroundContextValue}>
      <div className='new-playground-page'>
        <PlaygroundSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          collapsed={sidebarCollapsed && !isMobile}
          onNewChat={handleNewConversation}
          onOpenSettings={() => setShowSettings(true)}
          onSelectConversation={switchConversation}
          onDeleteConversation={deleteConversation}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        />

        <main className='new-playground-main'>
          <ChatArea
            chatRef={chatRef}
            message={message}
            inputs={inputs}
            models={models}
            imageModels={imageModels}
            videoModels={videoModels}
            playgroundMode={playgroundMode}
            customRequestMode={customRequestMode}
            roleInfo={roleInfo}
            onInputChange={handleInputChange}
            onModeChange={setPlaygroundMode}
            onMessageSend={onMessageSend}
            onMessageCopy={messageActions.handleMessageCopy}
            onMessageReset={messageActions.handleMessageReset}
            onMessageDelete={messageActions.handleMessageDelete}
            onStopGenerator={onStopGenerator}
            onClearMessages={handleClearMessages}
            renderCustomChatContent={renderCustomChatContent}
            renderChatBoxAction={renderChatBoxAction}
          />
        </main>
      </div>
    </PlaygroundProvider>
  );
};

export default Playground;
