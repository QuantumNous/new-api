'use client';

import { MessageCircle, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  onSend: (message: string) => void;
  suggestions?: string[];
}

export function EmptyState({ onSend, suggestions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-amber-600/20 to-yellow-500/20 flex items-center justify-center">
        <MessageCircle className="w-8 h-8 text-amber-400" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
        Start a conversation
      </h3>
      <p className="text-sm text-[var(--foreground-secondary)] max-w-xs mb-6">
        Send a message to begin chatting with the AI assistant.
      </p>

      {/* Suggestion chips */}
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-col gap-2 w-full max-w-md">
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--foreground-secondary)] mb-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Try an example</span>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onSend(suggestion)}
                className="px-4 py-2.5 text-sm bg-[var(--background-tertiary)] border border-[var(--border-hover)] rounded-full text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)] transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
