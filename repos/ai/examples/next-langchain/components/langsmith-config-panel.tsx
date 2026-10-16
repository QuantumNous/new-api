'use client';

import { useState } from 'react';
import { Server } from 'lucide-react';

interface LangsmithConfigPanelProps {
  deploymentUrl: string;
  customUrl: string;
  setCustomUrl: (url: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  localDevUrl: string;
}

export function LangsmithConfigPanel({
  deploymentUrl,
  customUrl,
  setCustomUrl,
  apiKey,
  setApiKey,
  localDevUrl,
}: LangsmithConfigPanelProps) {
  const [showConfig, setShowConfig] = useState(false);

  return (
    <div className="p-4 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-light)] flex items-center justify-center">
            <Server className="w-4 h-4 text-[var(--accent)]" strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm font-medium text-[var(--foreground)]">
              Connected to
            </div>
            <code className="text-xs text-[var(--accent)]">
              {deploymentUrl}
            </code>
          </div>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="px-3 py-1.5 text-xs font-medium text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--background-secondary)] rounded-lg transition-colors"
        >
          {showConfig ? 'Hide' : 'Configure'}
        </button>
      </div>

      {showConfig && (
        <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-3 animate-fade-in">
          <div>
            <label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1.5">
              Deployment URL
            </label>
            <input
              type="url"
              value={customUrl}
              onChange={e => setCustomUrl(e.target.value)}
              placeholder={`Default: ${localDevUrl}`}
              className="w-full px-3 py-2 text-sm bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1.5">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Required for LangSmith deployments"
              className="w-full px-3 py-2 text-sm bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <p className="text-xs text-[var(--foreground-secondary)]">
            💡 The local server starts automatically with{' '}
            <code className="text-[var(--accent)]">pnpm dev</code>
          </p>
        </div>
      )}
    </div>
  );
}
