'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { AlertCircle, Sparkles, Shield } from 'lucide-react';
import { ChatMessage } from '../../components/chat-message';
import { ChatInput } from '../../components/chat-input';
import {
  ToolApprovalCard,
  getPendingApprovals,
} from '../../components/tool-approval-card';
import type { CustomDataMessage } from '../types';

/**
 * Generate a unique thread ID for HITL persistence
 */
function generateThreadId() {
  return `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export default function HITLPage() {
  const [threadId] = useState(() => generateThreadId());

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/hitl',
        body: { threadId },
      }),
    [threadId],
  );

  const { messages, status, error, sendMessage, addToolApprovalResponse } =
    useChat<CustomDataMessage>({
      transport,
      /**
       * Automatically send a new request when tool approval responses are added.
       * This checks if there are any dynamic-tool parts with approval-responded state
       * that don't have output yet (meaning the tool hasn't been executed).
       */
      sendAutomaticallyWhen: ({ messages }) => {
        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'assistant') return false;

        // Check if there's a tool with approval-responded that needs execution
        // Use part.output == null to check for both undefined and null
        const hasApprovalResponse = lastMessage.parts.some(
          part =>
            part.type === 'dynamic-tool' &&
            part.state === 'approval-responded' &&
            (part as { output?: unknown }).output == null,
        );

        return hasApprovalResponse;
      },
    });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const pendingApprovals = getPendingApprovals(messages);

  const handleApprove = useCallback(
    (approvalId: string) => {
      addToolApprovalResponse({ id: approvalId, approved: true });
    },
    [addToolApprovalResponse],
  );

  const handleReject = useCallback(
    (approvalId: string, reason?: string) => {
      addToolApprovalResponse({ id: approvalId, approved: false, reason });
    },
    [addToolApprovalResponse],
  );

  const suggestions = [
    'Send an email to john@example.com saying hello',
    'Search for information about AI',
    'Delete the file report.pdf',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-[var(--border)] rounded-t-xl">
        <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
          Human-in-the-Loop Agent
        </h1>
        <div className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
          Uses LangChain&apos;s <code>humanInTheLoopMiddleware</code> to require
          approval for sensitive actions. Try sending an email or deleting a
          file - you&apos;ll be asked to approve the action before it executes.
          Search operations are auto-approved.
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" strokeWidth={2} />
            {error.message}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-amber-600/20 to-yellow-500/20 flex items-center justify-center">
              <Shield className="w-8 h-8 text-amber-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
              Human-in-the-Loop Demo
            </h3>
            <p className="text-sm text-[var(--foreground-secondary)] max-w-xs mb-6">
              Sensitive actions require your approval before executing.
            </p>

            {/* Suggestion chips */}
            <div className="flex flex-col gap-2 w-full max-w-md">
              <div className="flex items-center justify-center gap-2 text-xs text-[var(--foreground-secondary)] mb-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Try an example</span>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => sendMessage({ text: suggestion })}
                    className="px-4 py-2.5 text-sm bg-[var(--background-tertiary)] border border-[var(--border-hover)] rounded-full text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)] transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map(message => (
              <div key={message.id}>
                <ChatMessage message={message} />
                {/* Render approval cards for this message's pending approvals */}
                {message.role === 'assistant' &&
                  message.parts
                    .filter(
                      part =>
                        part.type === 'dynamic-tool' &&
                        part.state === 'approval-requested',
                    )
                    .map(part => {
                      if (
                        part.type !== 'dynamic-tool' ||
                        part.state !== 'approval-requested'
                      )
                        return null;
                      return (
                        <ToolApprovalCard
                          key={part.approval.id}
                          toolName={part.toolName}
                          input={part.input}
                          approvalId={part.approval.id}
                          onApprove={handleApprove}
                          onReject={handleReject}
                        />
                      );
                    })}
              </div>
            ))}

            {(status === 'submitted' || status === 'streaming') && (
              <div className="flex items-center gap-2 text-[var(--foreground-muted)]">
                <div className="flex gap-1">
                  <span
                    className="w-2 h-2 bg-[var(--accent)] rounded-full"
                    style={{ animation: 'typing 1s infinite 0s' }}
                  />
                  <span
                    className="w-2 h-2 bg-[var(--accent)] rounded-full"
                    style={{ animation: 'typing 1s infinite 0.2s' }}
                  />
                  <span
                    className="w-2 h-2 bg-[var(--accent)] rounded-full"
                    style={{ animation: 'typing 1s infinite 0.4s' }}
                  />
                </div>
                <span className="text-sm">AI is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={text => sendMessage({ text })}
        disabled={
          status === 'submitted' ||
          status === 'streaming' ||
          pendingApprovals.length > 0
        }
        placeholder={
          pendingApprovals.length > 0
            ? 'Please approve or reject the pending action...'
            : 'Ask me to send an email, search, or delete a file...'
        }
      />
    </div>
  );
}
