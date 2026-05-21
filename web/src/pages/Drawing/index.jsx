import React, {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useDrawingSessions } from '../../hooks/drawing/useDrawingSessions';
import { useDrawingMessages } from '../../hooks/drawing/useDrawingMessages';
import { useDrawingSubmit } from '../../hooks/drawing/useDrawingSubmit';
import DrawingCanvas from '../../components/playground/drawing/DrawingCanvas';
import DrawingInputBar from '../../components/playground/drawing/DrawingInputBar';
import { Popover, Spin } from '@douyinfe/semi-ui';
import {
  ChevronDown,
  Image as ImageIcon,
  List,
  Plus,
  Trash2,
} from 'lucide-react';

const Drawing = () => {
  const { t } = useTranslation();
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [sessionSelectorVisible, setSessionSelectorVisible] = useState(false);
  const sessionSelectorRef = useRef(null);

  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    loading: sessionsLoading,
    createSession,
    deleteSession,
    updateSessionTitle,
  } = useDrawingSessions();

  const {
    messages,
    pageInfo,
    loading: messagesLoading,
    loadMessages,
    loadPreviousMessage,
    loadNextMessage,
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
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverscroll =
      document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      document.documentElement.style.overscrollBehavior =
        previousHtmlOverscroll;
    };
  }, []);
  const currentMessage = messages[0] || null;

  useEffect(() => {
    if (
      currentMessage?.task_id &&
      (currentMessage.status === 'pending' ||
        currentMessage.status === 'processing')
    ) {
      startPolling(currentMessage.task_id);
    }
  }, [currentMessage?.task_id, currentMessage?.status, startPolling]);

  const handleSubmit = useCallback(
    async (params) => {
      let sessionId = activeSessionId;
      if (!activeSessionId) {
        const title = titleDraft.trim() || t('新会话');
        const session = await createSession(title);
        if (!session) return;
        sessionId = session.session_id;
        setTitleDraft(session.title || title);
        setTitleEditing(false);
      }
      await submit(params, sessionId);
    },
    [activeSessionId, createSession, submit, t, titleDraft],
  );

  const handleNewSession = useCallback(async () => {
    await createSession(t('新会话'));
    setSessionSelectorVisible(false);
  }, [createSession, t]);

  const handleSelectSession = useCallback(
    (id) => {
      setActiveSessionId(id);
      setSessionSelectorVisible(false);
    },
    [setActiveSessionId],
  );

  const isLoading = messages.some(
    (m) => m.status === 'pending' || m.status === 'processing',
  );

  const activeSession = useMemo(
    () => sessions.find((session) => session.session_id === activeSessionId),
    [sessions, activeSessionId],
  );
  const currentTitle = activeSession?.title || t('新会话');
  const displayTitle = activeSessionId
    ? currentTitle
    : titleDraft || currentTitle;

  useEffect(() => {
    setTitleDraft(currentTitle);
    setTitleEditing(false);
  }, [activeSessionId, currentTitle]);

  const handleSaveSessionTitle = useCallback(async () => {
    const nextTitle = titleDraft.trim() || currentTitle;

    if (!activeSessionId) {
      setTitleDraft(nextTitle);
      setTitleEditing(false);
      return;
    }

    if (nextTitle === currentTitle) {
      setTitleEditing(false);
      setTitleDraft(currentTitle);
      return;
    }

    const success = await updateSessionTitle(activeSessionId, nextTitle);
    if (!success) {
      setTitleDraft(currentTitle);
    }
    setTitleEditing(false);
  }, [activeSessionId, currentTitle, titleDraft, updateSessionTitle]);

  const handleCancelSessionTitle = useCallback(() => {
    setTitleDraft(currentTitle);
    setTitleEditing(false);
  }, [currentTitle]);

  const newSessionButton = (
    <button
      className='w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors'
      style={{
        color: 'var(--semi-color-text-1)',
        background: 'var(--semi-color-bg-0)',
        border: '1px solid var(--semi-color-border)',
      }}
      onClick={handleNewSession}
      aria-label={t('新建会话')}
      title={t('新建会话')}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--semi-color-fill-0)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--semi-color-bg-0)';
      }}
    >
      <Plus size={18} />
    </button>
  );

  const sessionSelectorContent = (
    <div
      className='w-[min(86vw,320px)] overflow-hidden rounded-lg'
      style={{
        background: 'var(--semi-color-bg-overlay)',
        color: 'var(--semi-color-text-0)',
      }}
    >
      <div
        className='flex items-center justify-between border-b px-3 py-2'
        style={{ borderColor: 'var(--semi-color-border)' }}
      >
        <span className='text-sm font-medium'>{t('会话')}</span>
        <button
          className='flex h-7 w-7 items-center justify-center rounded-lg transition-colors'
          style={{ color: 'var(--semi-color-text-2)' }}
          onClick={handleNewSession}
          aria-label={t('新建会话')}
          title={t('新建会话')}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--semi-color-fill-0)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Plus size={15} />
        </button>
      </div>

      <div className='max-h-[min(60vh,420px)] overflow-auto p-2'>
        {sessionsLoading ? (
          <div className='flex justify-center py-8'>
            <Spin size='small' />
          </div>
        ) : sessions.length === 0 ? (
          <p
            className='py-8 text-center text-xs'
            style={{ color: 'var(--semi-color-text-2)' }}
          >
            {t('暂无会话')}
          </p>
        ) : (
          <div className='space-y-0.5'>
            {sessions.map((item) => {
              const isActive = activeSessionId === item.session_id;
              return (
                <div
                  key={item.session_id}
                  onClick={() => handleSelectSession(item.session_id)}
                  className='group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors'
                  style={{
                    background: isActive
                      ? 'var(--semi-color-primary-light-default)'
                      : 'transparent',
                    color: isActive
                      ? 'var(--semi-color-primary)'
                      : 'var(--semi-color-text-1)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background =
                        'var(--semi-color-fill-0)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <ImageIcon size={14} className='flex-shrink-0 opacity-60' />
                  <span className='flex-1 truncate text-sm'>
                    {item.title || t('未命名会话')}
                  </span>
                  <button
                    className='flex-shrink-0 rounded p-1 opacity-0 transition-all group-hover:opacity-100'
                    style={{ color: 'var(--semi-color-text-2)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(item.session_id);
                    }}
                    aria-label={t('删除会话')}
                    title={t('删除会话')}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        'var(--semi-color-fill-1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const sessionSelectorButton = (
    <div ref={sessionSelectorRef} className='flex-shrink-0'>
      <Popover
        trigger='custom'
        position='bottomLeft'
        showArrow={false}
        spacing={6}
        visible={sessionSelectorVisible}
        onClickOutSide={() => setSessionSelectorVisible(false)}
        content={sessionSelectorContent}
        contentClassName='!p-0 !rounded-lg !shadow-xl !border !border-semi-color-border'
        getPopupContainer={() => sessionSelectorRef.current || document.body}
      >
        <button
          className='flex h-9 items-center gap-1 rounded-lg px-2 transition-colors'
          style={{
            color: 'var(--semi-color-text-1)',
            background: 'var(--semi-color-bg-0)',
            border: '1px solid var(--semi-color-border)',
          }}
          aria-label={t('选择会话')}
          title={t('选择会话')}
          onClick={() => setSessionSelectorVisible((visible) => !visible)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--semi-color-fill-0)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--semi-color-bg-0)';
          }}
        >
          <List size={17} />
          <ChevronDown size={14} />
        </button>
      </Popover>
    </div>
  );

  const sessionTitle = (
    <div className='min-w-0 max-w-[min(52vw,420px)]'>
      {titleEditing ? (
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={handleSaveSessionTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSaveSessionTitle();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              handleCancelSessionTitle();
            }
          }}
          autoFocus
          maxLength={200}
          className='h-9 w-full min-w-40 rounded-lg border px-3 text-sm font-medium outline-none'
          style={{
            color: 'var(--semi-color-text-0)',
            background: 'var(--semi-color-bg-0)',
            borderColor: 'var(--semi-color-border)',
          }}
        />
      ) : (
        <button
          className='h-9 max-w-full truncate rounded-lg px-3 text-left text-sm font-medium transition-colors'
          style={{
            color: 'var(--semi-color-text-0)',
            background: 'var(--semi-color-bg-0)',
            border: '1px solid var(--semi-color-border)',
            cursor: 'text',
          }}
          onClick={() => {
            setTitleEditing(true);
          }}
          title={displayTitle}
          aria-label={t('修改会话名称')}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--semi-color-fill-0)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--semi-color-bg-0)';
          }}
        >
          {displayTitle}
        </button>
      )}
    </div>
  );

  const titleBar = (
    <div className='flex min-w-0 items-center gap-2'>
      {sessionSelectorButton}
      {sessionTitle}
    </div>
  );

  return (
    <div
      className='flex w-full overflow-hidden'
      style={{
        height: 'calc(100dvh - 64px)',
        marginTop: 64,
        overscrollBehavior: 'none',
      }}
    >
      {/* Main content */}
      <div
        className='relative flex-1 flex flex-col min-w-0 min-h-0'
        style={{ background: 'var(--semi-color-bg-1)' }}
      >
        <div className='absolute left-4 right-4 top-4 z-10 flex items-center justify-between gap-3'>
          {titleBar}
          {newSessionButton}
        </div>

        <div className='flex-1 min-h-0 overflow-auto'>
          <DrawingCanvas
            messages={messages}
            pageInfo={pageInfo}
            loading={messagesLoading}
            activeSessionId={activeSessionId}
            onLoadPrevious={loadPreviousMessage}
            onLoadNext={loadNextMessage}
          />
        </div>

        <div className='flex-shrink-0 px-4 pb-6 pt-2'>
          <DrawingInputBar
            onSubmit={handleSubmit}
            disabled={false}
            loading={isLoading}
            hasImage={messages.some(
              (m) => m.status === 'success' && m.result_data,
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default Drawing;
