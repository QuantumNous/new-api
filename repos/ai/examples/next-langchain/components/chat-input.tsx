'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Send a message...',
}: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex items-center gap-3 p-4 border-t border-[var(--border)] bg-[var(--background-secondary)] rounded-b-xl"
    >
      <div className="flex-1 relative">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full px-4 py-3 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder-[var(--foreground-muted)] resize-none focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: '48px', maxHeight: '200px' }}
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="flex-shrink-0 w-12 h-12 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="w-5 h-5" strokeWidth={2} />
      </button>
    </form>
  );
}
