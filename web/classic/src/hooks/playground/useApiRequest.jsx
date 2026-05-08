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
  MESSAGE_STATUS,
  DEBUG_TABS,
  PLAYGROUND_ENDPOINTS,
} from '../../constants/playground.constants';
import {
  getUserIdFromLocalStorage,
  getPlaygroundEndpointUrl,
  handleApiError,
  processThinkTags,
  processIncompleteThinkTags,
} from '../../helpers';

const extractTextFromContent = (content) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      if (typeof part.text === 'string') return part.text;
      if (typeof part.content === 'string') return part.content;
      if (part.type === 'text' && typeof part.value === 'string') return part.value;
      return '';
    })
    .filter(Boolean)
    .join('\n');
};

const extractImages = (value) => {
  const images = [];

  const visit = (node) => {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    const maybeImage = {};
    if (typeof node.url === 'string') maybeImage.url = node.url;
    if (typeof node.image_url === 'string') maybeImage.url = node.image_url;
    if (typeof node.b64_json === 'string') maybeImage.b64_json = node.b64_json;
    if (typeof node.result === 'string') maybeImage.b64_json = node.result;
    if (typeof node.mime_type === 'string') maybeImage.mime_type = node.mime_type;

    if (maybeImage.url || maybeImage.b64_json) {
      images.push(maybeImage);
    }

    Object.values(node).forEach(visit);
  };

  visit(value);
  return images;
};

const normalizePlaygroundResponse = (endpoint, response) => {
  if (endpoint === PLAYGROUND_ENDPOINTS.RESPONSES) {
    const images = extractImages(response?.output);
    if (typeof response?.output_text === 'string' && response.output_text) {
      return { content: response.output_text, images };
    }

    const output = Array.isArray(response?.output) ? response.output : [];
    const content = output
      .map((item) => extractTextFromContent(item?.content))
      .filter(Boolean)
      .join('\n');
    return { content, images };
  }

  if (endpoint === PLAYGROUND_ENDPOINTS.CLAUDE_MESSAGES) {
    const content = extractTextFromContent(response?.content);
    const reasoning = Array.isArray(response?.content)
      ? response.content
          .map((part) => {
            if (!part || typeof part !== 'object') return '';
            if (
              (part.type === 'thinking' || part.type === 'reasoning') &&
              typeof part.thinking === 'string'
            ) {
              return part.thinking;
            }
            if (
              (part.type === 'thinking' || part.type === 'reasoning') &&
              typeof part.text === 'string'
            ) {
              return part.text;
            }
            return '';
          })
          .filter(Boolean)
          .join('\n')
      : '';
    return { content, reasoning };
  }

  if (endpoint === PLAYGROUND_ENDPOINTS.IMAGE_GENERATIONS) {
    return { content: '', images: extractImages(response?.data) };
  }

  const choice = response?.choices?.[0];
  return {
    content: choice?.message?.content || '',
    reasoning:
      choice?.message?.reasoning_content || choice?.message?.reasoning || '',
  };
};

