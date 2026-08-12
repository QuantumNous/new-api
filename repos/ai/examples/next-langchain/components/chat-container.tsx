'use client';

import type { ChatStatus } from 'ai';
import { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { ThinkingIndicator } from './thinking-indicator';
import { EmptyState } from './empty-state';
import type { CustomDataMessage } from '../app/types';

interface ChatContainerProps {
  messages: CustomDataMessage[];
  onSend: (message: string) => void;
  status: ChatStatus;
  error?: Error | undefined;
  placeholder?: string;
  title: string;
  description?: React.ReactNode;
  configPanel?: React.ReactNode;
  suggestions?: string[];
}

export function ChatContainer({
  messages,
  onSend,
  status,
  error,
  placeholder,
  title,
  description,
  configPanel,
  suggestions,
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-[var(--border)] rounded-t-xl">
        <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
          {title}
        </h1>
        {description && (
          <div className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
            {description}
          </div>
        )}
        {configPanel && <div className="mt-4">{configPanel}</div>}
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
          <EmptyState onSend={onSend} suggestions={suggestions} />
        ) : (
          <>
            {messages.map(message => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <ThinkingIndicator
              isStreaming={status === 'submitted' || status === 'streaming'}
            />
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSend}
        disabled={status === 'submitted' || status === 'streaming'}
        placeholder={placeholder}
      />
    </div>
  );
}
