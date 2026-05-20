import { useState, useCallback, useEffect } from 'react';
import { API } from '../../helpers';
import { DRAWING_API } from '../../constants/drawing.constants';

export function useDrawingSessions() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(DRAWING_API.SESSIONS);
      if (res.data.success) {
        setSessions(res.data.data || []);
      }
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const createSession = useCallback(async (title) => {
    try {
      const res = await API.post(DRAWING_API.SESSIONS, { title: title || '新会话' });
      if (res.data.success) {
        const newSession = res.data.data;
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSession.session_id);
        return newSession;
      }
    } catch (e) {
      console.error('Failed to create session', e);
    }
    return null;
  }, []);

  const deleteSession = useCallback(async (sessionId) => {
    try {
      const res = await API.delete(DRAWING_API.SESSION_DETAIL(sessionId));
      if (res.data.success) {
        setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
        }
      }
    } catch (e) {
      console.error('Failed to delete session', e);
    }
  }, [activeSessionId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    loading,
    createSession,
    deleteSession,
    loadSessions,
  };
}
