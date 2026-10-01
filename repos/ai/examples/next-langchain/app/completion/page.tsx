'use client';

import { useCompletion } from '@ai-sdk/react';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Send, Sparkles, AlertCircle, Square } from 'lucide-react';

export default function CompletionPage() {
  const { completion, error, isLoading, stop, complete, setCompletion } =
    useCompletion({
      api: '/api/completion',
    });

  const [input, setInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      complete(input);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestion = (suggestion: string) => {
    setInput('');
    setCompletion('');
    complete(suggestion);
  };

  const suggestions = [
    'Write a haiku about programming',
    'Explain quantum computing in one sentence',
    'Generate a creative product name for a smart water bottle',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-[var(--border)] rounded-t-xl">
        <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
          Text Completion
        </h1>
        <div className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
          Simple streaming completion using <code>useCompletion</code> hook with
          LangChain. Enter a prompt and watch the response stream in real-time.
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

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {!completion && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-amber-600/20 to-yellow-500/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-amber-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
              Start a completion
            </h3>
            <p className="text-sm text-[var(--foreground-secondary)] max-w-xs mb-6">
              Enter a prompt below to generate a streaming text completion.
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
                    onClick={() => handleSuggestion(suggestion)}
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
            {/* Completion output */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-600/80 to-yellow-500/80 flex items-center justify-center shadow-lg">
                <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[var(--foreground-secondary)] mb-1.5 uppercase tracking-wide">
                  Assistant
                </div>
                <div className="text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
                  {completion || (
                    <span className="text-[var(--foreground-secondary)] italic">
                      Generating...
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Loading indicator */}
            {isLoading && (
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
                <span className="text-sm">AI is generating...</span>
                <button
                  onClick={stop}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 transition-all"
                >
                  <Square
                    className="w-3 h-3"
                    strokeWidth={2}
                    fill="currentColor"
                  />
                  Stop
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center gap-3 p-4 border-t border-[var(--border)] bg-[var(--background-secondary)] rounded-b-xl"
      >
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter a prompt..."
            disabled={isLoading}
            rows={1}
            className="w-full px-4 py-3 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder-[var(--foreground-muted)] resize-none focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '48px', maxHeight: '200px' }}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="flex-shrink-0 w-12 h-12 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}
