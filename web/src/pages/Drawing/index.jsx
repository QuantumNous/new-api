import React, { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from '@douyinfe/semi-ui';
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

  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    loading: sessionsLoading,
    createSession,
    deleteSession,
  } = useDrawingSessions();

  const {
    messages,
    loading: messagesLoading,
    loadMessages,
    addOptimisticMessage,
    updateMessageByTaskId,
  } = useDrawingMessages(activeSessionId);

  const { submit, startPolling, stopAllPolling } = useDrawingSubmit(
    activeSessionId,
    addOptimisticMessage,
    updateMessageByTaskId,
  );

  useEffect(() => {
    loadMessages();
  }, [activeSessionId, loadMessages]);

  useEffect(() => {
    return () => stopAllPolling();
  }, [stopAllPolling]);

  // Resume polling for in-progress messages on mount
  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.task_id && (msg.status === 'pending' || msg.status === 'processing')) {
        startPolling(msg.task_id);
      }
    });
  }, [messages.length]);

  const handleSubmit = useCallback(
    async (params) => {
      if (!activeSessionId) {
        const session = await createSession();
        if (!session) return;
      }
      await submit(params);
    },
    [activeSessionId, createSession, submit],
  );

  const handleNewSession = useCallback(async () => {
    await createSession(t('新会话'));
  }, [createSession, t]);

  return (
    <div className='h-full mt-[60px]'>
      <Layout className='h-[calc(100vh-66px)] bg-transparent flex flex-row'>
        {!isMobile && (
          <Layout.Sider
            className='bg-transparent border-r border-gray-200 flex-shrink-0 overflow-auto'
            width={260}
          >
            <DrawingSessionList
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelect={setActiveSessionId}
              onDelete={deleteSession}
              onCreate={handleNewSession}
              loading={sessionsLoading}
            />
          </Layout.Sider>
        )}

        <Layout.Content className='flex-1 flex flex-col overflow-hidden'>
          <div className='flex-1 overflow-auto'>
            <DrawingCanvas
              messages={messages}
              loading={messagesLoading}
              activeSessionId={activeSessionId}
            />
          </div>
          <div className='flex-shrink-0 border-t border-gray-200'>
            <DrawingInputBar
              onSubmit={handleSubmit}
              disabled={false}
              loading={messages.some(
                (m) => m.status === 'pending' || m.status === 'processing',
              )}
            />
          </div>
        </Layout.Content>
      </Layout>
    </div>
  );
};

export default Drawing;
