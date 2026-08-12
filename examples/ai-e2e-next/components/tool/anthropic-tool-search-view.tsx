import type { anthropic } from '@ai-sdk/anthropic';
import type { UIToolInvocation } from 'ai';

export default function AnthropicToolSearchView({
  invocation,
}: {
  invocation: UIToolInvocation<
    ReturnType<typeof anthropic.tools.toolSearchBm25_20251119>
  >;
}) {
  switch (invocation.state) {
    case 'input-available': {
      return (
        <div className="flex flex-col gap-2 p-3 bg-amber-50 rounded border-l-4 border-amber-400 shadow">
          <div className="flex items-center font-semibold text-amber-700">
            <span className="inline-block mr-2 bg-amber-200 text-amber-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              TOOL SEARCH
            </span>
            Searching for tools...
          </div>
          <div className="pl-5 text-sm text-amber-800">
            <span className="font-semibold">Query:</span>{' '}
            <span className="inline-block bg-white border border-amber-100 rounded px-2 py-0.5 font-mono">
              {invocation.input.query}
            </span>
          </div>
          <div className="pl-5 text-xs text-amber-600 italic">
            Discovering relevant tools from the available catalog...
          </div>
        </div>
      );
    }
    case 'output-available': {
      const output = invocation.output;
      return (
        <div className="flex flex-col gap-2 p-3 bg-amber-50 rounded border-l-4 border-amber-400 shadow">
          <div className="flex items-center font-semibold text-amber-700">
            <span className="inline-block mr-2 bg-amber-200 text-amber-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              TOOL SEARCH
            </span>
            Found {output.length} tool{output.length !== 1 ? 's' : ''}
          </div>
          <div className="pl-5 text-sm text-amber-800">
            <span className="font-semibold">Query:</span>{' '}
            <span className="inline-block bg-white border border-amber-100 rounded px-2 py-0.5 font-mono">
              {invocation.input.query}
            </span>
          </div>
          {output.length > 0 && (
            <div className="pl-5 text-sm text-amber-900">
              <span className="font-semibold">Discovered tools:</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {output.map((tool, index) => (
                  <span
                    key={index}
                    className="inline-block bg-amber-100 border border-amber-200 rounded px-2 py-0.5 font-mono text-xs"
                  >
                    {tool.toolName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
  }
}
