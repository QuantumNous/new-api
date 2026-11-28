import type { anthropic } from '@ai-sdk/anthropic';
import type { UIToolInvocation } from 'ai';

export default function AnthropicWebSearchView({
  invocation,
}: {
  invocation: UIToolInvocation<
    ReturnType<typeof anthropic.tools.webSearch_20250305>
  >;
}) {
  switch (invocation.state) {
    case 'input-available': {
      return (
        <div className="flex flex-col gap-2 p-3 bg-indigo-50 rounded border-l-4 border-indigo-400 shadow">
          <div className="flex items-center font-semibold text-indigo-700">
            <span className="inline-block mr-2 bg-indigo-200 text-indigo-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              SEARCH
            </span>
            Searching the web...
          </div>
          <div className="pl-5 text-sm text-indigo-800">
            <span className="font-semibold">Query:</span>{' '}
            <span className="inline-block bg-white border border-indigo-100 rounded px-2 py-0.5 font-mono">
              {invocation.input.query}
            </span>
          </div>
        </div>
      );
    }
    case 'output-available': {
      const output = invocation.output;
      return (
        <div className="flex flex-col gap-2 p-3 bg-indigo-50 rounded border-l-4 border-indigo-400 shadow">
          <div className="flex items-center font-semibold text-indigo-700">
            <span className="inline-block mr-2 bg-indigo-200 text-indigo-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              SEARCH
            </span>
            Searched the web
          </div>
          <div className="pl-5 text-sm text-indigo-800">
            <span className="font-semibold">Query:</span>{' '}
            <span className="inline-block bg-white border border-indigo-100 rounded px-2 py-0.5 font-mono">
              {invocation.input.query}
            </span>
          </div>
          <div className="pl-5 text-xs text-indigo-900 whitespace-pre-wrap">
            <span className="font-semibold">Result:</span>{' '}
            <span className="font-mono break-all">
              {output.map(result => (
                <div key={result.url}>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-indigo-700"
                  >
                    {result.title}
                  </a>
                </div>
              ))}
            </span>
          </div>
        </div>
      );
    }
  }
}
