'use client';

import { Brain, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface ReasoningProps {
  text: string;
  state: 'streaming' | 'done';
}

/**
 * Collapsible component for reasoning content
 */
export function Reasoning({ text, state }: ReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border border-gray-500/30 rounded-lg bg-gray-500/5 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center gap-2 text-sm text-gray-400 hover:bg-gray-500/10 transition-colors"
      >
        <Brain className="w-4 h-4" />
        <span className="font-medium">
          {state === 'streaming' ? 'Thinking...' : 'Reasoning'}
        </span>
        {state === 'streaming' && (
          <span className="ml-1 flex gap-0.5">
            <span
              className="w-1.5 h-1.5 bg-gray-400 rounded-full"
              style={{ animation: 'typing 1s infinite 0s' }}
            />
            <span
              className="w-1.5 h-1.5 bg-gray-400 rounded-full"
              style={{ animation: 'typing 1s infinite 0.2s' }}
            />
            <span
              className="w-1.5 h-1.5 bg-gray-400 rounded-full"
              style={{ animation: 'typing 1s infinite 0.4s' }}
            />
          </span>
        )}
        <span className="ml-auto">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>
      </button>
      {isExpanded && (
        <div className="px-3 py-2 text-sm text-gray-300/80 whitespace-pre-wrap border-t border-gray-500/20 max-h-64 overflow-y-auto">
          {text || 'Processing...'}
        </div>
      )}
    </div>
  );
}
