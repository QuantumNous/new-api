'use client';

import { useChat } from '@ai-sdk/react';
import { WorkflowChatTransport } from '@ai-sdk/workflow';
import { useRef, useEffect, useMemo, useState } from 'react';

export default function TestChat() {
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const ts = new Date().toISOString().split('T')[1].split('.')[0];
    setLog(prev => [...prev, `[${ts}] ${msg}`]);
  };

  const transport = useMemo(
    () =>
      new WorkflowChatTransport({
        api: '/api/test-chat',
        maxConsecutiveErrors: 5,
        initialStartIndex: -50,
        onChatSendMessage: response => {
          const runId = response.headers.get('x-workflow-run-id');
          addLog(`POST response received, runId=${runId}`);
        },
        onChatEnd: ({ chatId, chunkIndex }) => {
          addLog(`Chat ended: chatId=${chatId}, total chunks=${chunkIndex}`);
        },
      }),
    [],
  );

  const { status, sendMessage, messages } = useChat({
    transport,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (status === 'streaming') {
      addLog('Status: streaming');
    } else if (status === 'submitted') {
      addLog('Status: submitted');
    } else if (status === 'ready') {
      addLog('Status: ready');
    }
  }, [status]);

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      <header className="p-4 border-b">
        <h1 className="text-lg font-semibold">
          WorkflowChatTransport Test Page
        </h1>
        <p className="text-sm text-gray-500">
          Tests stream interruption recovery. The POST endpoint sends a partial
          stream (no finish event), forcing the transport to reconnect via GET.
        </p>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat panel */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <p className="text-gray-400 text-center mt-8">
              Send a message to test stream interruption + reconnection
            </p>
          )}
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {message.parts.map((part, index) => {
                  if (part.type === 'text') {
                    return (
                      <div key={index} className="whitespace-pre-wrap">
                        {part.text}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Log panel */}
        <div className="w-80 border-l bg-gray-50 flex flex-col">
          <div className="p-2 border-b bg-gray-100 font-mono text-xs font-semibold">
            Transport Log
          </div>
          <div
            id="log-panel"
            className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1"
          >
            {log.map((entry, i) => (
              <div
                key={i}
                className={`${
                  entry.includes('POST response')
                    ? 'text-blue-600'
                    : entry.includes('Chat ended')
                      ? 'text-green-600'
                      : entry.includes('error') || entry.includes('Error')
                        ? 'text-red-600'
                        : 'text-gray-600'
                }`}
              >
                {entry}
              </div>
            ))}
          </div>
        </div>
      </div>

      <form
        className="p-4 border-t flex gap-2"
        onSubmit={e => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem(
            'message',
          ) as HTMLInputElement;
          if (input.value.trim()) {
            addLog(`Sending: "${input.value}"`);
            sendMessage({ text: input.value });
            input.value = '';
          }
        }}
      >
        <input
          name="message"
          type="text"
          placeholder="Type a message to test reconnection..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={status === 'streaming' || status === 'submitted'}
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
          disabled={status === 'streaming' || status === 'submitted'}
        >
          Send
        </button>
      </form>
    </div>
  );
}