export const useApiRequest = (
  setMessage,
  setDebugData,
  setActiveDebugTab,
  sseSourceRef,
  saveMessages,
) => {
  const { t } = useTranslation();

  const applyAutoCollapseLogic = useCallback((message, isThinkingComplete = true) => {
    const shouldAutoCollapse = isThinkingComplete && !message.hasAutoCollapsed;
    return {
      isThinkingComplete,
      hasAutoCollapsed: shouldAutoCollapse || message.hasAutoCollapsed,
      isReasoningExpanded: shouldAutoCollapse ? false : message.isReasoningExpanded,
    };
  }, []);

  const updateLastAssistantWithResult = useCallback(
    (result, status = MESSAGE_STATUS.COMPLETE) => {
      setMessage((prevMessage) => {
        const lastMessage = prevMessage[prevMessage.length - 1];
        if (!lastMessage || lastMessage.role !== 'assistant') return prevMessage;
        if (
          lastMessage.status === MESSAGE_STATUS.COMPLETE ||
          lastMessage.status === MESSAGE_STATUS.ERROR
        ) {
          return prevMessage;
        }

        const processed = processThinkTags(
          result?.content ?? lastMessage.content ?? '',
          result?.reasoning ?? lastMessage.reasoningContent ?? '',
        );
        const autoCollapseState = applyAutoCollapseLogic(lastMessage, true);
        const updatedMessages = [
          ...prevMessage.slice(0, -1),
          {
            ...lastMessage,
            content: processed.content,
            reasoningContent: processed.reasoningContent,
            images: result?.images?.length ? result.images : lastMessage.images,
            status,
            ...autoCollapseState,
          },
        ];

        if (status === MESSAGE_STATUS.COMPLETE || status === MESSAGE_STATUS.ERROR) {
          setTimeout(() => saveMessages(updatedMessages), 0);
        }

        return updatedMessages;
      });
    },
    [setMessage, applyAutoCollapseLogic, saveMessages],
  );

  const streamMessageUpdate = useCallback(
    (textChunk, type) => {
      setMessage((prevMessage) => {
        const lastMessage = prevMessage[prevMessage.length - 1];
        if (!lastMessage) return prevMessage;
        if (lastMessage.role !== 'assistant') return prevMessage;
        if (lastMessage.status === MESSAGE_STATUS.ERROR) return prevMessage;

        if (
          lastMessage.status === MESSAGE_STATUS.LOADING ||
          lastMessage.status === MESSAGE_STATUS.INCOMPLETE
        ) {
          let newMessage = { ...lastMessage };

          if (type === 'reasoning') {
            newMessage = {
              ...newMessage,
              reasoningContent: (lastMessage.reasoningContent || '') + textChunk,
              status: MESSAGE_STATUS.INCOMPLETE,
              isThinkingComplete: false,
            };
          } else if (type === 'content') {
            const newContent = (lastMessage.content || '') + textChunk;
            let thinkingCompleteFromTags = lastMessage.isThinkingComplete;

            if (lastMessage.isReasoningExpanded && newContent.includes('</think>')) {
              const thinkMatches = newContent.match(/<think>/g);
              const thinkCloseMatches = newContent.match(/<\/think>/g);
              if (
                thinkMatches &&
                thinkCloseMatches &&
                thinkCloseMatches.length >= thinkMatches.length
              ) {
                thinkingCompleteFromTags = true;
              }
            }

            const isThinkingComplete =
              (lastMessage.reasoningContent && !lastMessage.isThinkingComplete) ||
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
            status,
            ...autoCollapseState,
          },
        ];

        if (status === MESSAGE_STATUS.COMPLETE || status === MESSAGE_STATUS.ERROR) {
          setTimeout(() => saveMessages(updatedMessages), 0);
        }

        return updatedMessages;
      });
    },
    [setMessage, applyAutoCollapseLogic, saveMessages, t],
  );

  const handleNonStreamRequest = useCallback(
    async (payload, endpoint) => {
      setDebugData((prev) => ({
        ...prev,
        request: payload,
        timestamp: new Date().toISOString(),
        response: null,
        sseMessages: null,
        isStreaming: false,
      }));
      setActiveDebugTab(DEBUG_TABS.REQUEST);

      try {
        const response = await fetch(getPlaygroundEndpointUrl(endpoint), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'New-Api-User': getUserIdFromLocalStorage(),
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          let errorBody = '';
          let parsedError = null;
          try {
            errorBody = await response.text();
            const errorJson = JSON.parse(errorBody);
            if (errorJson?.error) parsedError = errorJson.error;
          } catch (e) {
            if (!errorBody) errorBody = '无法读取错误响应体';
          }

          const errorInfo = handleApiError(
            new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`),
            response,
          );

          setDebugData((prev) => ({
            ...prev,
            response: JSON.stringify(errorInfo, null, 2),
          }));
          setActiveDebugTab(DEBUG_TABS.RESPONSE);

          const err = new Error(
            parsedError?.message ||
              `HTTP error! status: ${response.status}, body: ${errorBody}`,
          );
          err.errorCode = parsedError?.code || null;
          err.errorType = parsedError?.type || null;
          throw err;
        }

        const data = await response.json();
        setDebugData((prev) => ({
          ...prev,
          response: JSON.stringify(data, null, 2),
        }));
        setActiveDebugTab(DEBUG_TABS.RESPONSE);

        updateLastAssistantWithResult(normalizePlaygroundResponse(endpoint, data));
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
              errorCode: error.errorCode || null,
              status: MESSAGE_STATUS.ERROR,
              ...autoCollapseState,
            };
          }
          return newMessages;
        });
      }
    },
    [
      setDebugData,
      setActiveDebugTab,
      setMessage,
      t,
      applyAutoCollapseLogic,
      updateLastAssistantWithResult,
    ],
  );

  const handleSSE = useCallback(
    (payload, endpoint) => {
      setDebugData((prev) => ({
        ...prev,
        request: payload,
        timestamp: new Date().toISOString(),
        response: null,
        sseMessages: [],
        isStreaming: true,
      }));
      setActiveDebugTab(DEBUG_TABS.REQUEST);

      const source = new SSE(getPlaygroundEndpointUrl(endpoint), {
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
      let isStreamComplete = false;

      const handleStreamData = (data, eventType) => {
        if (data === '[DONE]') {
          isStreamComplete = true;
          source.close();
          sseSourceRef.current = null;
          setDebugData((prev) => ({
            ...prev,
            response: responseData,
            sseMessages: [...(prev.sseMessages || []), '[DONE]'],
            isStreaming: false,
          }));
          completeMessage();
          return;
        }

        try {
          const parsed = JSON.parse(data);
          responseData += data + '\n';

          if (!hasReceivedFirstResponse) {
            setActiveDebugTab(DEBUG_TABS.RESPONSE);
            hasReceivedFirstResponse = true;
          }

          setDebugData((prev) => ({
            ...prev,
            sseMessages: [...(prev.sseMessages || []), data],
          }));

          if (endpoint === PLAYGROUND_ENDPOINTS.RESPONSES) {
            const type = parsed.type || eventType;
            if (
              (type === 'response.output_text.delta' ||
                type === 'response.reasoning_text.delta') &&
              typeof parsed.delta === 'string'
            ) {
              streamMessageUpdate(
                parsed.delta,
                type === 'response.reasoning_text.delta' ? 'reasoning' : 'content',
              );
            }
            if (type === 'response.completed' && parsed.response) {
              isStreamComplete = true;
              source.close();
              sseSourceRef.current = null;
              setDebugData((prev) => ({
                ...prev,
                response: responseData,
                isStreaming: false,
              }));
              updateLastAssistantWithResult(
                normalizePlaygroundResponse(PLAYGROUND_ENDPOINTS.RESPONSES, parsed.response),
              );
            }
            return;
          }

          if (endpoint === PLAYGROUND_ENDPOINTS.CLAUDE_MESSAGES) {
            const type = parsed.type || eventType;
            if (type === 'content_block_delta' && parsed.delta) {
              if (typeof parsed.delta.thinking === 'string') {
                streamMessageUpdate(parsed.delta.thinking, 'reasoning');
              }
              if (typeof parsed.delta.text === 'string') {
                streamMessageUpdate(parsed.delta.text, 'content');
              }
            }
            if (type === 'message_stop') {
              isStreamComplete = true;
              source.close();
              sseSourceRef.current = null;
              setDebugData((prev) => ({
                ...prev,
                response: responseData,
                isStreaming: false,
              }));
              completeMessage();
            }
            return;
          }

          const delta = parsed.choices?.[0]?.delta;
          if (delta) {
            if (delta.reasoning_content) streamMessageUpdate(delta.reasoning_content, 'reasoning');
            if (delta.reasoning) streamMessageUpdate(delta.reasoning, 'reasoning');
            if (delta.content) streamMessageUpdate(delta.content, 'content');
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
          const errorInfo = `解析错误: ${error.message}`;

          setDebugData((prev) => ({
            ...prev,
            response: responseData + `\n\nError: ${errorInfo}`,
            sseMessages: [...(prev.sseMessages || []), data],
            isStreaming: false,
          }));
          setActiveDebugTab(DEBUG_TABS.RESPONSE);

          streamMessageUpdate(t('解析响应数据时发生错误'), 'content');
          completeMessage(MESSAGE_STATUS.ERROR);
        }
      };

      const addDataListener = (eventName) => {
        source.addEventListener(eventName, (e) => handleStreamData(e.data, eventName));
      };

      if (endpoint === PLAYGROUND_ENDPOINTS.RESPONSES) {
        [
          'response.output_text.delta',
          'response.reasoning_text.delta',
          'response.completed',
        ].forEach(addDataListener);
      } else if (endpoint === PLAYGROUND_ENDPOINTS.CLAUDE_MESSAGES) {
        ['content_block_delta', 'message_stop'].forEach(addDataListener);
      } else {
        addDataListener('message');
      }

      source.addEventListener('error', (e) => {
        if (!isStreamComplete && source.readyState !== 2) {
          console.error('SSE Error:', e);
          let errorMessage = e.data || t('请求发生错误');
          let errorCode = null;

          if (e.data) {
            try {
              const errorJson = JSON.parse(e.data);
              if (errorJson?.error) {
                errorMessage = errorJson.error.message || errorMessage;
                errorCode = errorJson.error.code || null;
              }
            } catch (_) {}
          }

          const errorInfo = handleApiError(new Error(errorMessage));
          errorInfo.readyState = source.readyState;

          setDebugData((prev) => ({
            ...prev,
            response: responseData + '\n\nSSE Error:\n' + JSON.stringify(errorInfo, null, 2),
          }));
          setActiveDebugTab(DEBUG_TABS.RESPONSE);

          setMessage((prevMessage) => {
            const newMessages = [...prevMessage];
            const lastMessage = newMessages[newMessages.length - 1];
            if (
              lastMessage &&
              lastMessage.status !== MESSAGE_STATUS.COMPLETE &&
              lastMessage.status !== MESSAGE_STATUS.ERROR
            ) {
              newMessages[newMessages.length - 1] = {
                ...lastMessage,
                content: (lastMessage.content || '') + errorMessage,
                errorCode,
                status: MESSAGE_STATUS.ERROR,
              };
            }
            return newMessages;
          });
          sseSourceRef.current = null;
          source.close();
        }
      });

      source.addEventListener('readystatechange', (e) => {
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
            response: responseData + '\n\nHTTP Error:\n' + JSON.stringify(errorInfo, null, 2),
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
      setMessage,
      streamMessageUpdate,
      completeMessage,
      updateLastAssistantWithResult,
      t,
      sseSourceRef,
    ],
  );

  const onStopGenerator = useCallback(() => {
    if (sseSourceRef.current) {
      sseSourceRef.current.close();
      sseSourceRef.current = null;
    }

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

        setTimeout(() => saveMessages(updatedMessages), 0);
        return updatedMessages;
      }
      return prevMessage;
    });
  }, [setMessage, applyAutoCollapseLogic, saveMessages, sseSourceRef]);

  const sendRequest = useCallback(
    (payload, isStream, endpoint = PLAYGROUND_ENDPOINTS.CHAT_COMPLETIONS) => {
      if (isStream && endpoint !== PLAYGROUND_ENDPOINTS.IMAGE_GENERATIONS) {
        handleSSE(payload, endpoint);
      } else {
        handleNonStreamRequest(payload, endpoint);
      }
    },
    [handleSSE, handleNonStreamRequest],
  );

  return {
    sendRequest,
    onStopGenerator,
    streamMessageUpdate,
    completeMessage,
  };
};
