import type { anthropic } from '@ai-sdk/anthropic';
import type { UIToolInvocation } from 'ai';

export default function AnthropicAdvisor20260301View({
  invocation,
}: {
  invocation: UIToolInvocation<
    ReturnType<typeof anthropic.tools.advisor_20260301>
  >;
}) {
  switch (invocation.state) {
    case 'input-streaming':
    case 'input-available': {
      return (
        <div className="flex flex-col gap-2 p-3 bg-violet-50 rounded border-l-4 border-violet-400 shadow">
          <div className="flex items-center font-semibold text-violet-700">
            <span className="inline-block mr-2 bg-violet-200 text-violet-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              ADVISOR
            </span>
            Consulting advisor model...
          </div>
          <div className="pl-5 text-xs text-violet-600 italic">
            Executor paused while the advisor sub-inference runs server-side.
          </div>
        </div>
      );
    }
    case 'output-available': {
      const output = invocation.output;

      if (output.type === 'advisor_result') {
        return (
          <div className="flex flex-col gap-2 p-3 bg-violet-50 rounded border-l-4 border-violet-400 shadow">
            <div className="flex items-center font-semibold text-violet-700">
              <span className="inline-block mr-2 bg-violet-200 text-violet-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
                ADVISOR
              </span>
              Advice received
            </div>
            <div className="pl-5 text-sm text-violet-900 whitespace-pre-wrap">
              {output.text}
            </div>
          </div>
        );
      }

      if (output.type === 'advisor_redacted_result') {
        return (
          <div className="flex flex-col gap-2 p-3 bg-violet-50 rounded border-l-4 border-violet-400 shadow">
            <div className="flex items-center font-semibold text-violet-700">
              <span className="inline-block mr-2 bg-violet-200 text-violet-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
                ADVISOR
              </span>
              Encrypted advice received
            </div>
            <div className="pl-5 text-xs text-violet-700 italic">
              Advice is encrypted; round-tripped to the server on the next turn.
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-col gap-2 p-3 bg-red-50 rounded border-l-4 border-red-400 shadow">
          <div className="flex items-center font-semibold text-red-700">
            <span className="inline-block mr-2 bg-red-200 text-red-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              ADVISOR
            </span>
            Advisor call failed
          </div>
          <div className="pl-5 text-sm text-red-800">
            <span className="font-semibold">Error code:</span>{' '}
            <span className="inline-block bg-white border border-red-100 rounded px-2 py-0.5 font-mono">
              {output.errorCode}
            </span>
          </div>
        </div>
      );
    }
  }
}
