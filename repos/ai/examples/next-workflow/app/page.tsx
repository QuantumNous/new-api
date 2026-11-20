'use client';

import { useChat } from '@ai-sdk/react';
import { WorkflowChatTransport } from '@ai-sdk/workflow';
import { lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';
import Link from 'next/link';
import { useRef, useEffect, useMemo } from 'react';

export default function Chat() {
  const transport = useMemo(
    () =>
      new WorkflowChatTransport({
        api: '/api/chat',
        maxConsecutiveErrors: 5,
        initialStartIndex: -50,
      }),
    [],
  );

  const { status, sendMessage, messages, addToolApprovalResponse } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      <header className="p-4 border-b">
        <h1 className="text-lg font-semibold">WorkflowAgent Chat</h1>
        <p className="text-sm text-gray-500">
          A workflow AI agent with weather, calculator, and file tools
        </p>
        <Link
          href="/telemetry"
          className="mt-2 inline-block text-sm text-blue-600 hover:underline"
        >
          Open telemetry e2e harness
        </Link>
        <Link
          href="/sandbox"
          className="ml-4 mt-2 inline-block text-sm text-blue-600 hover:underline"
        >
          Open sandbox e2e harness
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                const p = part as any;
                if (part.type === 'text') {
                  return (
                    <div key={index} className="whitespace-pre-wrap">
                      {part.text}
                    </div>
                  );
                }
                if (p.type?.startsWith('tool-') && p.toolCallId) {
                  const toolName = p.type.replace('tool-', '');

                  if (p.state === 'approval-requested' && p.approval?.id) {
                    return (
                      <div
                        key={index}
                        className="my-2 p-3 bg-amber-50 rounded border border-amber-200"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-amber-600 text-lg">
                            &#9888;
                          </span>
                          <span className="font-semibold text-amber-800">
                            Approval Required
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-1">
                          The assistant wants to use{' '}
                          <code className="bg-amber-100 px-1 rounded font-semibold">
                            {toolName}
                          </code>
                        </p>
                        <pre className="text-xs bg-white rounded p-2 mb-3 border overflow-x-auto">
                          {JSON.stringify(p.input, null, 2)}
                        </pre>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              addToolApprovalResponse({
                                id: p.approval.id,
                                approved: true,
                              })
                            }
                            className="rounded-lg bg-green-500 px-4 py-1.5 text-sm text-white hover:bg-green-600 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              addToolApprovalResponse({
                                id: p.approval.id,
                                approved: false,
                                reason: 'User denied the operation.',
                              })
                            }
                            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm text-white hover:bg-red-600 transition-colors"
                          >
                            Deny
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (p.state === 'approval-responded') {
                    return (
                      <div
                        key={index}
                        className={`my-2 p-2 rounded text-sm border ${
                          p.approval?.approved
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                      >
                        <code>{toolName}</code>{' '}
                        {p.approval?.approved
                          ? 'approved — executing...'
                          : 'denied'}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={index}
                      className="my-2 p-2 bg-white/50 rounded text-sm border"
                    >
                      <div className="font-mono text-xs text-gray-500">
                        {toolName}
                      </div>
                      {p.state === 'output-available' && (
                        <pre className="mt-1 text-xs overflow-x-auto">
                          {JSON.stringify(p.output, null, 2)}
                        </pre>
                      )}
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

      <form
        className="p-4 border-t flex gap-2"
        onSubmit={e => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem(
            'message',
          ) as HTMLInputElement;
          if (input.value.trim()) {
            sendMessage({ text: input.value });
            input.value = '';
          }
        }}
      >
        <input
          name="message"
          type="text"
          placeholder="Ask about weather, math, or file operations..."
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
