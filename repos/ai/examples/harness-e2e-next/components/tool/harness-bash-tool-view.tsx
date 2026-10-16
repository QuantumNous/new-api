'use client';

import CollapsibleOutput from './collapsible-output';
import ToolSpinner from './tool-spinner';

type BashInvocation = {
  state: string;
  input?: {
    command?: string;
  };
  output?: unknown;
  errorText?: string;
};

const PRE_CLASS =
  'overflow-x-auto px-2 py-1.5 font-mono text-sm text-black whitespace-pre-wrap bg-gray-100 rounded-lg border border-gray-300';
const PRE_CLASS_ERROR =
  'overflow-x-auto px-2 py-1.5 font-mono text-sm text-red-600 whitespace-pre-wrap bg-red-50 rounded-lg border border-red-300';

export default function HarnessBashToolView({
  invocation,
}: {
  invocation: BashInvocation;
}) {
  const command = invocation.input?.command ?? '';
  const running =
    invocation.state === 'input-streaming' ||
    invocation.state === 'input-available';

  return (
    <div className="relative mb-2 text-sm text-gray-500">
      {running && <ToolSpinner />}
      <div>
        <strong>Bash</strong>(<code>{command}</code>)
      </div>
      <BashOutput invocation={invocation} />
    </div>
  );
}

function BashOutput({ invocation }: { invocation: BashInvocation }) {
  switch (invocation.state) {
    case 'output-available': {
      const output = invocation.output;
      const isString = typeof output === 'string';
      const stdout = isString
        ? output
        : typeof (output as Record<string, unknown>)?.stdout === 'string'
          ? ((output as Record<string, unknown>).stdout as string)
          : undefined;
      const stderr =
        !isString &&
        typeof (output as Record<string, unknown>)?.stderr === 'string'
          ? ((output as Record<string, unknown>).stderr as string)
          : undefined;
      const exitCodeRaw = !isString
        ? (output as Record<string, unknown>)?.exitCode
        : undefined;
      const exitCode =
        typeof exitCodeRaw === 'number' ? exitCodeRaw : undefined;

      const hasBoth = !!stdout && !!stderr;

      if (!stdout && !stderr && exitCode === undefined) {
        return null;
      }

      return (
        <div className="mt-1 ml-4 space-y-2">
          {exitCode !== undefined && exitCode !== 0 && (
            <div className="text-sm font-medium text-red-600">
              Exit code: {exitCode}
            </div>
          )}

          {stdout && (
            <div>
              {hasBoth && (
                <div className="mb-1 text-xs font-medium text-black">
                  Output
                </div>
              )}
              <CollapsibleOutput content={stdout} className={PRE_CLASS} />
            </div>
          )}

          {stderr && (
            <div>
              {hasBoth && (
                <div className="mb-1 text-xs font-medium text-red-600">
                  Error
                </div>
              )}
              <CollapsibleOutput content={stderr} className={PRE_CLASS_ERROR} />
            </div>
          )}
        </div>
      );
    }

    case 'output-denied':
      return (
        <div className="mt-1 ml-4 text-sm font-medium text-red-600">
          Execution was denied by user.
        </div>
      );

    case 'output-error':
      return (
        <div className="mt-1 ml-4">
          <CollapsibleOutput
            content={invocation.errorText ?? 'Unknown error'}
            className={PRE_CLASS_ERROR}
          />
        </div>
      );

    default:
      return null;
  }
}
