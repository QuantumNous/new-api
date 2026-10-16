'use client';

interface ToolInvocationProps {
  toolName: string;
  input?: unknown;
  output?: unknown;
}

/**
 * Renders a tool invocation message part
 */
export function ToolInvocation({
  toolName,
  input,
  output,
}: ToolInvocationProps) {
  return (
    <div className="p-3 bg-[var(--background-secondary)] rounded-lg border border-[var(--border)] text-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-5 h-5 rounded bg-[var(--accent-light)] flex items-center justify-center">
          🔧
        </span>
        <span className="font-medium text-[var(--foreground)]">{toolName}</span>
      </div>

      {input !== undefined && (
        <div className="text-[var(--foreground-muted)] font-mono text-xs mb-1">
          <span className="text-[var(--foreground-secondary)]">Input: </span>
          {JSON.stringify(input)}
        </div>
      )}

      {output !== undefined && (
        <div className="text-[var(--success)] font-mono text-xs break-all">
          <span className="text-[var(--foreground-secondary)]">Result: </span>
          {typeof output === 'string' && output.length > 200
            ? `${output.slice(0, 200)}...`
            : JSON.stringify(output)}
        </div>
      )}
    </div>
  );
}
