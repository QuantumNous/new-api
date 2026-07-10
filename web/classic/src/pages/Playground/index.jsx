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

import React, {
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useState,
  useRef,
} from 'react';
import {
  UNSAFE_NavigationContext as NavigationContext,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Modal, Toast } from '@douyinfe/semi-ui';
import './index.css';
import './index2.css';

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
import {
  loadCachedImageDataUrl,
  saveCachedImageDataUrl,
} from '../../components/playground/configStorage';

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
import { extractPdfText } from '../../helpers/playgroundPdfExtract';
import {
  extractDocxText,
  extractJsonText,
  extractPlainTextFile,
  extractXlsxText,
} from '../../helpers/playgroundDocumentExtract';
import { buildInlineFileContentParts } from '../../helpers/playgroundFileInline';

const MAX_PLAYGROUND_ATTACHMENT_SIZE = 20 * 1024 * 1024;
const MAX_PLAYGROUND_INLINE_FILES = 10;
const FILE_ATTACHMENT_STATUS = {
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
};

const SUPPORTED_INLINE_FILE_TYPES = new Set([
  'pdf',
  'docx',
  'xlsx',
  'txt',
  'json',
]);
const LEGACY_OFFICE_FILE_TYPES = new Set(['doc', 'xls']);

const getFileExtension = (file) => {
  const filename = String(file?.name || '').toLowerCase();
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? '' : filename.slice(lastDot + 1);
};

const isPdfFile = (file) => {
  return file?.type === 'application/pdf' || getFileExtension(file) === 'pdf';
};

const isDocxFile = (file) =>
  file?.type ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
  getFileExtension(file) === 'docx';

const isXlsxFile = (file) =>
  file?.type ===
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
  getFileExtension(file) === 'xlsx';

const isTextFile = (file) =>
  file?.type?.startsWith('text/') || getFileExtension(file) === 'txt';

const isJsonFile = (file) =>
  file?.type === 'application/json' || getFileExtension(file) === 'json';

const getInlineFileType = (file) => {
  if (isPdfFile(file)) {
    return 'pdf';
  }
  if (isDocxFile(file)) {
    return 'docx';
  }
  if (isXlsxFile(file)) {
    return 'xlsx';
  }
  if (isJsonFile(file)) {
    return 'json';
  }
  if (isTextFile(file)) {
    return 'txt';
  }

  return getFileExtension(file);
};

const buildFileDisplayPart = (attachment) => ({
  type: 'file',
  file: {
    filename: attachment.name,
    file_type: attachment.kind,
  },
});

const buildApiContentWithInlineFiles = ({
  textContent,
  files,
  imageUrls,
  imageEnabled,
}) => [
  ...buildInlineFileContentParts({
    prompt: textContent,
    files,
  }),
  ...(imageEnabled
    ? imageUrls.map((url) => ({
        type: 'image_url',
        image_url: { url: url.trim() },
      }))
    : []),
];

const buildInlineFileSignature = (file, kind = getInlineFileType(file)) =>
  [
    String(file?.name || ''),
    String(file?.size || 0),
    String(file?.lastModified || 0),
    kind,
  ].join('::');

const extractInlineFileText = async (file, kind) => {
  if (kind === 'pdf') {
    return extractPdfText(file);
  }
  if (kind === 'docx') {
    return extractDocxText(file);
  }
  if (kind === 'xlsx') {
    return extractXlsxText(file);
  }
  if (kind === 'json') {
    return extractJsonText(file);
  }
  return extractPlainTextFile(file);
};

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

