'use client';

import { experimental_useRealtime } from '@ai-sdk/react';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
import { useState, useRef, useEffect, useMemo } from 'react';

type Provider = 'openai' | 'google' | 'xai';

type VoiceOption = { id: string; label: string };

function toVoiceOptions(names: string[]): VoiceOption[] {
  return names.map(n => ({ id: n, label: n }));
}

const PROVIDER_CONFIG: Record<
  Provider,
  {
    label: string;
    defaultModel: string;
    staticVoices: VoiceOption[];
    createModel: (
      modelId: string,
    ) => ReturnType<typeof openai.experimental_realtime>;
    sessionConfigOverrides?: Record<string, unknown>;
  }
> = {
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-realtime',
    staticVoices: toVoiceOptions([
      'alloy',
      'ash',
      'ballad',
      'coral',
      'echo',
      'fable',
      'marin',
      'sage',
      'shimmer',
      'verse',
    ]),
    createModel: modelId => openai.experimental_realtime(modelId),
  },
  google: {
    label: 'Google',
    defaultModel: 'gemini-3.1-flash-live-preview',
    staticVoices: toVoiceOptions(['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede']),
    createModel: modelId => google.experimental_realtime(modelId),
    sessionConfigOverrides: {
      inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
      outputAudioFormat: { type: 'audio/pcm', rate: 24000 },
    },
  },
  xai: {
    label: 'xAI',
    defaultModel: 'grok-voice-latest',
    staticVoices: toVoiceOptions(['ara', 'eve', 'leo', 'rex', 'sal']),
    createModel: modelId => xai.experimental_realtime(modelId),
  },
};

export default function RealtimePage() {
  const [provider, setProvider] = useState<Provider>('openai');
  const [voice, setVoice] = useState(
    PROVIDER_CONFIG.openai.staticVoices[0]?.id ?? '',
  );

  const currentVoices = PROVIDER_CONFIG[provider].staticVoices;

  const handleProviderChange = (next: Provider) => {
    setProvider(next);
    setVoice(PROVIDER_CONFIG[next].staticVoices[0]?.id ?? '');
  };

  const selectStyle = {
    marginLeft: 8,
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: 13,
    background: 'white',
  } as const;

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '2rem auto',
        padding: '0 1rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
        Realtime Voice Chat
      </h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
        AI SDK Realtime API with tool calling
      </p>

      {/* Provider & voice selectors */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 500, color: '#475569' }}>
          Provider
          <select
            value={provider}
            onChange={e => handleProviderChange(e.target.value as Provider)}
            style={selectStyle}
          >
            {Object.entries(PROVIDER_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 13, fontWeight: 500, color: '#475569' }}>
          Voice
          <select
            value={voice}
            onChange={e => setVoice(e.target.value)}
            style={selectStyle}
          >
            {currentVoices.length === 0 ? (
              <option>No voices available</option>
            ) : (
              currentVoices.map(v => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))
            )}
          </select>
        </label>

        <span
          style={{
            fontSize: 12,
            color: '#94a3b8',
            marginLeft: 'auto',
            fontFamily: 'monospace',
          }}
        >
          {PROVIDER_CONFIG[provider].defaultModel}
        </span>
      </div>

      <RealtimeChat
        key={`${provider}-${voice}`}
        provider={provider}
        voice={voice}
      />
    </div>
  );
}

