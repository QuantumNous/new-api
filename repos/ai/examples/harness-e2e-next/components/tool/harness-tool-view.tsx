'use client';

import type { DynamicToolUIPart } from 'ai';
import CollapsibleOutput from './collapsible-output';
import ToolSpinner from './tool-spinner';

const PRE_CLASS =
  'overflow-x-auto px-2 py-1.5 font-mono text-sm text-black whitespace-pre-wrap bg-gray-100 rounded-lg border border-gray-300';

/**
 * Generic, tool-agnostic renderer for any harness tool invocation. Displays
 * the call as `ToolName(arg)` with a spinner while the tool is still working
 * and the (collapsible) output indented below once it resolves.
 */
export default function HarnessToolView({
  toolName,
  toolArg,
  state,
  output,
  errorText,
}: {
  toolName: string;
  toolArg?: string;
  state: DynamicToolUIPart['state'];
  output?: unknown;
  errorText?: string;
}) {
  const running = state === 'input-streaming' || state === 'input-available';

  const outputText =
    output === undefined
      ? undefined
      : typeof output === 'string'
        ? output
        : JSON.stringify(output, null, 2);

  return (
    <div className="relative mb-2 text-sm text-gray-500">
      {running && <ToolSpinner />}
      <div>
        <strong>{toolName}</strong>(<code>{toolArg}</code>)
      </div>
      {state !== 'output-error' && outputText && (
        <div className="mt-1 ml-4">
          <CollapsibleOutput content={outputText} className={PRE_CLASS} />
        </div>
      )}
      {state === 'output-error' && errorText && (
        <div className="mt-1 ml-4">
          <div className="text-sm text-red-500">Error: {errorText}</div>
        </div>
      )}
    </div>
  );
}
