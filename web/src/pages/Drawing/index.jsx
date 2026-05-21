import React, {
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  API,
  calculateModelPrice,
  getModelPriceItems,
  setUserData,
} from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { useDrawingSessions } from '../../hooks/drawing/useDrawingSessions';
import { useDrawingMessages } from '../../hooks/drawing/useDrawingMessages';
import { useDrawingSubmit } from '../../hooks/drawing/useDrawingSubmit';
import DrawingCanvas from '../../components/playground/drawing/DrawingCanvas';
import DrawingInputBar from '../../components/playground/drawing/DrawingInputBar';
import {
  DEFAULT_DRAWING_MODEL,
  DRAWING_API,
  MAX_UPLOAD_IMAGES,
} from '../../constants/drawing.constants';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { Modal, Popover, Spin } from '@douyinfe/semi-ui';
import {
  ChevronDown,
  Image as ImageIcon,
  List,
  Plus,
  Trash2,
} from 'lucide-react';

const Drawing = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleDraftEdited, setTitleDraftEdited] = useState(false);
  const [sessionSelectorVisible, setSessionSelectorVisible] = useState(false);
  const [headerToolbarRoot, setHeaderToolbarRoot] = useState(null);
  const [referencePreviewImage, setReferencePreviewImage] = useState('');
  const [drawingPricing, setDrawingPricing] = useState(null);
  const [drawingPricingLoading, setDrawingPricingLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const sessionSelectorRef = useRef(null);
  const urlMessageTargetRef = useRef('');
  const newDraftRef = useRef(false);

  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    loading: sessionsLoading,
    createSession,
    deleteSession,
    updateSessionTitle,
    loadSessions,
  } = useDrawingSessions();

  const {
    messages,
    pageInfo,
    loading: messagesLoading,
    loadMessages,
    loadCurrentMessage,
    loadPreviousMessage,
    loadNextMessage,
    setMessages,
    addOptimisticMessage,
    updateMessageByTaskId,
  } = useDrawingMessages(activeSessionId);

  const { submit, startPolling, stopAllPolling } = useDrawingSubmit(
    activeSessionId,
    addOptimisticMessage,
    updateMessageByTaskId,
  );
  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const urlSessionId = queryParams.get('session');
  const urlMessageId = queryParams.get('message');
  const currentMessage = messages[0] || null;
  const nextDefaultSessionTitle = useMemo(
    () => getNextDrawingSessionTitle(sessions),
    [sessions],
  );

  useEffect(() => {
    let ignore = false;

    async function loadUserBalance() {
      try {
        const res = await API.get('/api/user/self');
        if (ignore) return;
        if (res.data.success) {
          userDispatch({ type: 'login', payload: res.data.data });
          setUserData(res.data.data);
        }
      } catch (e) {
        console.error('Failed to load drawing user balance', e);
      }
    }

    async function loadDrawingPricing() {
      setDrawingPricingLoading(true);
      try {
        const res = await API.get('/api/pricing');
        if (ignore) return;
        if (res.data.success) {
          const model = (res.data.data || []).find(
            (item) => item.model_name === DEFAULT_DRAWING_MODEL,
          );
          setDrawingPricing({
            model,
            groupRatio: res.data.group_ratio || {},
          });
        }
      } catch (e) {
        console.error('Failed to load drawing pricing', e);
      } finally {
        if (!ignore) setDrawingPricingLoading(false);
      }
    }

    loadUserBalance();
    loadDrawingPricing();
    return () => {
      ignore = true;
    };
  }, [userDispatch]);

  const balanceInfo = useMemo(
    () =>
      buildDrawingBalanceInfo({
        userQuota: userState?.user?.quota,
        status: statusState?.status,
        pricing: drawingPricing,
        pricingLoading: drawingPricingLoading,
        t,
      }),
    [
      drawingPricing,
      drawingPricingLoading,
      statusState?.status,
      t,
      userState?.user?.quota,
    ],
  );

  useEffect(() => {
    if (newDraftRef.current) {
      if (!urlSessionId) {
        newDraftRef.current = false;
      }
      return;
    }

    if (urlSessionId) {
      setActiveSessionId((prev) =>
        prev === urlSessionId ? prev : urlSessionId,
      );
    }
  }, [setActiveSessionId, urlSessionId]);

  useEffect(() => {
    if (!activeSessionId) {
      urlMessageTargetRef.current = '';
      loadMessages();
      return;
    }

    const urlMessageTarget =
      urlSessionId === activeSessionId && urlMessageId
        ? `${activeSessionId}:${urlMessageId}`
        : '';

    if (urlMessageTarget) {
      if (urlMessageTargetRef.current !== urlMessageTarget) {
        urlMessageTargetRef.current = urlMessageTarget;
        loadCurrentMessage(urlMessageId);
      }
      return;
    }

    urlMessageTargetRef.current = '';

    if (!currentMessage || currentMessage.session_id !== activeSessionId) {
      loadMessages();
    }
  }, [
    activeSessionId,
    currentMessage?.session_id,
    loadCurrentMessage,
    loadMessages,
    urlMessageId,
    urlSessionId,
  ]);

  useEffect(() => {
    if (
      urlMessageTargetRef.current &&
      currentMessage?.session_id === activeSessionId &&
      String(currentMessage.id || '') === urlMessageId
    ) {
      urlMessageTargetRef.current = '';
    }
  }, [
    activeSessionId,
    currentMessage?.id,
    currentMessage?.session_id,
    urlMessageId,
  ]);

  useEffect(() => {
    return () => stopAllPolling();
  }, [stopAllPolling]);

  useEffect(() => {
    if (!isMobile) {
      setHeaderToolbarRoot(null);
      return;
    }

    setHeaderToolbarRoot(
      document.getElementById('drawing-header-toolbar-root'),
    );
  }, [isMobile]);

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
  useEffect(() => {
    if (!activeSessionId) {
      if (urlSessionId && !newDraftRef.current) {
        return;
      }

      if (location.search) {
        navigate(
          {
            pathname: location.pathname,
            search: '',
          },
          { replace: true },
        );
      }
      return;
    }

    const pendingUrlMessageTarget =
      activeSessionId && urlMessageId
        ? `${activeSessionId}:${urlMessageId}`
        : '';
    if (
      pendingUrlMessageTarget &&
      urlMessageTargetRef.current === pendingUrlMessageTarget &&
      (!currentMessage || String(currentMessage.id || '') !== urlMessageId)
    ) {
      return;
    }

    const nextParams = new URLSearchParams();
    nextParams.set('session', activeSessionId);
    if (
      currentMessage?.id &&
      currentMessage.session_id === activeSessionId &&
      !currentMessage.optimistic
    ) {
      nextParams.set('message', String(currentMessage.id));
    }

    const nextSearch = `?${nextParams.toString()}`;
    if (location.search !== nextSearch) {
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch,
        },
        { replace: true },
      );
    }
  }, [
    activeSessionId,
    currentMessage,
    location.pathname,
    location.search,
    navigate,
    urlMessageId,
    urlSessionId,
  ]);

  useEffect(() => {
    if (
      currentMessage?.task_id &&
      (currentMessage.status === 'pending' ||
        currentMessage.status === 'processing')
    ) {
      startPolling(currentMessage.task_id);
    }
  }, [currentMessage?.task_id, currentMessage?.status, startPolling]);

  useEffect(() => {
    if (currentMessage?.status === 'success') {
      loadSessions();
    }
  }, [currentMessage?.id, currentMessage?.status, loadSessions]);

  useEffect(() => {
    let ignore = false;

    async function loadReferencePreviewImage() {
      const images = await resolveDrawingReferenceImages(
        currentMessage,
        activeSessionId,
      );
      if (!ignore) {
        setReferencePreviewImage(images[0] || '');
      }
    }

    if (!currentMessage || currentMessage.status !== 'success') {
      setReferencePreviewImage('');
      return () => {
        ignore = true;
      };
    }

    loadReferencePreviewImage();
    return () => {
      ignore = true;
    };
  }, [
    activeSessionId,
    currentMessage?.id,
    currentMessage?.result_data,
    currentMessage?.status,
  ]);

  const handleSubmit = useCallback(
    async (params) => {
      let sessionId = activeSessionId;
      if (!activeSessionId) {
        const title = titleDraftEdited ? titleDraft.trim() : '';
        const session = await createSession(title);
        if (!session) return;
        newDraftRef.current = false;
        sessionId = session.session_id;
        setTitleDraft(session.title || title || nextDefaultSessionTitle);
        setTitleDraftEdited(false);
        setTitleEditing(false);
      }

      const uploadedImages = Array.isArray(params.images) ? params.images : [];
      const referenceImages = await resolveDrawingReferenceImages(
        currentMessage,
        sessionId,
      );
      const images = mergeDrawingImages(referenceImages, uploadedImages);

      await submit(
        {
          ...params,
          images,
        },
        sessionId,
      );
    },
    [
      activeSessionId,
      createSession,
      currentMessage,
      nextDefaultSessionTitle,
      submit,
      titleDraft,
      titleDraftEdited,
    ],
  );

  const handleRetry = useCallback(
    (message) => {
      if (!message?.prompt?.trim() || retrying) return;

      setRetrying(true);
      scheduleAfterPaint(() => {
        Promise.resolve()
          .then(() =>
            submit(
              {
                prompt: message.prompt.trim(),
                model: message.model || DEFAULT_DRAWING_MODEL,
                size: message.size,
                quality: message.quality || 'auto',
                images: parseDrawingMessageImages(message.image_urls),
              },
              message.session_id || activeSessionId,
            ),
          )
          .finally(() => {
            setRetrying(false);
          });
      });
    },
    [activeSessionId, retrying, submit],
  );

  const handleNewSession = useCallback(() => {
    newDraftRef.current = true;
    urlMessageTargetRef.current = '';
    setActiveSessionId(null);
    setMessages([]);
    setTitleDraft(nextDefaultSessionTitle);
    setTitleDraftEdited(false);
    setTitleEditing(false);
    setSessionSelectorVisible(false);
    if (location.search) {
      navigate(
        {
          pathname: location.pathname,
          search: '',
        },
        { replace: true },
      );
    }
  }, [
    location.pathname,
    location.search,
    navigate,
    setActiveSessionId,
    setMessages,
    nextDefaultSessionTitle,
  ]);

  const handleSelectSession = useCallback(
    (id) => {
      setActiveSessionId(id);
      setTitleDraftEdited(false);
      setSessionSelectorVisible(false);
    },
    [setActiveSessionId],
  );

  const handleDeleteSession = useCallback(
    (session) => {
      if (!session?.session_id) return;

      const sessionId = session.session_id;
      const isDeletingActiveSession = sessionId === activeSessionId;

      Modal.confirm({
        title: t('确认删除'),
        content: (
          <div className='text-sm leading-relaxed break-words'>
            {t('确认删除会话')}：{session.title || t('未命名会话')}
          </div>
        ),
        okText: t('删除'),
        cancelText: t('取消'),
        okType: 'danger',
        centered: true,
        width: 'min(420px, calc(100vw - 32px))',
        onOk: () => {
          scheduleAfterModalClose(() => {
            if (isDeletingActiveSession) {
              newDraftRef.current = true;
              urlMessageTargetRef.current = '';
              setActiveSessionId(null);
              setMessages([]);
              setTitleDraft(
                getNextDrawingSessionTitle(
                  sessions.filter((item) => item.session_id !== sessionId),
                ),
              );
              setTitleDraftEdited(false);
              setTitleEditing(false);
              if (location.search) {
                navigate(
                  {
                    pathname: location.pathname,
                    search: '',
                  },
                  { replace: true },
                );
              }
            }

            void deleteSession(sessionId);
            setSessionSelectorVisible(false);
          });
        },
        onCancel: () => {
          setSessionSelectorVisible(false);
        },
      });
    },
    [
      activeSessionId,
      deleteSession,
      location.pathname,
      location.search,
      navigate,
      sessions,
      setActiveSessionId,
      setMessages,
      t,
    ],
  );

  const isLoading = messages.some(
    (m) => m.status === 'pending' || m.status === 'processing',
  );

  const activeSession = useMemo(
    () => sessions.find((session) => session.session_id === activeSessionId),
    [sessions, activeSessionId],
  );
  const currentTitle = activeSession?.title || nextDefaultSessionTitle;
  const displayTitle = activeSessionId
    ? currentTitle
    : titleDraft || nextDefaultSessionTitle;

  useEffect(() => {
    if (activeSessionId) {
      setTitleDraft(currentTitle);
      setTitleDraftEdited(false);
      setTitleEditing(false);
      return;
    }

    if (!titleDraftEdited) {
      setTitleDraft(nextDefaultSessionTitle);
      setTitleEditing(false);
    }
  }, [
    activeSessionId,
    currentTitle,
    nextDefaultSessionTitle,
    titleDraftEdited,
  ]);

  const handleSaveSessionTitle = useCallback(async () => {
    const nextTitle = titleDraft.trim() || currentTitle;

    if (!activeSessionId) {
      setTitleDraft(nextTitle);
      setTitleDraftEdited(titleDraftEdited && Boolean(titleDraft.trim()));
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
  }, [
    activeSessionId,
    currentTitle,
    titleDraft,
    titleDraftEdited,
    updateSessionTitle,
  ]);

  const handleCancelSessionTitle = useCallback(() => {
    setTitleDraft(currentTitle);
    setTitleDraftEdited(false);
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
      className='w-[min(calc(100vw-32px),320px)] overflow-hidden rounded-lg'
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
        <div className='flex items-center gap-1'>
          {activeSession && (
            <button
              className='flex h-7 w-7 items-center justify-center rounded-lg transition-colors'
              style={{ color: 'var(--semi-color-danger)' }}
              onClick={() => handleDeleteSession(activeSession)}
              aria-label={t('删除会话')}
              title={t('删除会话')}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  'var(--semi-color-danger-light-default)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
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
              const imageCount = Number(item.image_count || 0);
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
                  <span
                    className='inline-flex h-6 min-w-9 flex-shrink-0 items-center justify-center gap-1 rounded-md px-1.5 text-xs'
                    style={{
                      color: 'var(--semi-color-text-2)',
                      background: 'var(--semi-color-fill-0)',
                    }}
                    title={t('生成图片数')}
                    aria-label={t('生成图片数')}
                  >
                    <ImageIcon size={12} />
                    <span>{imageCount}</span>
                  </span>
                  <button
                    className='flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors'
                    style={{ color: 'var(--semi-color-danger)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(item);
                    }}
                    aria-label={t('删除会话')}
                    title={t('删除会话')}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        'var(--semi-color-danger-light-default)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Trash2 size={14} />
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
        autoAdjustOverflow
        margin={{
          marginLeft: 8,
          marginRight: 8,
          marginTop: 8,
          marginBottom: 8,
        }}
        showArrow={false}
        spacing={6}
        visible={sessionSelectorVisible}
        onClickOutSide={() => setSessionSelectorVisible(false)}
        content={sessionSelectorContent}
        contentClassName='!p-0 !rounded-lg !shadow-xl !border !border-semi-color-border'
        getPopupContainer={() => document.body}
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
          onChange={(e) => {
            setTitleDraft(e.target.value);
            setTitleDraftEdited(true);
          }}
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

  const headerToolbar = (
    <div className='flex min-w-0 flex-1 items-center justify-between gap-2 pl-2'>
      {titleBar}
      {newSessionButton}
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
      {isMobile &&
        headerToolbarRoot &&
        createPortal(headerToolbar, headerToolbarRoot)}

      {/* Main content */}
      <div
        className='relative flex-1 flex flex-col min-w-0 min-h-0'
        style={{ background: 'var(--semi-color-bg-1)' }}
      >
        {!isMobile && (
          <div className='z-10 flex flex-shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-4'>
            {titleBar}
            {newSessionButton}
          </div>
        )}

        <div className='flex-1 min-h-0 overflow-auto overscroll-contain'>
          <DrawingCanvas
            messages={messages}
            pageInfo={pageInfo}
            loading={messagesLoading}
            activeSessionId={activeSessionId}
            onLoadPrevious={loadPreviousMessage}
            onLoadNext={loadNextMessage}
            onRetry={handleRetry}
            retryDisabled={isLoading || retrying}
          />
        </div>

        <div className='flex-shrink-0 px-4 pb-6 pt-2'>
          <DrawingInputBar
            onSubmit={handleSubmit}
            disabled={false}
            loading={isLoading}
            hasImage={messages.some((m) => m.status === 'success')}
            referenceImage={referencePreviewImage}
            balanceInfo={balanceInfo}
          />
        </div>
      </div>
    </div>
  );
};

const DRAWING_SESSION_TITLE_PREFIX = '新会话';

function getNextDrawingSessionTitle(sessions) {
  const usedIndexes = new Set();

  for (const session of sessions || []) {
    const title = String(session?.title || '').trim();
    if (!title.startsWith(DRAWING_SESSION_TITLE_PREFIX)) continue;

    const suffix = title.slice(DRAWING_SESSION_TITLE_PREFIX.length);
    if (!/^\d+$/.test(suffix)) continue;

    const index = Number(suffix);
    if (Number.isSafeInteger(index) && index > 0) {
      usedIndexes.add(index);
    }
  }

  for (let index = 1; ; index += 1) {
    if (!usedIndexes.has(index)) {
      return `${DRAWING_SESSION_TITLE_PREFIX}${index}`;
    }
  }
}

function scheduleAfterPaint(callback) {
  const run = () => {
    Promise.resolve().then(callback);
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => setTimeout(run, 0));
    return;
  }

  setTimeout(run, 0);
}

function scheduleAfterModalClose(callback) {
  scheduleAfterPaint(callback);
}

function parseDrawingMessageImages(imageUrls) {
  if (!imageUrls) return [];
  if (Array.isArray(imageUrls)) return imageUrls;
  if (typeof imageUrls !== 'string') return [];

  try {
    const parsed = JSON.parse(imageUrls);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function resolveDrawingReferenceImages(message, sessionId) {
  if (!message || message.status !== 'success' || !sessionId) return [];

  const fromMessage = extractDrawingResultImages(message.result_data);
  if (fromMessage.length > 0) return fromMessage;

  if (!message.id) return [];

  try {
    const res = await API.get(
      DRAWING_API.MESSAGE_IMAGES(sessionId, message.id),
    );
    if (!res.data.success) return [];
    return extractDrawingResultImages(res.data.data?.result_data);
  } catch (e) {
    console.error('Failed to load drawing reference images', e);
    return [];
  }
}

function extractDrawingResultImages(resultData) {
  if (!resultData) return [];

  let parsed = resultData;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => item?.url || item?.b64_json || '')
    .filter(Boolean)
    .slice(0, MAX_UPLOAD_IMAGES);
}

function mergeDrawingImages(referenceImages, uploadedImages) {
  const merged = [];
  for (const image of [...referenceImages, ...uploadedImages]) {
    if (!image || merged.includes(image)) continue;
    merged.push(image);
    if (merged.length >= MAX_UPLOAD_IMAGES) break;
  }
  return merged;
}

function buildDrawingBalanceInfo({
  userQuota,
  status,
  pricing,
  pricingLoading,
  t,
}) {
  const balanceUSD = quotaToUsdAmount(userQuota, status);
  const balanceText = formatUsdAmount(balanceUSD, 2);
  const tone =
    balanceUSD < 0.1 ? 'danger' : balanceUSD < 1 ? 'warning' : 'success';
  const toneColor = {
    danger: 'var(--semi-color-danger)',
    warning: 'var(--semi-color-warning)',
    success: 'var(--semi-color-success)',
  }[tone];

  const model = pricing?.model;
  let priceItems = [];
  let priceUnavailable = '';
  let usedGroup = 'gpt-image';
  let availableGenerationsText = '';

  if (model) {
    const groupRatio = pricing?.groupRatio || {};
    const selectedGroup =
      Array.isArray(model.enable_groups) &&
      model.enable_groups.includes('gpt-image') &&
      groupRatio['gpt-image'] !== undefined
        ? 'gpt-image'
        : 'all';

    const priceData = calculateModelPrice({
      record: model,
      selectedGroup,
      groupRatio,
      tokenUnit: 'M',
      currency: 'USD',
      quotaDisplayType: 'USD',
      displayPrice: (usdPrice) => formatUsdAmount(usdPrice, 4),
    });
    usedGroup = priceData.usedGroup || selectedGroup;
    priceItems = getModelPriceItems(priceData, t, 'USD');

    const unitPriceUSD =
      model.quota_type === 1
        ? Number(model.model_price || 0) * Number(priceData.usedGroupRatio || 1)
        : 0;
    if (Number.isFinite(unitPriceUSD) && unitPriceUSD > 0) {
      availableGenerationsText = `${t('约')} ${Math.max(
        0,
        Math.floor(balanceUSD / unitPriceUSD),
      )} ${t('次')}`;
    }
  } else if (!pricingLoading) {
    priceUnavailable = t('未找到模型价格');
  }

  return {
    balanceText,
    balanceUSD,
    availableGenerationsText,
    modelName: DEFAULT_DRAWING_MODEL,
    priceItems,
    priceUnavailable,
    pricingLoading,
    tone,
    toneColor,
    usedGroup,
  };
}

function quotaToUsdAmount(quota, status) {
  const quotaPerUnit = Number(
    status?.quota_per_unit || localStorage.getItem('quota_per_unit') || 1,
  );
  const safeQuotaPerUnit =
    Number.isFinite(quotaPerUnit) && quotaPerUnit > 0 ? quotaPerUnit : 1;
  return Number(quota || 0) / safeQuotaPerUnit;
}

function formatUsdAmount(amount, digits) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value <= 0) return '$0.00';

  const fixedValue = value.toFixed(digits);
  if (Number(fixedValue) > 0) return `$${fixedValue}`;

  const smallFixedValue = value.toFixed(6);
  if (Number(smallFixedValue) > 0) {
    return `$${trimTrailingZeros(smallFixedValue)}`;
  }

  return '<$0.000001';
}

function trimTrailingZeros(value) {
  return value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

export default Drawing;