function RealtimeChat({
  provider,
  voice,
}: {
  provider: Provider;
  voice: string;
}) {
  const [textInput, setTextInput] = useState('');
  const [showEvents, setShowEvents] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  const config = PROVIDER_CONFIG[provider];
  const model = useMemo(
    () => config.createModel(config.defaultModel),
    [config],
  );

  const sessionConfig = useMemo(
    () => ({
      instructions:
        'You are a helpful assistant. Be concise. ' +
        'You have access to tools for weather and dice rolling.',
      inputAudioTranscription: {},
      voice,
      turnDetection: { type: 'server-vad' as const },
      ...config.sessionConfigOverrides,
    }),
    [voice, config],
  );

  const {
    status,
    messages,
    events,
    isCapturing,
    isPlaying,
    connect,
    disconnect,
    sendTextMessage,
    startAudioCapture,
    stopAudioCapture,
    stopPlayback,
  } = experimental_useRealtime({
    model,
    api: {
      token: `/api/realtime/setup?provider=${provider}`,
    },
    sessionConfig,
    onEvent: event => {
      if (event.type !== 'audio-delta') {
        console.log(`[realtime:${provider}] ${event.type}`, event);
      }
    },
    onToolCall: async ({ toolCall }) => {
      switch (toolCall.toolName) {
        case 'getWeather': {
          const response = await fetch('/api/realtime/weather', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toolCall.args),
          });
          if (!response.ok) {
            throw new Error('Weather lookup failed');
          }
          return response.json();
        }
        case 'rollDice': {
          const response = await fetch('/api/realtime/roll-dice', {
            method: 'POST',
          });
          if (!response.ok) {
            throw new Error('Dice roll failed');
          }
          return response.json();
        }
      }
    },
    onError: error => {
      console.error(`[realtime:${provider}] error:`, error.message);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const toggleMic = async () => {
    if (isCapturing) {
      stopAudioCapture();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startAudioCapture(stream);
    } catch (err) {
      console.error('[realtime] mic access denied:', err);
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    const text = textInput.trim();
    if (!text) return;
    sendTextMessage(text);
    setTextInput('');
  };

  const statusColor: Record<string, string> = {
    disconnected: '#94a3b8',
    connecting: '#f59e0b',
    connected: '#22c55e',
    error: '#ef4444',
  };

  return (
    <>
      {/* Connection bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: '#f8fafc',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: statusColor[status] ?? '#94a3b8',
            boxShadow: status === 'connected' ? '0 0 6px #22c55e' : 'none',
          }}
        />
        <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
          {status.toUpperCase()}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={status === 'connected' ? disconnect : connect}
          disabled={status === 'connecting'}
          style={{
            padding: '6px 16px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: 13,
            background: status === 'connected' ? '#fee2e2' : '#dbeafe',
            color: status === 'connected' ? '#dc2626' : '#2563eb',
          }}
        >
          {status === 'connected'
            ? 'Disconnect'
            : status === 'connecting'
              ? 'Connecting…'
              : 'Connect'}
        </button>
      </div>

      {/* Audio controls */}
      {status === 'connected' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={toggleMic}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13,
              background: isCapturing ? '#fecaca' : '#d1fae5',
              color: isCapturing ? '#b91c1c' : '#065f46',
              animation: isCapturing ? 'pulse 1.5s infinite' : 'none',
            }}
          >
            {isCapturing ? '⏹ Stop Mic' : '🎙 Start Mic'}
          </button>
          {isPlaying && (
            <button
              onClick={stopPlayback}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: 13,
                background: '#fef3c7',
                color: '#92400e',
              }}
            >
              ⏸ Stop Playback
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowEvents(v => !v)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 12,
              background: showEvents ? '#f1f5f9' : 'white',
              color: '#475569',
            }}
          >
            {showEvents ? 'Hide' : 'Show'} Events ({events.length})
          </button>
        </div>
      )}

      {/* Text input */}
      {status === 'connected' && (
        <form
          onSubmit={handleSendText}
          style={{ display: 'flex', gap: 8, marginBottom: 20 }}
        >
          <input
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder="Type a message…"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 14,
              background: '#2563eb',
              color: 'white',
            }}
          >
            Send
          </button>
        </form>
      )}

      {/* Messages */}
      <div
        style={{
          minHeight: 200,
          maxHeight: 400,
          overflowY: 'auto',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 16,
          background: 'white',
          marginBottom: 16,
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: '#94a3b8', textAlign: 'center', fontSize: 14 }}>
            {status === 'connected'
              ? 'Start talking or type a message…'
              : 'Connect to start a conversation'}
          </p>
        )}
        {messages.map(message => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              justifyContent:
                message.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: 12,
                fontSize: 14,
                lineHeight: 1.5,
                background: message.role === 'user' ? '#2563eb' : '#f1f5f9',
                color: message.role === 'user' ? 'white' : '#1e293b',
              }}
            >
              {message.parts.map((part, index) => {
                switch (part.type) {
                  case 'text':
                    return (
                      <span key={index}>
                        {part.text}
                        {part.state === 'streaming' && (
                          <span
                            style={{
                              display: 'inline-block',
                              width: 6,
                              height: 14,
                              marginLeft: 2,
                              background:
                                message.role === 'user' ? '#bfdbfe' : '#94a3b8',
                              animation: 'blink 1s infinite',
                            }}
                          />
                        )}
                      </span>
                    );

                  case 'dynamic-tool':
                    return (
                      <div
                        key={index}
                        style={{
                          marginTop: 6,
                          padding: '6px 10px',
                          borderRadius: 8,
                          background:
                            message.role === 'user' ? '#1d4ed8' : '#e2e8f0',
                          fontSize: 12,
                          fontFamily: 'monospace',
                        }}
                      >
                        {part.state === 'input-streaming' && (
                          <span style={{ color: '#a78bfa' }}>
                            ⚙ Calling {part.toolName || 'tool'}
                            {'…'}
                          </span>
                        )}
                        {part.state === 'input-available' && (
                          <span style={{ color: '#f59e0b' }}>
                            ▶ {part.toolName}({JSON.stringify(part.input)})
                          </span>
                        )}
                        {part.state === 'output-available' && (
                          <span style={{ color: '#22c55e' }}>
                            ✓ {part.toolName}: {JSON.stringify(part.output)}
                          </span>
                        )}
                      </div>
                    );

                  default:
                    return null;
                }
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Event log */}
      {showEvents && (
        <div
          style={{
            maxHeight: 350,
            overflowY: 'auto',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            background: '#1e293b',
            padding: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#94a3b8',
              marginBottom: 8,
              fontFamily: 'monospace',
            }}
          >
            EVENT LOG ({events.length})
          </div>
          {events
            .filter(e => e.type !== 'audio-delta')
            .map((event, i) => (
              <div key={i} style={{ marginBottom: 2 }}>
                <div
                  onClick={() =>
                    setExpandedEvent(expandedEvent === i ? null : i)
                  }
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color:
                      event.type === 'error'
                        ? '#fca5a5'
                        : event.type === 'custom'
                          ? '#fbbf24'
                          : event.type.includes('function')
                            ? '#a78bfa'
                            : event.type.includes('text')
                              ? '#86efac'
                              : event.type.includes('audio')
                                ? '#93c5fd'
                                : '#cbd5e1',
                    background: expandedEvent === i ? '#334155' : 'transparent',
                  }}
                >
                  <span style={{ color: '#64748b' }}>
                    {new Date().toLocaleTimeString('en', { hour12: false })}
                  </span>{' '}
                  {event.type === 'custom'
                    ? `custom (${event.rawType})`
                    : event.type}
                </div>
                {expandedEvent === i && (
                  <pre
                    style={{
                      padding: '8px 12px',
                      margin: '2px 0 6px',
                      borderRadius: 4,
                      background: '#0f172a',
                      color: '#e2e8f0',
                      fontSize: 11,
                      overflow: 'auto',
                      maxHeight: 200,
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {JSON.stringify(event, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          <div ref={eventsEndRef} />
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </>
  );
}
