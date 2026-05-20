import React, { useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useDrawingSessions } from '../../hooks/drawing/useDrawingSessions';
import { useDrawingMessages } from '../../hooks/drawing/useDrawingMessages';
import { useDrawingSubmit } from '../../hooks/drawing/useDrawingSubmit';
import DrawingSessionList from '../../components/playground/drawing/DrawingSessionList';
import DrawingCanvas from '../../components/playground/drawing/DrawingCanvas';
import DrawingInputBar from '../../components/playground/drawing/DrawingInputBar';

const Drawing = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    sessions, activeSessionId, setActiveSessionId,
    loading: sessionsLoading, createSession, deleteSession,
  } = useDrawingSessions();

  const {
    messages, loading: messagesLoading, loadMessages,
    addOptimisticMessage, updateMessageByTaskId,
  } = useDrawingMessages(activeSessionId);

  const { submit, startPolling, stopAllPolling } = useDrawingSubmit(
    activeSessionId, addOptimisticMessage, updateMessageByTaskId,
  );

  useEffect(() => { loadMessages(); }, [activeSessionId, loadMessages]);
  useEffect(() => { return () => stopAllPolling(); }, [stopAllPolling]);
  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.task_id && (msg.status === 'pending' || msg.status === 'processing')) {
        startPolling(msg.task_id);
      }
    });
  }, [messages.length]);

  const handleSubmit = useCallback(async (params) => {
    if (!activeSessionId) {
      const session = await createSession();
      if (!session) return;
    }
    await submit(params);
  }, [activeSessionId, createSession, submit]);

  const handleNewSession = useCallback(async () => {
    await createSession(t('新会话'));
    if (isMobile) setSidebarOpen(false);
  }, [createSession, t, isMobile]);

  const handleSelectSession = useCallback((id) => {
    setActiveSessionId(id);
    if (isMobile) setSidebarOpen(false);
  }, [setActiveSessionId, isMobile]);

  const isLoading = messages.some((m) => m.status === 'pending' || m.status === 'processing');

  return (
    <div className='flex overflow-hidden' style={{ height: 'calc(100vh - 64px)', marginTop: 64 }}>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div className='fixed inset-0 z-20' style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        className={`flex-shrink-0 flex flex-col border-r ${isMobile ? `fixed top-16 bottom-0 z-30 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}` : 'relative'}`}
        style={{ width: 260, background: 'var(--semi-color-bg-0)', borderColor: 'var(--semi-color-border)' }}
      >
        <DrawingSessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={handleSelectSession}
          onDelete={deleteSession}
          onCreate={handleNewSession}
          loading={sessionsLoading}
        />
      </div>

      {/* Main content */}
      <div className='flex-1 flex flex-col min-w-0' style={{ background: 'var(--semi-color-bg-1)' }}>
        {isMobile && (
          <div className='flex items-center px-4 py-3 border-b flex-shrink-0' style={{ borderColor: 'var(--semi-color-border)' }}>
            <button
              className='p-2 rounded-lg cursor-pointer transition-colors'
              style={{ color: 'var(--semi-color-text-2)' }}
              onClick={() => setSidebarOpen(true)}
            >
              <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                <line x1='3' y1='6' x2='21' y2='6' /><line x1='3' y1='12' x2='21' y2='12' /><line x1='3' y1='18' x2='21' y2='18' />
              </svg>
            </button>
          </div>
        )}

        <div className='flex-1 overflow-auto'>
          <DrawingCanvas messages={messages} loading={messagesLoading} activeSessionId={activeSessionId} />
        </div>

        <div className='flex-shrink-0 px-4 pb-6 pt-2'>
          <DrawingInputBar
            onSubmit={handleSubmit}
            disabled={false}
            loading={isLoading}
            hasImage={messages.some((m) => m.status === 'success' && m.result_data)}
          />
        </div>
      </div>
    </div>
  );
};

export default Drawing;
