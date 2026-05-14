import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banner,
  Button,
  Empty,
  List,
  Modal,
  Spin,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { Bot, Check, History, Send, Trash2, X } from 'lucide-react';
import {
  deleteAgentSession,
  getAgentConfig,
  getAgentSession,
  listAgentSessions,
  streamAgentChat,
  streamAgentConfirm,
} from '../../services/agent';
import { showError, showSuccess } from '../../helpers';
import ToolResultCard from './ToolResultCard';

const { Text, Title } = Typography;

const AgentChatPanel = ({ compact = false }) => {
  const [config, setConfig] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  const assistantName = config?.display_name || 'Agent';
  const disabled = config && !config.enabled;

  const quickActions = useMemo(
    () =>
      config?.quick_actions?.length
        ? config.quick_actions
        : ['Check my balance', 'List my API keys', 'Show recent failed requests'],
    [config],
  );

  const refreshSessions = async () => {
    const res = await listAgentSessions();
    if (res.data?.success) {
      setSessions(res.data.data || []);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getAgentConfig();
        if (mounted && res.data?.success) {
          setConfig(res.data.data);
        }
        await refreshSessions();
      } catch (error) {
        showError(error.message || 'Failed to load agent');
      } finally {
        if (mounted) setBooting(false);
      }
    })();
    return () => {
      mounted = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, loading, pendingConfirm]);

  const openSession = async (id) => {
    try {
      const res = await getAgentSession(id);
      if (!res.data?.success) throw new Error(res.data?.message);
      const data = res.data.data;
      setSessionId(data.session.id);
      setMessages(
        (data.messages || []).map((item) => ({
          id: item.id,
          role: item.role,
          content: item.content,
          toolName: item.tool_name,
        })),
      );
    } catch (error) {
      showError(error.message || 'Failed to load session');
    }
  };

  const startNew = () => {
    abortRef.current?.abort();
    setSessionId(0);
    setMessages([]);
    setPendingConfirm(null);
  };

  const removeSession = async (id) => {
    try {
      await deleteAgentSession(id);
      showSuccess('Session archived');
      if (sessionId === id) startNew();
      await refreshSessions();
    } catch (error) {
      showError(error.message || 'Failed to archive session');
    }
  };

  const appendAssistantDelta = (delta) => {
    if (!delta) return;
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === 'assistant' && last.streaming) {
        last.content += delta;
      } else {
        next.push({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: delta,
          streaming: true,
        });
      }
      return next;
    });
  };

  const handleEvent = (event) => {
    if (!event) return;
    if (event.session_id && event.session_id !== sessionId) {
      setSessionId(event.session_id);
    }
    if (event.type === 'text_delta') {
      appendAssistantDelta(event.delta || event.message);
    }
    if (event.type === 'tool_call_start') {
      setMessages((prev) => [
        ...prev,
        {
          id: `tool-start-${Date.now()}`,
          role: 'tool',
          toolName: event.tool_name,
          content: event.message || `Running ${event.tool_name}`,
          pending: true,
        },
      ]);
    }
    if (event.type === 'tool_call_result') {
      setMessages((prev) => [
        ...prev.filter((item) => !(item.pending && item.toolName === event.tool_name)),
        {
          id: `tool-result-${Date.now()}`,
          role: 'tool',
          toolName: event.tool_name,
          event,
        },
      ]);
    }
    if (event.type === 'confirm_required') {
      setPendingConfirm(event);
      setMessages((prev) => [
        ...prev,
        {
          id: `confirm-${Date.now()}`,
          role: 'assistant',
          content: event.message || 'Please confirm this action.',
        },
      ]);
    }
    if (event.type === 'error') {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: event.message || 'Agent request failed',
          error: true,
        },
      ]);
    }
    if (event.type === 'done') {
      setMessages((prev) => prev.map((item) => ({ ...item, streaming: false })));
    }
  };

  const send = async (text = input) => {
    const content = text.trim();
    if (!content || loading || disabled) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setInput('');
    setPendingConfirm(null);
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content },
    ]);
    try {
      await streamAgentChat(
        { session_id: sessionId, message: content },
        handleEvent,
        controller.signal,
      );
      await refreshSessions();
    } catch (error) {
      if (error.name !== 'AbortError') {
        showError(error.message || 'Agent request failed');
        handleEvent({ type: 'error', message: error.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmAction = async (accept) => {
    if (!pendingConfirm) return;
    const event = pendingConfirm;
    setPendingConfirm(null);
    setLoading(true);
    try {
      await streamAgentConfirm(
        {
          session_id: event.session_id,
          confirm_token: event.confirm_token,
          accept,
        },
        handleEvent,
      );
      await refreshSessions();
    } catch (error) {
      showError(error.message || 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  if (booting) {
    return (
      <div className='flex h-full items-center justify-center'>
        <Spin size='large' />
      </div>
    );
  }

  return (
    <div className='flex h-full min-h-0 flex-col bg-[var(--semi-color-bg-0)]'>
      <div className='flex items-center justify-between border-b border-[var(--semi-color-border)] px-4 py-3'>
        <div className='flex min-w-0 items-center gap-2'>
          <Bot size={20} />
          <div className='min-w-0'>
            <Title heading={5} className='!mb-0 truncate'>
              {assistantName}
            </Title>
            <Text type='tertiary' size='small'>
              Account assistant
            </Text>
          </div>
        </div>
        <Button size='small' onClick={startNew}>
          New
        </Button>
      </div>

      {disabled ? (
        <div className='p-4'>
          <Banner
            type='warning'
            title='Agent is disabled'
            description='The global agent switch is off. Existing gateway features are unchanged.'
          />
        </div>
      ) : null}

      <div className='grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[220px_1fr]'>
        {!compact ? (
          <aside className='hidden overflow-auto border-r border-[var(--semi-color-border)] p-3 md:block'>
            <div className='mb-2 flex items-center gap-2 text-sm font-medium'>
              <History size={15} />
              Sessions
            </div>
            <List
              dataSource={sessions}
              emptyContent={<Empty title='No sessions' />}
              renderItem={(item) => (
                <List.Item className='rounded px-1 hover:bg-[var(--semi-color-fill-0)]'>
                  <div className='flex w-full items-center gap-2'>
                    <button
                      className='min-w-0 flex-1 truncate text-left text-sm'
                      onClick={() => openSession(item.id)}
                    >
                      {item.title || 'New chat'}
                    </button>
                    <Button
                      size='small'
                      icon={<Trash2 size={14} />}
                      type='tertiary'
                      onClick={() => removeSession(item.id)}
                    />
                  </div>
                </List.Item>
              )}
            />
          </aside>
        ) : null}

        <main className='flex min-h-0 flex-col'>
          <div ref={scrollRef} className='min-h-0 flex-1 overflow-auto p-4'>
            {messages.length === 0 ? (
              <div className='mx-auto flex max-w-2xl flex-col gap-4 pt-8'>
                <Empty
                  image={<Bot size={42} />}
                  title='Ask in plain language'
                  description='Use the assistant to check account data and operate guarded tools.'
                />
                <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                  {quickActions.map((action) => (
                    <Button
                      key={action}
                      theme='light'
                      className='!justify-start'
                      onClick={() => send(action)}
                      disabled={loading || disabled}
                    >
                      {action}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className='mx-auto flex max-w-3xl flex-col gap-3'>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[86%] rounded-md px-3 py-2 text-sm ${
                        message.role === 'user'
                          ? 'bg-[var(--semi-color-primary)] text-white'
                          : message.error
                            ? 'bg-[var(--semi-color-danger-light-default)]'
                            : 'bg-[var(--semi-color-fill-0)] text-[var(--semi-color-text-0)]'
                      }`}
                    >
                      {message.role === 'tool' && message.event ? (
                        <ToolResultCard event={message.event} />
                      ) : (
                        <div className='whitespace-pre-wrap break-words'>
                          {message.content}
                          {message.pending ? '...' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading ? <Spin size='small' /> : null}
              </div>
            )}
          </div>

          <div className='border-t border-[var(--semi-color-border)] p-3'>
            {pendingConfirm ? (
              <div className='mb-3 rounded-md border border-[var(--semi-color-warning)] p-3'>
                <div className='mb-2 text-sm font-medium'>
                  Confirm {pendingConfirm.tool_name}
                </div>
                <pre className='mb-3 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-[var(--semi-color-fill-0)] p-2 text-xs'>
                  {JSON.stringify(pendingConfirm.data || {}, null, 2)}
                </pre>
                <div className='flex gap-2'>
                  <Button
                    type='danger'
                    icon={<Check size={14} />}
                    onClick={() => {
                      if (pendingConfirm.risk_level === 'high') {
                        Modal.confirm({
                          title: 'Confirm high-risk action',
                          content:
                            'This action can change account assets or payment intent. Continue only if the details are correct.',
                          okText: 'Confirm',
                          cancelText: 'Cancel',
                          onOk: () => confirmAction(true),
                        });
                      } else {
                        confirmAction(true);
                      }
                    }}
                  >
                    Confirm
                  </Button>
                  <Button icon={<X size={14} />} onClick={() => confirmAction(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
            <div className='flex gap-2'>
              <TextArea
                autosize={{ minRows: 1, maxRows: 4 }}
                value={input}
                disabled={disabled}
                placeholder='Ask about balance, keys, logs, models, docs...'
                onChange={setInput}
                onEnterPress={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <Button
                type='primary'
                icon={<Send size={16} />}
                disabled={!input.trim() || loading || disabled}
                onClick={() => send()}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AgentChatPanel;
