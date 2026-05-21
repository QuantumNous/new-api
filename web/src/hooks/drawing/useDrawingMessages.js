import { useState, useCallback, useRef } from 'react';
import { API } from '../../helpers';
import { DRAWING_API } from '../../constants/drawing.constants';

const EMPTY_PAGE_INFO = {
  current_index: 0,
  total: 0,
  has_prev: false,
  has_next: false,
};

export function useDrawingMessages(activeSessionId) {
  const [currentMessage, setCurrentMessage] = useState(null);
  const [pageInfo, setPageInfo] = useState(EMPTY_PAGE_INFO);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  const applyMessageResponse = useCallback((data) => {
    setCurrentMessage(data?.message || null);
    setPageInfo({
      current_index: data?.current_index || 0,
      total: data?.total || 0,
      has_prev: Boolean(data?.has_prev),
      has_next: Boolean(data?.has_next),
    });
  }, []);

  const loadMessage = useCallback(
    async (direction = 'latest', currentId) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (!activeSessionId) {
        setCurrentMessage(null);
        setPageInfo(EMPTY_PAGE_INFO);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await API.get(
          DRAWING_API.SESSION_MESSAGE(activeSessionId),
          {
            params: {
              direction,
              ...(currentId ? { current_id: currentId } : {}),
            },
          },
        );
        if (requestId !== requestIdRef.current) return;
        if (res.data.success) applyMessageResponse(res.data.data);
      } catch (e) {
        console.error('Failed to load message', e);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [activeSessionId, applyMessageResponse],
  );

  const loadMessages = useCallback(() => loadMessage('latest'), [loadMessage]);

  const loadCurrentMessage = useCallback(
    (messageId) => {
      if (!messageId) return;
      return loadMessage('current', messageId);
    },
    [loadMessage],
  );

  const loadPreviousMessage = useCallback(() => {
    if (!currentMessage?.id || !pageInfo.has_prev) return;
    return loadMessage('prev', currentMessage.id);
  }, [currentMessage?.id, loadMessage, pageInfo.has_prev]);

  const loadNextMessage = useCallback(() => {
    if (!currentMessage?.id || !pageInfo.has_next) return;
    return loadMessage('next', currentMessage.id);
  }, [currentMessage?.id, loadMessage, pageInfo.has_next]);

  const addOptimisticMessage = useCallback((msg) => {
    setCurrentMessage(msg);
    setPageInfo((prev) => {
      const total = prev.total + 1;
      return {
        current_index: total,
        total,
        has_prev: total > 1,
        has_next: false,
      };
    });
  }, []);

  const updateMessageByTaskId = useCallback((taskId, updates) => {
    setCurrentMessage((prev) => {
      if (!prev || prev.task_id !== taskId) return prev;
      const hasChanges = Object.entries(updates).some(
        ([key, value]) => prev[key] !== value,
      );
      if (!hasChanges) return prev;
      return { ...prev, ...updates };
    });
  }, []);

  const messages = currentMessage ? [currentMessage] : [];

  return {
    messages,
    currentMessage,
    pageInfo,
    loading,
    loadMessages,
    loadCurrentMessage,
    loadPreviousMessage,
    loadNextMessage,
    addOptimisticMessage,
    updateMessageByTaskId,
    setMessages: (nextMessages) => {
      const nextMessage = Array.isArray(nextMessages) ? nextMessages[0] : null;
      setCurrentMessage(nextMessage || null);
    },
  };
}
