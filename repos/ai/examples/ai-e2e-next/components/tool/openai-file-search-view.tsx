import type { openai } from '@ai-sdk/openai';
import type { UIToolInvocation } from 'ai';

export default function FileSearchView({
  invocation,
}: {
  invocation: UIToolInvocation<ReturnType<typeof openai.tools.fileSearch>>;
}) {
  switch (invocation.state) {
    case 'input-available':
      return (
        <div className="mb-2 bg-gray-900 rounded-xl border border-gray-600 shadow-lg">
          Searching...
        </div>
      );
    case 'output-available':
      return (
        <div className="p-4 mb-2 bg-gray-900 rounded-xl border border-gray-600 shadow-lg">
          <div className="mb-2">
            <span className="font-semibold text-gray-300">Queries:</span>
            <ul className="mt-1 text-sm list-disc list-inside text-gray-100">
              {invocation.output.queries.map((query, index) => (
                <li key={index}>- {query}</li>
              ))}
            </ul>
          </div>
          <div>
            <span className="font-semibold text-gray-300">Results:</span>
            <div className="mt-1 text-sm text-gray-100">
              {invocation.output.results?.map((result, index) => (
                <div key={index} className="p-2 mb-2 bg-gray-800 rounded">
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
  }
}
