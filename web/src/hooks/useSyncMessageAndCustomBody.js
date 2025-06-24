import { useCallback, useRef } from 'react';
import { MESSAGE_ROLES } from '../constants/playground.constants';

export const useSyncMessageAndCustomBody = (
  customRequestMode,
  customRequestBody,
  message,
  inputs,
  setCustomRequestBody,
  setMessage,
  debouncedSaveConfig
) => {
  const isUpdatingFromMessage = useRef(false);
  const isUpdatingFromCustomBody = useRef(false);
  const lastMessageHash = useRef('');
  const lastCustomBodyHash = useRef('');

  const getMessageHash = useCallback((messages) => {
    return JSON.stringify(messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content
    })));
  }, []);

  const getCustomBodyHash = useCallback((customBody) => {
    try {
      const parsed = JSON.parse(customBody);
      return JSON.stringify(parsed.messages || []);
    } catch {
      return '';
    }
  }, []);

  const syncMessageToCustomBody = useCallback(() => {
    if (!customRequestMode || isUpdatingFromCustomBody.current) return;

    const currentMessageHash = getMessageHash(message);
    if (currentMessageHash === lastMessageHash.current) return;

    try {
      isUpdatingFromMessage.current = true;
      let customPayload;

      try {
        customPayload = JSON.parse(customRequestBody || '{}');
      } catch {
        customPayload = {
          model: inputs.model || 'gpt-4o',
          messages: [],
          temperature: inputs.temperature || 0.7,
          stream: inputs.stream !== false
        };
      }

      customPayload.messages = message.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const newCustomBody = JSON.stringify(customPayload, null, 2);
      setCustomRequestBody(newCustomBody);
      lastMessageHash.current = currentMessageHash;
      lastCustomBodyHash.current = getCustomBodyHash(newCustomBody);

      setTimeout(() => {
        debouncedSaveConfig();
      }, 0);
    } finally {
      isUpdatingFromMessage.current = false;
    }
  }, [customRequestMode, customRequestBody, message, inputs.model, inputs.temperature, inputs.stream, getMessageHash, getCustomBodyHash, setCustomRequestBody, debouncedSaveConfig]);

  const syncCustomBodyToMessage = useCallback(() => {
    if (!customRequestMode || isUpdatingFromMessage.current) return;

    const currentCustomBodyHash = getCustomBodyHash(customRequestBody);
    if (currentCustomBodyHash === lastCustomBodyHash.current) return;

    try {
      isUpdatingFromCustomBody.current = true;
      const customPayload = JSON.parse(customRequestBody || '{}');

      if (customPayload.messages && Array.isArray(customPayload.messages)) {
        const newMessages = customPayload.messages.map((msg, index) => ({
          id: msg.id || (index + 1).toString(),
          role: msg.role || MESSAGE_ROLES.USER,
          content: msg.content || '',
          createAt: Date.now(),
          ...(msg.role === MESSAGE_ROLES.ASSISTANT && {
            reasoningContent: msg.reasoningContent || '',
            isReasoningExpanded: false
          })
        }));

        setMessage(newMessages);
        lastCustomBodyHash.current = currentCustomBodyHash;
        lastMessageHash.current = getMessageHash(newMessages);
      }
    } catch (error) {
      console.warn('同步自定义请求体到消息失败:', error);
    } finally {
      isUpdatingFromCustomBody.current = false;
    }
  }, [customRequestMode, customRequestBody, getCustomBodyHash, getMessageHash, setMessage]);

  return {
    syncMessageToCustomBody,
    syncCustomBodyToMessage
  };
}; 