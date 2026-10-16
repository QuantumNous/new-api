import type { openai } from '@ai-sdk/openai';
import type { UIToolInvocation } from 'ai';

export default function OpenAIWebSearchView({
  invocation,
}: {
  invocation: UIToolInvocation<ReturnType<typeof openai.tools.webSearch>>;
}) {
  switch (invocation.state) {
    case 'input-available': {
      return (
        <div className="flex flex-col gap-2 p-3 bg-blue-50 rounded border-l-4 border-blue-400 shadow">
          <div className="flex items-center font-semibold text-blue-700">
            <span className="inline-block mr-2 bg-blue-200 text-blue-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              SEARCH
            </span>
            Searching the web...
          </div>
        </div>
      );
    }
    case 'output-available': {
      const output = invocation.output;

      switch (output.action?.type) {
        case 'search':
          return (
            <div className="flex flex-col gap-2 p-3 bg-blue-50 rounded border-l-4 border-blue-400 shadow">
              <div className="flex items-center font-semibold text-blue-700">
                <span className="inline-block mr-2 bg-blue-200 text-blue-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
                  SEARCH
                </span>
                Searched the web
              </div>
              <div className="pl-5 text-sm text-blue-800">
                <span className="font-semibold">Query:</span>{' '}
                <span className="inline-block bg-white border border-blue-100 rounded px-2 py-0.5 font-mono">
                  {output.action.query}
                </span>
              </div>
              {output.sources && output.sources.length > 0 && (
                <div className="pl-5 text-sm text-blue-800">
                  <span className="font-semibold">Sources:</span>
                  <ul className="mt-1 list-disc pl-5 break-all">
                    {output.sources.map((s, i) => (
                      <li key={i}>
                        {s.type === 'url' ? (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-blue-700"
                          >
                            {s.url}
                          </a>
                        ) : (
                          <span className="inline-block bg-blue-100 text-blue-900 rounded px-2 py-0.5 text-xs font-mono">
                            API: {s.name}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        case 'openPage':
          return (
            <div className="flex flex-col gap-2 p-3 bg-green-50 rounded border-l-4 border-green-500 shadow">
              <div className="flex items-center font-semibold text-green-800">
                <span className="inline-block mr-2 bg-green-200 text-green-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
                  OPEN PAGE
                </span>
                Opened a page
              </div>
              {output.action.url && (
                <div className="pl-5 text-sm text-green-900 break-all">
                  <span className="font-semibold">URL:</span>{' '}
                  <a
                    href={output.action.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-green-700"
                  >
                    {output.action.url}
                  </a>
                </div>
              )}
            </div>
          );
        case 'findInPage':
          return (
            <div className="flex flex-col gap-2 p-3 bg-yellow-50 rounded border-l-4 border-yellow-500 shadow">
              <div className="flex items-center font-semibold text-yellow-800">
                <span className="inline-block mr-2 bg-yellow-200 text-yellow-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
                  FIND IN PAGE
                </span>
                Searched for pattern in page
              </div>
              {output.action.url && (
                <div className="pl-5 text-sm text-yellow-900 break-all">
                  <span className="font-semibold">URL:</span>{' '}
                  <a
                    href={output.action.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-yellow-700"
                  >
                    {output.action.url}
                  </a>
                </div>
              )}
              <div className="pl-5 text-sm text-yellow-900">
                <span className="font-semibold">Pattern:</span>{' '}
                <span className="inline-block bg-white border border-yellow-100 rounded px-2 py-0.5 font-mono">
                  {output.action.pattern}
                </span>
              </div>
            </div>
          );
      }
    }
  }
}