export const PlaygroundPage = ({ forcedMode = 'chat' }) => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const { navigator } = useContext(NavigationContext);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const styleState = { isMobile };
  const [searchParams] = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isImageGenerationPending, setIsImageGenerationPending] =
    useState(false);
  const [selectedInlineFiles, setSelectedInlineFiles] = useState([]);
  const pendingRouteRef = useRef(null);
  const popstateGuardActiveRef = useRef(false);
  const imageAbortControllerRef = useRef(null);
  const imageCacheInFlightRef = useRef(new Set());
  const videoPollingRef = useRef(new Set());
  const playgroundUserIdentity = useMemo(
    () => ({
      id: userState?.user?.id || null,
      username: userState?.user?.username || 'anonymous',
    }),
    [userState?.user?.id, userState?.user?.username],
  );

  const state = usePlaygroundState(playgroundUserIdentity);
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
    persistMessagesSnapshot,
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

  const normalizedImageModel = String(inputs.imageModel || '').toLowerCase();
  const isQwenImageModel = normalizedImageModel.includes('qwen-image');

  useEffect(() => {
    if (
      forcedMode &&
      (forcedMode === 'chat' ||
        forcedMode === 'image' ||
        forcedMode === 'video')
    ) {
      setPlaygroundMode(forcedMode);
    }
  }, [forcedMode, setPlaygroundMode]);

  useEffect(() => {
    if (!isQwenImageModel) {
      return;
    }

    const supportedQwenSizes = new Set([
      '1328x1328',
      '1024x1024',
      '1664x928',
      '928x1664',
      '1472x1140',
      '1140x1472',
    ]);

    if (!supportedQwenSizes.has(inputs.imageSize)) {
      handleInputChange('imageSize', '1328x1328');
    }
  }, [handleInputChange, inputs.imageSize, isQwenImageModel]);

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

  const imageGenerationBlockMessage = t(
    '图片仍在生成中，切换对话、新建对话、切换模式或离开页面都不会停止后端任务，仍可能继续消耗额度。请等待生成完成后再操作。',
  );

  const showImageGenerationBlockedToast = useCallback(() => {
    Toast.warning({
      content: imageGenerationBlockMessage,
      duration: 4,
    });
  }, [imageGenerationBlockMessage]);

  const confirmLeaveDuringImageGeneration = useCallback(
    (onConfirm) => {
      Modal.confirm({
        title: t('图片仍在生成中'),
        content: imageGenerationBlockMessage,
        okText: t('仍要离开'),
        cancelText: t('留在当前页'),
        onOk: onConfirm,
      });
    },
    [imageGenerationBlockMessage, t],
  );

  const stopPendingImageGeneration = useCallback(
    (options = {}) => {
      const { silent = false } = options;

      if (imageAbortControllerRef.current) {
        imageAbortControllerRef.current.abort();
        imageAbortControllerRef.current = null;
      }

      setIsImageGenerationPending(false);

      if (!silent) {
        Toast.info({
          content: t(
            '已尝试停止当前图片请求。若后端已将任务提交给上游，仍不能保证上游一定停止计费。',
          ),
          duration: 4,
        });
      }
    },
    [t],
  );

  const guardImageGenerationAction = useCallback(
    (action) =>
      (...args) => {
        if (isImageGenerationPending) {
          showImageGenerationBlockedToast();
          return;
        }
        return action?.(...args);
      },
    [isImageGenerationPending, showImageGenerationBlockedToast],
  );

  const handleStopGeneration = useCallback(() => {
    if (isImageGenerationPending) {
      stopPendingImageGeneration();
      return;
    }
    onStopGenerator();
  }, [isImageGenerationPending, onStopGenerator, stopPendingImageGeneration]);

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
  async function onMessageSend(content) {
    if (playgroundMode === 'image') {
      handleSubmitWithImageCleanup(() => submitImageGeneration(content));
      return;
    }

    if (playgroundMode === 'video') {
      handleSubmitWithImageCleanup(() => submitVideoGeneration(content));
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
          clearSelectedImages();

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
    if (
      selectedInlineFiles.some(
        (file) => file.status === FILE_ATTACHMENT_STATUS.LOADING,
      )
    ) {
      Toast.warning({
        content: t('文件解析中，请稍候'),
        duration: 2,
      });
      return;
    }

    if (
      selectedInlineFiles.some(
        (file) => file.status === FILE_ATTACHMENT_STATUS.ERROR,
      )
    ) {
      Toast.error({
        content: t('文件解析失败，请重新选择文件'),
        duration: 3,
      });
      return;
    }

    const validImageUrls = inputs.imageUrls.filter((url) => url.trim() !== '');
    const fileDisplayParts = selectedInlineFiles.map(buildFileDisplayPart);
    const inlineFiles = selectedInlineFiles.map((attachment) => ({
      filename: attachment.name,
      text: attachment.text,
    }));

    const messageContent = buildMessageContent(
      content,
      validImageUrls,
      inputs.imageEnabled,
      fileDisplayParts,
    );
    const apiMessageContent = selectedInlineFiles.length
      ? buildApiContentWithInlineFiles({
          textContent: content,
          files: inlineFiles,
          imageUrls: validImageUrls,
          imageEnabled: inputs.imageEnabled,
        })
      : null;
    const userMessageWithImages = createMessage(
      MESSAGE_ROLES.USER,
      messageContent,
      apiMessageContent ? { apiContent: apiMessageContent } : {},
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
      clearSelectedImages();
      setSelectedInlineFiles([]);

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

  const convertImageUrlToDataUrl = useCallback(async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`图片下载失败 (${response.status})`);
    }

    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('图片转换失败'));
      };
      reader.onerror = () => {
        reject(reader.error || new Error('图片转换失败'));
      };
      reader.readAsDataURL(blob);
    });
  }, []);

  const cacheImageUrlsInBackground = useCallback(
    async (imageUrls = []) => {
      await Promise.all(
        imageUrls.map(async (url) => {
          if (
            typeof url !== 'string' ||
            url.trim() === '' ||
            url.startsWith('data:image/') ||
            imageCacheInFlightRef.current.has(url)
          ) {
            return;
          }

          const cachedDataUrl = await loadCachedImageDataUrl(url);
          if (typeof cachedDataUrl === 'string' && cachedDataUrl !== '') {
            return;
          }

          imageCacheInFlightRef.current.add(url);
          try {
            const dataUrl = await convertImageUrlToDataUrl(url);
            await saveCachedImageDataUrl(url, dataUrl);
          } catch (error) {
            console.warn('缓存图片到 IndexedDB 失败:', url, error);
          } finally {
            imageCacheInFlightRef.current.delete(url);
          }
        }),
      );
    },
    [convertImageUrlToDataUrl],
  );

  const hydrateMessagesWithCachedImageUrls = useCallback(
    async (messages = []) => {
      let changed = false;
      const urlsToCache = new Set();

      const nextMessages = await Promise.all(
        (messages || []).map(async (msg) => {
          if (!Array.isArray(msg?.content)) {
            return msg;
          }

          let messageChanged = false;
          const cachedUrlMap = new Map();
          const nextContent = await Promise.all(
            msg.content.map(async (item) => {
              if (item?.type !== 'image_url') {
                return item;
              }

              const originalUrl = item?.image_url?.url;
              if (
                typeof originalUrl !== 'string' ||
                originalUrl.trim() === '' ||
                originalUrl.startsWith('data:image/')
              ) {
                return item;
              }

              const cachedDataUrl = await loadCachedImageDataUrl(originalUrl);
              if (typeof cachedDataUrl === 'string' && cachedDataUrl !== '') {
                messageChanged = true;
                cachedUrlMap.set(originalUrl, cachedDataUrl);
                return {
                  ...item,
                  image_url: {
                    ...item.image_url,
                    url: cachedDataUrl,
                  },
                };
              }

              urlsToCache.add(originalUrl);
              return item;
            }),
          );

          if (!messageChanged) {
            return msg;
          }

          changed = true;
          return {
            ...msg,
            content: nextContent,
            imageUrls: Array.isArray(msg.imageUrls)
              ? msg.imageUrls.map((url) => {
                  if (
                    typeof url !== 'string' ||
                    url.trim() === '' ||
                    url.startsWith('data:image/')
                  ) {
                    return url;
                  }
                  return cachedUrlMap.get(url) || url;
                })
              : msg.imageUrls,
          };
        }),
      );

      return {
        nextMessages,
        changed,
        urlsToCache: Array.from(urlsToCache),
      };
    },
    [],
  );

  const buildImagePayload = useCallback(
    (prompt) => {
      const payload = {
        model: inputs.imageModel,
        prompt,
        n: Number(inputs.imageCount) || 1,
        size: inputs.imageSize || '1024x1024',
        quality: inputs.imageQuality || 'auto',
        output_format: inputs.outputFormat || 'png',
        response_format: 'b64_json',
      };

      if (inputs.group) {
        payload.group = inputs.group;
      }

      return payload;
    },
    [inputs],
  );

  const clearSelectedImages = useCallback(() => {
    if (inputs.imageEnabled) {
      handleInputChange('imageEnabled', false);
    }
    if (Array.isArray(inputs.imageUrls) && inputs.imageUrls.length > 0) {
      handleInputChange('imageUrls', []);
    }
  }, [handleInputChange, inputs.imageEnabled, inputs.imageUrls]);

  const handleSubmitWithImageCleanup = useCallback(
    (submitAction) => {
      clearSelectedImages();
      return submitAction();
    },
    [clearSelectedImages],
  );

  useEffect(() => {
    if (playgroundMode !== 'chat' || customRequestMode) {
      fileSelectionVersionRef.current += 1;
      setSelectedInlineFiles([]);
    }
  }, [customRequestMode, playgroundMode]);

  const buildImageEditFormData = useCallback(
    async (prompt) => {
      const images = (inputs.imageUrls || []).filter(
        (url) => url.trim() !== '',
      );
      const formData = new FormData();

      formData.append('model', inputs.imageModel);
      formData.append('prompt', prompt);
      formData.append('n', String(Number(inputs.imageCount) || 1));
      formData.append('size', inputs.imageSize || '1024x1024');
      formData.append('quality', inputs.imageQuality || 'auto');
      formData.append('output_format', inputs.outputFormat || 'png');
      formData.append('response_format', 'b64_json');

      if (inputs.group) {
        formData.append('group', inputs.group);
      }

      const toBlob = async (url, index) => {
        if (url.startsWith('data:')) {
          const response = await fetch(url);
          const blob = await response.blob();
          const mimeType = blob.type || 'image/png';
          const extension = mimeType.split('/')[1] || 'png';
          return new File([blob], `reference-${index + 1}.${extension}`, {
            type: mimeType,
          });
        }

        const response = await fetch(url);
        const blob = await response.blob();
        const mimeType = blob.type || 'image/png';
        const extension = mimeType.split('/')[1] || 'png';
        return new File([blob], `reference-${index + 1}.${extension}`, {
          type: mimeType,
        });
      };

      const files = await Promise.all(
        images.map((url, index) => toBlob(url, index)),
      );
      files.forEach((file) => {
        formData.append('image[]', file);
      });

      return formData;
    },
    [inputs],
  );

  const updateImageAssistantMessage = useCallback(
    (messageId, patch) => {
      setMessage((prevMessages) => {
        const nextMessages = prevMessages.map((msg) =>
          msg.id === messageId ? { ...msg, ...patch } : msg,
        );
        persistMessagesSnapshot(nextMessages, {
          flushRemote:
            patch?.status === MESSAGE_STATUS.COMPLETE ||
            patch?.status === MESSAGE_STATUS.ERROR,
        });
        return nextMessages;
      });
    },
    [persistMessagesSnapshot, setMessage],
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
      const hasReferenceImages =
        Array.isArray(inputs.imageUrls) &&
        inputs.imageEnabled &&
        inputs.imageUrls.some((url) => url.trim() !== '');

      clearSelectedImages();

      setMessage((prevMessage) => {
        const nextMessages = [...prevMessage, userMessage, assistantMessage];
        persistMessagesSnapshot(nextMessages);
        return nextMessages;
      });
      setDebugData((prev) => ({
        ...prev,
        request: payload,
        response: null,
        timestamp: new Date().toISOString(),
      }));
      setActiveDebugTab(DEBUG_TABS.REQUEST);
      setIsImageGenerationPending(true);

      try {
        if (imageAbortControllerRef.current) {
          imageAbortControllerRef.current.abort();
        }
        const abortController = new AbortController();
        imageAbortControllerRef.current = abortController;

        let createResponse;
        if (hasReferenceImages) {
          const formData = await buildImageEditFormData(prompt);
          setDebugData((prev) => ({
            ...prev,
            request: {
              ...payload,
              image: (inputs.imageUrls || []).filter(
                (url) => url.trim() !== '',
              ),
              request_type: 'multipart/form-data',
              endpoint: API_ENDPOINTS.IMAGE_EDITS,
            },
          }));
          createResponse = await fetch(API_ENDPOINTS.IMAGE_EDITS, {
            method: 'POST',
            headers: {
              'New-Api-User': getUserIdFromLocalStorage(),
            },
            signal: abortController.signal,
            body: formData,
          });
        } else {
          createResponse = await fetch(API_ENDPOINTS.IMAGE_GENERATIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'New-Api-User': getUserIdFromLocalStorage(),
            },
            signal: abortController.signal,
            body: JSON.stringify(payload),
          });
        }

        const createData = await createResponse.json();
        imageAbortControllerRef.current = null;
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
        void cacheImageUrlsInBackground(imageUrls);
      } catch (error) {
        if (error?.name === 'AbortError') {
          updateImageAssistantMessage(assistantMessage.id, {
            content: t(
              '图片请求已在前端停止。若上游任务已创建，仍可能继续执行。',
            ),
            status: MESSAGE_STATUS.COMPLETE,
            isThinkingComplete: true,
          });
          return;
        }

        updateImageAssistantMessage(assistantMessage.id, {
          content: t('图片请求发生错误: ') + error.message,
          status: MESSAGE_STATUS.ERROR,
          errorCode: error.errorCode || null,
        });
      } finally {
        imageAbortControllerRef.current = null;
        setIsImageGenerationPending(false);
      }
    },
    [
      buildImageAssistantContent,
      buildImageEditFormData,
      buildImagePayload,
      cacheImageUrlsInBackground,
      clearSelectedImages,
      extractImageUrls,
      inputs.imageEnabled,
      inputs.imageUrls,
      setIsImageGenerationPending,
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

  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isImageGenerationPending || !navigator?.block) {
      return undefined;
    }

    const unblock = navigator.block((tx) => {
      confirmLeaveDuringImageGeneration(() => {
        stopPendingImageGeneration({ silent: true });
        unblock();
        tx.retry();
      });
    });

    return unblock;
  }, [
    confirmLeaveDuringImageGeneration,
    isImageGenerationPending,
    navigator,
    stopPendingImageGeneration,
  ]);

  useEffect(() => {
    if (!isImageGenerationPending) {
      return undefined;
    }

    const handleDocumentClickCapture = (event) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = event.target?.closest?.('a[href]');
      if (!anchor) {
        return;
      }
      if (anchor.target && anchor.target !== '_self') {
        return;
      }
      if (anchor.hasAttribute('download')) {
        return;
      }

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        return;
      }

      let nextUrl;
      try {
        nextUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) {
        return;
      }

      const nextPath =
        `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}` || '/';
      const currentPath =
        `${location.pathname}${location.search}${location.hash}` || '/';

      if (nextPath === currentPath) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      pendingRouteRef.current = nextPath;
      confirmLeaveDuringImageGeneration(() => {
        stopPendingImageGeneration({ silent: true });
        const targetPath = pendingRouteRef.current;
        pendingRouteRef.current = null;
        if (targetPath) {
          navigate(targetPath);
        }
      });
    };

    document.addEventListener('click', handleDocumentClickCapture, true);
    return () => {
      document.removeEventListener('click', handleDocumentClickCapture, true);
    };
  }, [
    confirmLeaveDuringImageGeneration,
    isImageGenerationPending,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    stopPendingImageGeneration,
  ]);

  useEffect(() => {
    if (!isImageGenerationPending) {
      popstateGuardActiveRef.current = false;
      return undefined;
    }

    if (!popstateGuardActiveRef.current) {
      window.history.pushState(
        { playgroundImagePendingGuard: true },
        '',
        window.location.href,
      );
      popstateGuardActiveRef.current = true;
    }

    const handlePopState = () => {
      window.history.pushState(
        { playgroundImagePendingGuard: true },
        '',
        window.location.href,
      );
      confirmLeaveDuringImageGeneration(() => {
        stopPendingImageGeneration({ silent: true });
        popstateGuardActiveRef.current = false;
        window.history.back();
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [
    confirmLeaveDuringImageGeneration,
    isImageGenerationPending,
    stopPendingImageGeneration,
  ]);

  useEffect(() => {
    if (!isImageGenerationPending) {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = imageGenerationBlockMessage;
      return imageGenerationBlockMessage;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [imageGenerationBlockMessage, isImageGenerationPending]);

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
    let isCancelled = false;

    const hydrateCachedImages = async () => {
      const { nextMessages, changed, urlsToCache } =
        await hydrateMessagesWithCachedImageUrls(message);

      if (isCancelled) {
        return;
      }

      if (changed) {
        setMessage((prevMessages) =>
          prevMessages === message ? nextMessages : prevMessages,
        );
      }

      if (urlsToCache.length > 0) {
        void cacheImageUrlsInBackground(urlsToCache);
      }
    };

    hydrateCachedImages();

    return () => {
      isCancelled = true;
    };
  }, [
    cacheImageUrlsInBackground,
    hydrateMessagesWithCachedImageUrls,
    message,
    setMessage,
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

  useEffect(() => {
    return () => {
      if (imageAbortControllerRef.current) {
        imageAbortControllerRef.current.abort();
        imageAbortControllerRef.current = null;
      }
    };
  }, []);

  // 清空对话的处理函数
  const handleClearMessages = useCallback(() => {
    setMessage([]);
    // 清空对话后保存，传入空数组
    setTimeout(() => saveMessagesImmediately([]), 0);
  }, [setMessage, saveMessagesImmediately]);

  const handleNewConversation = useCallback(() => {
    startNewConversation();
  }, [startNewConversation]);

  const guardedClearMessages = useMemoizedCallback(
    guardImageGenerationAction(handleClearMessages),
  );
  const guardedNewConversation = useMemoizedCallback(
    guardImageGenerationAction(handleNewConversation),
  );
  const guardedSwitchConversation = useMemoizedCallback(
    guardImageGenerationAction(switchConversation),
  );
  const guardedDeleteConversation = useMemoizedCallback(
    guardImageGenerationAction(deleteConversation),
  );
  const guardedModeChange = useMemoizedCallback(
    guardImageGenerationAction(setPlaygroundMode),
  );

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

  const handleSelectImageFile = useCallback(
    (file) => {
      if (!file) {
        return;
      }

      if (!inputs.imageEnabled) {
        handleInputChange('imageEnabled', true);
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target?.result;
        if (typeof base64Data !== 'string' || base64Data === '') {
          Toast.error({
            content: t('选择图片失败'),
            duration: 2,
          });
          return;
        }

        const newUrls = [...(inputs.imageUrls || []), base64Data];
        handleInputChange('imageUrls', newUrls);
        Toast.success({
          content: t('图片已添加'),
          duration: 2,
        });
      };
      reader.onerror = () => {
        Toast.error({
          content: t('选择图片失败'),
          duration: 2,
        });
      };
      reader.readAsDataURL(file);
    },
    [handleInputChange, inputs.imageEnabled, inputs.imageUrls, t],
  );

  const handleRemoveImage = useCallback(
    (indexToRemove) => {
      const nextUrls = (inputs.imageUrls || []).filter(
        (_, index) => index !== indexToRemove,
      );
      handleInputChange('imageUrls', nextUrls);
    },
    [handleInputChange, inputs.imageUrls],
  );

  const handleSelectInlineFile = useCallback(
    async (filesOrFile) => {
      const inputFiles = Array.isArray(filesOrFile)
        ? filesOrFile
        : Array.from(
            filesOrFile && typeof filesOrFile.length === 'number'
              ? filesOrFile
              : filesOrFile
                ? [filesOrFile]
                : [],
          );

      if (inputFiles.length === 0) {
        return;
      }

      if (selectedInlineFiles.length >= MAX_PLAYGROUND_INLINE_FILES) {
        Toast.warning({
          content: t('最多只能选择 {{count}} 个文件', {
            count: MAX_PLAYGROUND_INLINE_FILES,
          }),
          duration: 3,
        });
        return;
      }

      const existingSignatures = new Set(
        selectedInlineFiles.map((attachment) =>
          buildInlineFileSignature(attachment.file, attachment.kind),
        ),
      );
      const nextSignatures = new Set();
      const attachmentsToAdd = [];
      let hasLegacyOfficeFile = false;
      let hasUnsupportedFile = false;
      let hasOversizedFile = false;
      let hasDuplicateFile = false;
      let hasExceededLimit = false;

      inputFiles.forEach((file) => {
        const kind = getInlineFileType(file);

        if (LEGACY_OFFICE_FILE_TYPES.has(kind)) {
          hasLegacyOfficeFile = true;
          return;
        }

        if (!SUPPORTED_INLINE_FILE_TYPES.has(kind)) {
          hasUnsupportedFile = true;
          return;
        }

        if (file.size > MAX_PLAYGROUND_ATTACHMENT_SIZE) {
          hasOversizedFile = true;
          return;
        }

        const signature = buildInlineFileSignature(file, kind);
        if (existingSignatures.has(signature) || nextSignatures.has(signature)) {
          hasDuplicateFile = true;
          return;
        }

        if (
          selectedInlineFiles.length + attachmentsToAdd.length >=
          MAX_PLAYGROUND_INLINE_FILES
        ) {
          hasExceededLimit = true;
          return;
        }

        nextSignatures.add(signature);
        attachmentsToAdd.push({
          id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          kind,
          name: file.name,
          size: file.size,
          status: FILE_ATTACHMENT_STATUS.LOADING,
          text: '',
          error: null,
        });
      });

      if (hasLegacyOfficeFile) {
        Toast.warning({
          content: t('暂不支持 DOC 或 XLS 文件，请转换为 DOCX 或 XLSX 后上传'),
          duration: 4,
        });
      }
      if (hasUnsupportedFile) {
        Toast.error({
          content: t('仅支持 PDF、DOCX、XLSX、TXT、JSON 文件'),
          duration: 2,
        });
      }
      if (hasOversizedFile) {
        Toast.error({
          content: t('文件不能超过 20MB'),
          duration: 3,
        });
      }
      if (hasDuplicateFile) {
        Toast.warning({
          content: t('已跳过重复文件'),
          duration: 2,
        });
      }
      if (hasExceededLimit) {
        Toast.warning({
          content: t('最多只能选择 {{count}} 个文件', {
            count: MAX_PLAYGROUND_INLINE_FILES,
          }),
          duration: 3,
        });
      }

      if (attachmentsToAdd.length === 0) {
        return;
      }

      setSelectedInlineFiles((prevFiles) => [...prevFiles, ...attachmentsToAdd]);
      Toast.success({
        content:
          attachmentsToAdd.length === 1
            ? t('文件已添加')
            : t('已添加 {{count}} 个文件', { count: attachmentsToAdd.length }),
        duration: 2,
      });

      await Promise.all(
        attachmentsToAdd.map(async (attachment) => {
          try {
            const result = await extractInlineFileText(
              attachment.file,
              attachment.kind,
            );

            if (!result.text || result.text.trim() === '') {
              setSelectedInlineFiles((prevFiles) =>
                prevFiles.map((item) =>
                  item.id === attachment.id
                    ? {
                        ...item,
                        status: FILE_ATTACHMENT_STATUS.ERROR,
                        error: 'empty',
                      }
                    : item,
                ),
              );
              Toast.error({
                content: t('未能从文件中提取文本'),
                duration: 3,
              });
              return;
            }

            setSelectedInlineFiles((prevFiles) =>
              prevFiles.map((item) =>
                item.id === attachment.id
                  ? {
                      ...item,
                      status: FILE_ATTACHMENT_STATUS.READY,
                      text: result.text,
                      pageCount: result.pageCount,
                      sheetCount: result.sheetCount,
                      truncated: result.truncated,
                      error: null,
                    }
                  : item,
              ),
            );
          } catch (error) {
            console.error('读取文件失败:', error);
            setSelectedInlineFiles((prevFiles) =>
              prevFiles.map((item) =>
                item.id === attachment.id
                  ? {
                      ...item,
                      status: FILE_ATTACHMENT_STATUS.ERROR,
                      error,
                    }
                  : item,
              ),
            );
            Toast.error({
              content: t('读取文件失败，请重新选择文件'),
              duration: 3,
            });
          }
        }),
      );
    },
    [selectedInlineFiles, t],
  );

  const handleRemoveInlineFile = useCallback((indexToRemove) => {
    setSelectedInlineFiles((prevFiles) =>
      prevFiles.filter((_, index) => index !== indexToRemove),
    );
  }, []);

  // Playground Context 值
  const playgroundContextValue = {
    onPasteImage: handlePasteImage,
    onSelectImageFile: handleSelectImageFile,
    onRemoveImage: handleRemoveImage,
    onSelectInlineFile: handleSelectInlineFile,
    onRemoveInlineFile: handleRemoveInlineFile,
    imageUrls: inputs.imageUrls || [],
    imageEnabled: inputs.imageEnabled || false,
    selectedInlineFiles,
    maxInlineFileCount: MAX_PLAYGROUND_INLINE_FILES,
  };

  return (
    <PlaygroundProvider value={playgroundContextValue}>
      <div className='new-playground-page'>
        <PlaygroundSidebar
          conversations={conversations}
          playgroundMode={playgroundMode}
          activeConversationId={activeConversationId}
          collapsed={sidebarCollapsed && !isMobile}
          isMobile={isMobile}
          mobileOpen={mobileSidebarOpen}
          onNewChat={guardedNewConversation}
          onOpenSettings={() => setShowSettings(true)}
          onSelectConversation={guardedSwitchConversation}
          onDeleteConversation={guardedDeleteConversation}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
          onMobileOpen={() => setMobileSidebarOpen(true)}
          onMobileClose={() => setMobileSidebarOpen(false)}
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
            onModeChange={guardedModeChange}
            onMessageSend={onMessageSend}
            onMessageCopy={messageActions.handleMessageCopy}
            onMessageReset={messageActions.handleMessageReset}
            onMessageDelete={messageActions.handleMessageDelete}
            onStopGenerator={handleStopGeneration}
            onClearMessages={guardedClearMessages}
            renderCustomChatContent={renderCustomChatContent}
            renderChatBoxAction={renderChatBoxAction}
          />
        </main>
      </div>
    </PlaygroundProvider>
  );
};

function useMemoizedCallback(callback) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args) => callbackRef.current?.(...args), []);
}

export default function Playground() {
  return <PlaygroundPage />;
}
