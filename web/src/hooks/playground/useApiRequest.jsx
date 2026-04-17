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

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SSE } from 'sse.js';
import {
  API_ENDPOINTS,
  MESSAGE_STATUS,
  DEBUG_TABS,
} from '../../constants/playground.constants';
import {
  getUserIdFromLocalStorage,
  handleApiError,
  processThinkTags,
  processIncompleteThinkTags,
} from '../../helpers';

const GROK_IMAGE_GENERATION_MODELS = new Set([
  'grok-imagine-1.0',
  'grok-imagine-1.0-fast',
]);
const GROK_IMAGE_EDIT_MODELS = new Set(['grok-imagine-1.0-edit']);
const ADOBE_IMAGE_MODELS = new Set([
  'nano-banana',
  'nano-banana2',
  'nano-banana-pro',
]);
const normalizeGrokImageSize = (size) => {
  if (size === '1536x1024') {
    return '1792x1024';
  }
  if (size === '1024x1536') {
    return '1024x1792';
  }
  return size;
};

export const useApiRequest = (
  setMessage,
  setDebugData,
  setActiveDebugTab,
  sseSourceRef,
  saveMessages,
) => {
  const { t } = useTranslation();

  const isGrokImagineImageModel = useCallback((model) => {
    return (
      GROK_IMAGE_GENERATION_MODELS.has(model) || GROK_IMAGE_EDIT_MODELS.has(model)
    );
  }, []);

  const isGrokImagineImageEditModel = useCallback((model) => {
    return GROK_IMAGE_EDIT_MODELS.has(model);
  }, []);

  const isAdobeImageModel = useCallback((model) => {
    return ADOBE_IMAGE_MODELS.has(model);
  }, []);

  const isVideoGenerationPayload = useCallback((payload) => {
    const model = payload?.model;
    return typeof model === 'string' && model.includes('video');
  }, []);

  const isImageGenerationPayload = useCallback(
    (payload) => {
      const model = payload?.model;
      return typeof model === 'string' && isGrokImagineImageModel(model);
    },
    [isGrokImagineImageModel],
  );

  const getTextFromMessageContent = useCallback((content) => {
    if (typeof content === 'string') {
      return content;
    }
    if (!content || typeof content !== 'object') {
      return '';
    }

    const collectTextFragments = (value, visited = new WeakSet()) => {
      if (typeof value === 'string') {
        return value.trim() ? [value] : [];
      }
      if (Array.isArray(value)) {
        return value.flatMap((item) => collectTextFragments(item, visited));
      }
      if (!value || typeof value !== 'object' || visited.has(value)) {
        return [];
      }
      visited.add(value);

      const fragments = [];
      const append = (nextValue) => {
        collectTextFragments(nextValue, visited).forEach((fragment) => {
          if (fragment.trim()) {
            fragments.push(fragment);
          }
        });
      };

      [
        'text',
        'output_text',
        'content',
        'message',
        'response',
        'result',
        'answer',
        'value',
        'outputText',
        'responseText',
        'content_text',
        'text_content',
        'refusal',
      ].forEach((key) => {
        if (value[key] !== undefined && value[key] !== null) {
          append(value[key]);
        }
      });

      ['delta', 'parts', 'segments', 'items', 'output', 'outputs'].forEach((key) => {
        if (value[key] && typeof value[key] === 'object') {
          append(value[key]);
        }
      });

      return [...new Set(fragments)];
    };

    return collectTextFragments(content).join('\n');
  }, []);

  const getImageFromMessageContent = useCallback((content) => {
    if (!Array.isArray(content)) {
      return '';
    }
    const imageItem = content.find((item) => item?.type === 'image_url');
    if (!imageItem) {
      return '';
    }
    const imageURL = imageItem.image_url;
    if (typeof imageURL === 'string') {
      return imageURL;
    }
    return imageURL?.url || '';
  }, []);

  const getImagesFromMessageContent = useCallback((content) => {
    if (!Array.isArray(content)) {
      return [];
    }
    return content
      .filter((item) => item?.type === 'image_url')
      .map((item) => {
        const imageURL = item?.image_url;
        if (typeof imageURL === 'string') {
          return imageURL;
        }
        return imageURL?.url || '';
      })
      .filter(Boolean);
  }, []);

  const extractImageUrlsFromContent = useCallback((content) => {
    if (typeof content !== 'string' || !content.trim()) {
      return [];
    }

    const matches = [
      ...content.matchAll(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/gi),
      ...content.matchAll(/\[[^\]]*]\((https?:\/\/[^)\s]+)\)/gi),
      ...content.matchAll(/(https?:\/\/[^\s'"]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s'"]*)?)/gi),
    ];

    return [...new Set(matches.map((match) => match[1]).filter(Boolean))];
  }, []);

  const extractImageUrlsFromResponse = useCallback(
    (data) => {
      const directUrls = (Array.isArray(data?.data) ? data.data : [])
        .map((item) => item?.url)
        .filter((item) => typeof item === 'string' && item.trim() !== '');
      if (directUrls.length > 0) {
        return directUrls;
      }

      const messageContent = data?.choices?.[0]?.message?.content;
      if (typeof messageContent === 'string') {
        return extractImageUrlsFromContent(messageContent);
      }
      if (Array.isArray(messageContent)) {
        return messageContent
          .filter((item) => item?.type === 'image_url')
          .map((item) => {
            const imageURL = item?.image_url;
            if (typeof imageURL === 'string') {
              return imageURL;
            }
            return imageURL?.url || '';
          })
          .filter(Boolean);
      }

      return [];
    },
    [extractImageUrlsFromContent],
  );

  const normalizeVideoQuality = useCallback((quality) => {
    if (quality === '720p') {
      return 'high';
    }
    if (quality === '480p') {
      return 'standard';
    }
    return quality;
  }, []);

  const formatVideoQuality = useCallback((quality) => {
    if (quality === 'high' || quality === '720p') {
      return '720p';
    }
    if (quality === 'standard' || quality === '480p') {
      return '480p';
    }
    return quality || '';
  }, []);

  const buildVideoRequestPayload = useCallback(
    (payload) => {
      const messages = Array.isArray(payload?.messages) ? payload.messages : [];
      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m?.role === 'user');
      const prompt = getTextFromMessageContent(lastUserMessage?.content);
      const images = getImagesFromMessageContent(lastUserMessage?.content);
      const size = payload?.size || payload?.videoSize;
      const seconds = payload?.seconds || payload?.videoSeconds;
      const quality = payload?.quality || payload?.videoQuality;
      const preset = payload?.preset || payload?.videoPreset;
      const isGrokImagineVideoModel = payload?.model === 'grok-imagine-1.0-video';
      const resolutionName =
        payload?.resolution_name ||
        (isGrokImagineVideoModel ? formatVideoQuality(quality) : '');

      const requestPayload = {
        model: payload.model,
        prompt,
        seconds,
        size,
        quality: normalizeVideoQuality(quality),
        preset,
      };

      if (isGrokImagineVideoModel) {
        if (images.length > 0) {
          requestPayload.image_reference = images;
        }
      } else if (images[0]) {
        requestPayload.image = images[0];
      }

      if (isGrokImagineVideoModel && resolutionName) {
        requestPayload.resolution_name = resolutionName;
        requestPayload.video_config = {
          resolution_name: resolutionName,
          ...(preset ? { preset } : {}),
        };
      }

      return requestPayload;
    },
    [
      formatVideoQuality,
      getImagesFromMessageContent,
      getTextFromMessageContent,
      normalizeVideoQuality,
    ],
  );

  const buildImageRequestPayload = useCallback(
    (payload) => {
      const messages = Array.isArray(payload?.messages) ? payload.messages : [];
      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m?.role === 'user');
      const prompt = getTextFromMessageContent(lastUserMessage?.content);
      const images = getImagesFromMessageContent(lastUserMessage?.content);
      const resolvedPrompt =
        prompt ||
        (isGrokImagineImageEditModel(payload.model)
          ? 'Edit the provided media.'
          : '');
      const size = normalizeGrokImageSize(payload?.size || payload?.imageSize);
      const requestPayload = {
        model: payload.model,
        group: payload.group,
      };

      if (isGrokImagineImageEditModel(payload.model)) {
        requestPayload.prompt = resolvedPrompt;
        requestPayload.n = 1;
        requestPayload.response_format = 'url';
        if (images.length === 1) {
          requestPayload.image = images[0];
        } else if (images.length > 1) {
          requestPayload.image = images;
        }
      } else {
        requestPayload.prompt = resolvedPrompt;
        requestPayload.n = 1;
        requestPayload.response_format = 'url';
        if (size) {
          requestPayload.size = size;
        }
      }

      return requestPayload;
    },
    [
      getImagesFromMessageContent,
      getTextFromMessageContent,
      isGrokImagineImageEditModel,
    ],
  );

  const extractVideoUrl = useCallback((payload) => {
    if (!payload || typeof payload !== 'object') {
      return '';
    }

    const candidates = [
      payload.url,
      payload.video_url,
      payload.result_url,
      payload.metadata?.url,
      payload.data?.url,
      payload.data?.video_url,
      payload.data?.result_url,
      payload.data?.[0]?.url,
      payload.data?.[0]?.video_url,
      payload.data?.metadata?.url,
    ];

    const matched = candidates.find(
      (item) => typeof item === 'string' && item.trim() !== '',
    );

    return matched?.trim() || '';
  }, []);

  const resolveEndpointAndPayload = useCallback(
    (payload) => {
      if (isImageGenerationPayload(payload)) {
        const requestPayload = buildImageRequestPayload(payload);
        return {
          endpoint: isGrokImagineImageEditModel(payload?.model)
            ? API_ENDPOINTS.IMAGE_EDITS
            : API_ENDPOINTS.IMAGE_GENERATIONS,
          requestPayload,
          forceNonStream: true,
        };
      }
      if (isAdobeImageModel(payload?.model)) {
        return {
          endpoint: API_ENDPOINTS.CHAT_COMPLETIONS,
          requestPayload: {
            ...payload,
            stream: false,
          },
          forceNonStream: true,
        };
      }
      if (isVideoGenerationPayload(payload)) {
        return {
          endpoint: API_ENDPOINTS.VIDEO_GENERATIONS,
          requestPayload: buildVideoRequestPayload(payload),
          forceNonStream: true,
        };
      }
      return {
        endpoint: API_ENDPOINTS.CHAT_COMPLETIONS,
        requestPayload: payload,
        forceNonStream: false,
      };
    },
    [
      buildImageRequestPayload,
      buildVideoRequestPayload,
      isAdobeImageModel,
      isGrokImagineImageEditModel,
      isImageGenerationPayload,
      isVideoGenerationPayload,
    ],
  );

  // 处理消息自动关闭逻辑的公共函数
  const applyAutoCollapseLogic = useCallback(
    (message, isThinkingComplete = true) => {
      const shouldAutoCollapse =
        isThinkingComplete && !message.hasAutoCollapsed;
      return {
        isThinkingComplete,
        hasAutoCollapsed: shouldAutoCollapse || message.hasAutoCollapsed,
        isReasoningExpanded: shouldAutoCollapse
          ? false
          : message.isReasoningExpanded,
      };
    },
    [],
  );

  // 流式消息更新
  const streamMessageUpdate = useCallback(
    (textChunk, type) => {
      setMessage((prevMessage) => {
        const lastMessage = prevMessage[prevMessage.length - 1];
        if (!lastMessage) return prevMessage;
        if (lastMessage.role !== 'assistant') return prevMessage;
        if (lastMessage.status === MESSAGE_STATUS.ERROR) {
          return prevMessage;
        }

        if (
          lastMessage.status === MESSAGE_STATUS.LOADING ||
          lastMessage.status === MESSAGE_STATUS.INCOMPLETE
        ) {
          let newMessage = { ...lastMessage };

          if (type === 'reasoning') {
            newMessage = {
              ...newMessage,
              reasoningContent:
                (lastMessage.reasoningContent || '') + textChunk,
              status: MESSAGE_STATUS.INCOMPLETE,
              isThinkingComplete: false,
            };
          } else if (type === 'content') {
            const shouldCollapseReasoning =
              !lastMessage.content && lastMessage.reasoningContent;
            const newContent = (lastMessage.content || '') + textChunk;

            let shouldCollapseFromThinkTag = false;
            let thinkingCompleteFromTags = lastMessage.isThinkingComplete;

            if (
              lastMessage.isReasoningExpanded &&
              newContent.includes('</think>')
            ) {
              const thinkMatches = newContent.match(/<think>/g);
              const thinkCloseMatches = newContent.match(/<\/think>/g);
              if (
                thinkMatches &&
                thinkCloseMatches &&
                thinkCloseMatches.length >= thinkMatches.length
              ) {
                shouldCollapseFromThinkTag = true;
                thinkingCompleteFromTags = true; // think标签闭合也标记思考完成
              }
            }

            // 如果开始接收content内容，且之前有reasoning内容，或者think标签已闭合，则标记思考完成
            const isThinkingComplete =
              (lastMessage.reasoningContent &&
                !lastMessage.isThinkingComplete) ||
              thinkingCompleteFromTags;

            const autoCollapseState = applyAutoCollapseLogic(
              lastMessage,
              isThinkingComplete,
            );

            newMessage = {
              ...newMessage,
              content: newContent,
              status: MESSAGE_STATUS.INCOMPLETE,
              ...autoCollapseState,
            };
          }

          return [...prevMessage.slice(0, -1), newMessage];
        }

        return prevMessage;
      });
    },
    [setMessage, applyAutoCollapseLogic],
  );

  // 完成消息
  const completeMessage = useCallback(
    (status = MESSAGE_STATUS.COMPLETE) => {
      setMessage((prevMessage) => {
        const lastMessage = prevMessage[prevMessage.length - 1];
        if (
          lastMessage.status === MESSAGE_STATUS.COMPLETE ||
          lastMessage.status === MESSAGE_STATUS.ERROR
        ) {
          return prevMessage;
        }

        const autoCollapseState = applyAutoCollapseLogic(lastMessage, true);

        const updatedMessages = [
          ...prevMessage.slice(0, -1),
          {
            ...lastMessage,
            status: status,
            ...autoCollapseState,
          },
        ];

        // 在消息完成时保存，传入更新后的消息列表
        if (
          status === MESSAGE_STATUS.COMPLETE ||
          status === MESSAGE_STATUS.ERROR
        ) {
          setTimeout(() => saveMessages(updatedMessages), 0);
        }

        return updatedMessages;
      });
    },
    [setMessage, applyAutoCollapseLogic, saveMessages],
  );

  // 非流式请求
  const handleNonStreamRequest = useCallback(
    async (payload) => {
      const { endpoint, requestPayload } = resolveEndpointAndPayload(payload);
      setDebugData((prev) => ({
        ...prev,
        request: requestPayload,
        timestamp: new Date().toISOString(),
        response: null,
        sseMessages: null, // 非流式请求清除 SSE 消息
        isStreaming: false,
      }));
      setActiveDebugTab(DEBUG_TABS.REQUEST);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'New-Api-User': getUserIdFromLocalStorage(),
          },
          body: JSON.stringify(requestPayload),
        });

        if (!response.ok) {
          let errorBody = '';
          try {
            errorBody = await response.text();
          } catch (e) {
            errorBody = '无法读取错误响应体';
          }

          const errorInfo = handleApiError(
            new Error(
              `HTTP error! status: ${response.status}, body: ${errorBody}`,
            ),
            response,
          );

          setDebugData((prev) => ({
            ...prev,
            response: JSON.stringify(errorInfo, null, 2),
          }));
          setActiveDebugTab(DEBUG_TABS.RESPONSE);

          throw new Error(
            `HTTP error! status: ${response.status}, body: ${errorBody}`,
          );
        }

        const data = await response.json();

        setDebugData((prev) => ({
          ...prev,
          response: JSON.stringify(data, null, 2),
        }));
        setActiveDebugTab(DEBUG_TABS.RESPONSE);

        if (
          endpoint === API_ENDPOINTS.VIDEO_GENERATIONS ||
          data.object === 'video' ||
          data.task_id
        ) {
          const videoUrl = extractVideoUrl(data);
          const requestedQuality = formatVideoQuality(requestPayload.quality);
          const upstreamQuality = formatVideoQuality(data.quality);
          const summary = [
            `${t('视频任务已创建')}`,
            `task_id: ${data.task_id || data.id || '-'}`,
            `status: ${data.status || '-'}`,
            `seconds: ${data.seconds || requestPayload.seconds || '-'}`,
            `size: ${data.size || requestPayload.size || '-'}`,
            `quality: ${requestedQuality || upstreamQuality || '-'}`,
            ...(upstreamQuality && upstreamQuality !== requestedQuality
              ? [`upstream_quality: ${upstreamQuality}`]
              : []),
            ...(requestPayload.preset ? [`preset: ${requestPayload.preset}`] : []),
            ...(videoUrl
              ? [`url: \`${videoUrl}\``, `[Open Video](${videoUrl})`]
              : []),
          ].join('\n');
          setMessage((prevMessage) => {
            const newMessages = [...prevMessage];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage?.status === MESSAGE_STATUS.LOADING) {
              const autoCollapseState = applyAutoCollapseLogic(
                lastMessage,
                true,
              );
              newMessages[newMessages.length - 1] = {
                ...lastMessage,
                content: summary,
                status: MESSAGE_STATUS.COMPLETE,
                ...autoCollapseState,
              };
            }
            return newMessages;
          });
          return;
        }

        if (
          endpoint === API_ENDPOINTS.IMAGE_GENERATIONS ||
          endpoint === API_ENDPOINTS.IMAGE_EDITS ||
          Array.isArray(data.data)
        ) {
          const imageUrls = (Array.isArray(data.data) ? data.data : [])
            .map((item) => item?.url)
            .filter((item) => typeof item === 'string' && item.trim() !== '');

          const summaryLines = [
            endpoint === API_ENDPOINTS.IMAGE_EDITS
              ? t('图片编辑已完成')
              : t('图片任务已完成'),
            `model: ${requestPayload.model || payload?.model || '-'}`,
            `count: ${imageUrls.length || data.data?.length || 0}`,
            `size: ${requestPayload.size || '-'}`,
          ];

          imageUrls.forEach((url, index) => {
            summaryLines.push(`image_${index + 1}: [Open Image ${index + 1}](${url})`);
            summaryLines.push(`![image_${index + 1}](${url})`);
          });

          if (imageUrls.length === 0) {
            summaryLines.push(t('未在响应中解析到图片链接'));
          }

          setMessage((prevMessage) => {
            const newMessages = [...prevMessage];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage?.status === MESSAGE_STATUS.LOADING) {
              const autoCollapseState = applyAutoCollapseLogic(
                lastMessage,
                true,
              );
              newMessages[newMessages.length - 1] = {
                ...lastMessage,
                content: summaryLines.join('\n\n'),
                status: MESSAGE_STATUS.COMPLETE,
                ...autoCollapseState,
              };
            }
            return newMessages;
          });
          return;
        }

        if (data.choices?.[0]) {
          const choice = data.choices[0];
          let content =
            getTextFromMessageContent(choice.message?.content) ||
            getTextFromMessageContent(choice.message) ||
            getTextFromMessageContent(choice);
          let reasoningContent =
            getTextFromMessageContent(choice.message?.reasoning_content) ||
            getTextFromMessageContent(choice.message?.reasoning) ||
            getTextFromMessageContent(choice.reasoning_content) ||
            getTextFromMessageContent(choice.reasoning);

          if (
            isGrokImagineImageEditModel(payload?.model) ||
            isAdobeImageModel(payload?.model)
          ) {
            const imageUrls = extractImageUrlsFromResponse(data);
            if (imageUrls.length > 0) {
              const summaryLines = [
                isGrokImagineImageEditModel(payload?.model)
                  ? t('图片编辑已完成')
                  : t('图片任务已完成'),
                `model: ${requestPayload.model || payload?.model || '-'}`,
                `count: ${imageUrls.length}`,
                isAdobeImageModel(payload?.model)
                  ? `aspect_ratio: ${requestPayload.aspect_ratio || '-'}`
                  : `size: ${requestPayload.image_config?.size || requestPayload.size || '-'}`,
              ];

              if (isAdobeImageModel(payload?.model)) {
                summaryLines.push(
                  `output_resolution: ${requestPayload.output_resolution || '-'}`,
                );
              }

              imageUrls.forEach((url, index) => {
                summaryLines.push(`image_${index + 1}: [Open Image ${index + 1}](${url})`);
                summaryLines.push(`![image_${index + 1}](${url})`);
              });

              setMessage((prevMessage) => {
                const newMessages = [...prevMessage];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage?.status === MESSAGE_STATUS.LOADING) {
                  const autoCollapseState = applyAutoCollapseLogic(
                    lastMessage,
                    true,
                  );
                  newMessages[newMessages.length - 1] = {
                    ...lastMessage,
                    content: summaryLines.join('\n\n'),
                    status: MESSAGE_STATUS.COMPLETE,
                    ...autoCollapseState,
                  };
                }
                return newMessages;
              });
              return;
            }
          }

          const processed = processThinkTags(content, reasoningContent);

          setMessage((prevMessage) => {
            const newMessages = [...prevMessage];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage?.status === MESSAGE_STATUS.LOADING) {
              const autoCollapseState = applyAutoCollapseLogic(
                lastMessage,
                true,
              );

              newMessages[newMessages.length - 1] = {
                ...lastMessage,
                content: processed.content,
                reasoningContent: processed.reasoningContent,
                status: MESSAGE_STATUS.COMPLETE,
                ...autoCollapseState,
              };
            }
            return newMessages;
          });
        }
      } catch (error) {
        console.error('Non-stream request error:', error);

        const errorInfo = handleApiError(error);
        setDebugData((prev) => ({
          ...prev,
          response: JSON.stringify(errorInfo, null, 2),
        }));
        setActiveDebugTab(DEBUG_TABS.RESPONSE);

        setMessage((prevMessage) => {
          const newMessages = [...prevMessage];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage?.status === MESSAGE_STATUS.LOADING) {
            const autoCollapseState = applyAutoCollapseLogic(lastMessage, true);

            newMessages[newMessages.length - 1] = {
              ...lastMessage,
              content: t('请求发生错误: ') + error.message,
              status: MESSAGE_STATUS.ERROR,
              ...autoCollapseState,
            };
          }
          return newMessages;
        });
      }
    },
    [
      resolveEndpointAndPayload,
      setDebugData,
      setActiveDebugTab,
      setMessage,
      t,
      extractVideoUrl,
      extractImageUrlsFromResponse,
      formatVideoQuality,
      applyAutoCollapseLogic,
      isAdobeImageModel,
      isGrokImagineImageEditModel,
    ],
  );

  // SSE请求
  const handleSSE = useCallback(
    (payload) => {
      setDebugData((prev) => ({
        ...prev,
        request: payload,
        timestamp: new Date().toISOString(),
        response: null,
        sseMessages: [], // 新增：存储 SSE 消息数组
        isStreaming: true, // 新增：标记流式状态
      }));
      setActiveDebugTab(DEBUG_TABS.REQUEST);

      const source = new SSE(API_ENDPOINTS.CHAT_COMPLETIONS, {
        headers: {
          'Content-Type': 'application/json',
          'New-Api-User': getUserIdFromLocalStorage(),
        },
        method: 'POST',
        payload: JSON.stringify(payload),
      });

      sseSourceRef.current = source;

      let responseData = '';
      let hasReceivedFirstResponse = false;
      let isStreamComplete = false; // 添加标志位跟踪流是否正常完成

      source.addEventListener('message', (e) => {
        if (e.data === '[DONE]') {
          isStreamComplete = true; // 标记流正常完成
          source.close();
          sseSourceRef.current = null;
          setDebugData((prev) => ({
            ...prev,
            response: responseData,
            sseMessages: [...(prev.sseMessages || []), '[DONE]'], // 添加 DONE 标记
            isStreaming: false,
          }));
          completeMessage();
          return;
        }

        try {
          const payload = JSON.parse(e.data);
          responseData += e.data + '\n';

          if (!hasReceivedFirstResponse) {
            setActiveDebugTab(DEBUG_TABS.RESPONSE);
            hasReceivedFirstResponse = true;
          }

          // 新增：将 SSE 消息添加到数组
          setDebugData((prev) => ({
            ...prev,
            sseMessages: [...(prev.sseMessages || []), e.data],
          }));

          const delta = payload.choices?.[0]?.delta;
          if (delta) {
            if (delta.reasoning_content) {
              streamMessageUpdate(delta.reasoning_content, 'reasoning');
            }
            if (delta.reasoning) {
              streamMessageUpdate(delta.reasoning, 'reasoning');
            }
            if (delta.content) {
              streamMessageUpdate(delta.content, 'content');
            }
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
          const errorInfo = `解析错误: ${error.message}`;

          setDebugData((prev) => ({
            ...prev,
            response: responseData + `\n\nError: ${errorInfo}`,
            sseMessages: [...(prev.sseMessages || []), e.data], // 即使解析失败也保存原始数据
            isStreaming: false,
          }));
          setActiveDebugTab(DEBUG_TABS.RESPONSE);

          streamMessageUpdate(t('解析响应数据时发生错误'), 'content');
          completeMessage(MESSAGE_STATUS.ERROR);
        }
      });

      source.addEventListener('error', (e) => {
        // 只有在流没有正常完成且连接状态异常时才处理错误
        if (!isStreamComplete && source.readyState !== 2) {
          console.error('SSE Error:', e);
          const errorMessage = e.data || t('请求发生错误');

          const errorInfo = handleApiError(new Error(errorMessage));
          errorInfo.readyState = source.readyState;

          setDebugData((prev) => ({
            ...prev,
            response:
              responseData +
              '\n\nSSE Error:\n' +
              JSON.stringify(errorInfo, null, 2),
          }));
          setActiveDebugTab(DEBUG_TABS.RESPONSE);

          streamMessageUpdate(errorMessage, 'content');
          completeMessage(MESSAGE_STATUS.ERROR);
          sseSourceRef.current = null;
          source.close();
        }
      });

      source.addEventListener('readystatechange', (e) => {
        // 检查 HTTP 状态错误，但避免与正常关闭重复处理
        if (
          e.readyState >= 2 &&
          source.status !== undefined &&
          source.status !== 200 &&
          !isStreamComplete
        ) {
          const errorInfo = handleApiError(new Error('HTTP状态错误'));
          errorInfo.status = source.status;
          errorInfo.readyState = source.readyState;

          setDebugData((prev) => ({
            ...prev,
            response:
              responseData +
              '\n\nHTTP Error:\n' +
              JSON.stringify(errorInfo, null, 2),
          }));
          setActiveDebugTab(DEBUG_TABS.RESPONSE);

          source.close();
          streamMessageUpdate(t('连接已断开'), 'content');
          completeMessage(MESSAGE_STATUS.ERROR);
        }
      });

      try {
        source.stream();
      } catch (error) {
        console.error('Failed to start SSE stream:', error);
        const errorInfo = handleApiError(error);

        setDebugData((prev) => ({
          ...prev,
          response: 'Stream启动失败:\n' + JSON.stringify(errorInfo, null, 2),
        }));
        setActiveDebugTab(DEBUG_TABS.RESPONSE);

        streamMessageUpdate(t('建立连接时发生错误'), 'content');
        completeMessage(MESSAGE_STATUS.ERROR);
      }
    },
    [
      setDebugData,
      setActiveDebugTab,
      streamMessageUpdate,
      completeMessage,
      t,
      applyAutoCollapseLogic,
    ],
  );

  // 停止生成
  const onStopGenerator = useCallback(() => {
    // 如果仍有活动的 SSE 连接，首先关闭
    if (sseSourceRef.current) {
      sseSourceRef.current.close();
      sseSourceRef.current = null;
    }

    // 无论是否存在 SSE 连接，都尝试处理最后一条正在生成的消息
    setMessage((prevMessage) => {
      if (prevMessage.length === 0) return prevMessage;
      const lastMessage = prevMessage[prevMessage.length - 1];

      if (
        lastMessage.status === MESSAGE_STATUS.LOADING ||
        lastMessage.status === MESSAGE_STATUS.INCOMPLETE
      ) {
        const processed = processIncompleteThinkTags(
          lastMessage.content || '',
          lastMessage.reasoningContent || '',
        );

        const autoCollapseState = applyAutoCollapseLogic(lastMessage, true);

        const updatedMessages = [
          ...prevMessage.slice(0, -1),
          {
            ...lastMessage,
            status: MESSAGE_STATUS.COMPLETE,
            reasoningContent: processed.reasoningContent || null,
            content: processed.content,
            ...autoCollapseState,
          },
        ];

        // 停止生成时也保存，传入更新后的消息列表
        setTimeout(() => saveMessages(updatedMessages), 0);

        return updatedMessages;
      }
      return prevMessage;
    });
  }, [setMessage, applyAutoCollapseLogic, saveMessages]);

  // 发送请求
  const sendRequest = useCallback(
    (payload, isStream) => {
      const { forceNonStream } = resolveEndpointAndPayload(payload);
      if (isStream && !forceNonStream) {
        handleSSE(payload);
      } else {
        handleNonStreamRequest(payload);
      }
    },
    [resolveEndpointAndPayload, handleSSE, handleNonStreamRequest],
  );

  return {
    sendRequest,
    onStopGenerator,
    streamMessageUpdate,
    completeMessage,
  };
};
