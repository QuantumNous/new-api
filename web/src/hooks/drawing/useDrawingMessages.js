import { useState, useCallback } from 'react';
import { API } from '../../helpers';
import { DRAWING_API } from '../../constants/drawing.constants';

export function useDrawingMessages(activeSessionId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    setMessages([]);
    setLoading(true);
    API.get(DRAWING_API.SESSION_MESSAGES(activeSessionId))
      .then((res) => {
        if (res.data.success) setMessages(res.data.data || []);
      })
      .catch((e) => console.error('Failed to load messages', e))
      .finally(() => setLoading(false));
  }, [activeSessionId]);

  const addOptimisticMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateMessageByTaskId = useCallback((taskId, updates) => {
    setMessages((prev) =>
      prev.map((m) => (m.task_id === taskId ? { ...m, ...updates } : m)),
    );
  }, []);

  return {
    messages,
    loading,
    loadMessages,
    addOptimisticMessage,
    updateMessageByTaskId,
    setMessages,
  };
}
