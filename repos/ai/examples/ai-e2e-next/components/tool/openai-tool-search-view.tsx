import type { openai } from '@ai-sdk/openai';
import type { UIToolInvocation } from 'ai';

export default function OpenAIToolSearchView({
  invocation,
}: {
  invocation: UIToolInvocation<ReturnType<typeof openai.tools.toolSearch>>;
}) {
  switch (invocation.state) {
    case 'input-available': {
      return (
        <div className="flex flex-col gap-2 p-3 bg-purple-50 rounded border-l-4 border-purple-400 shadow">
          <div className="flex items-center font-semibold text-purple-700">
            <span className="inline-block mr-2 bg-purple-200 text-purple-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              TOOL SEARCH
            </span>
            Searching for tools...
          </div>
          <div className="pl-5 text-xs text-purple-600 italic">
            OpenAI is discovering relevant tools from the available catalog...
          </div>
        </div>
      );
    }
    case 'output-available': {
      const output = invocation.output;
      const tools = output.tools ?? [];
      return (
        <div className="flex flex-col gap-2 p-3 bg-purple-50 rounded border-l-4 border-purple-400 shadow">
          <div className="flex items-center font-semibold text-purple-700">
            <span className="inline-block mr-2 bg-purple-200 text-purple-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              TOOL SEARCH
            </span>
            Loaded {tools.length} tool{tools.length !== 1 ? 's' : ''}
          </div>
          {tools.length > 0 && (
            <div className="pl-5 text-sm text-purple-900">
              <span className="font-semibold">Discovered tools:</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tools.map((tool, index) => (
                  <span
                    key={index}
                    className="inline-block bg-purple-100 border border-purple-200 rounded px-2 py-0.5 font-mono text-xs"
                  >
                    {(tool as { name?: string }).name ?? 'unknown'}
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
