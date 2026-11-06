import type { anthropic } from '@ai-sdk/anthropic';
import type { UIToolInvocation } from 'ai';

export default function AnthropicWebFetchView({
  invocation,
}: {
  invocation: UIToolInvocation<
    ReturnType<typeof anthropic.tools.webFetch_20250910>
  >;
}) {
  switch (invocation.state) {
    case 'input-streaming':
    case 'input-available':
      return (
        <div className="mb-2 bg-gray-900 text-gray-50 rounded-xl border border-gray-600 shadow-lg">
          Analyzing the following URL: {invocation.input?.url}
        </div>
      );
    case 'output-available':
      return (
        <>
          <div className="mb-2 bg-gray-900 text-gray-50 rounded-xl border border-gray-600 shadow-lg">
            Analyzing the following URL: {invocation.input.url}
          </div>
          <div className="mb-2 bg-gray-900 text-gray-50 rounded-xl border border-gray-600 shadow-lg">
            {JSON.stringify(invocation.output, null, 2)}
          </div>
        </>
      );
  }
}
