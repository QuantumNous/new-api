import type { openai } from '@ai-sdk/openai';
import type { UIToolInvocation } from 'ai';

export default function OpenAIMCPView({
  invocation,
}: {
  invocation: UIToolInvocation<ReturnType<typeof openai.tools.mcp>>;
}) {
  switch (invocation.state) {
    case 'input-streaming':
    case 'input-available': {
      return (
        <div className="mb-4 p-3 bg-blue-50 rounded border-l-4 border-blue-400 shadow">
          <div className="flex items-center font-semibold text-blue-700">
            <span className="inline-block mr-2 bg-blue-200 text-blue-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              MCP
            </span>
            Calling MCP tool...
          </div>
        </div>
      );
    }
    case 'output-available': {
      const output = invocation.output;

      // Handle MCP call output
      if (
        output &&
        typeof output === 'object' &&
        'type' in output &&
        output.type === 'call'
      ) {
        return (
          <div className="mb-4 p-3 bg-green-50 rounded border-l-4 border-green-400 shadow">
            <div className="flex items-center font-semibold text-green-700">
              <span className="inline-block mr-2 bg-green-200 text-green-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
                MCP
              </span>
              MCP tool executed
            </div>
            <div className="mt-2 pl-5 text-sm text-green-800">
              <div className="mb-2">
                <span className="font-semibold">Server:</span>{' '}
                <span className="font-mono">{output.serverLabel}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold">Tool:</span>{' '}
                <span className="font-mono">{output.name}</span>
              </div>
              {output.arguments && (
                <div className="mb-2">
                  <span className="font-semibold">Arguments:</span>
                  <pre className="mt-1 text-xs overflow-auto bg-white p-2 rounded border border-green-100">
                    {output.arguments}
                  </pre>
                </div>
              )}
              {output.output !== null && output.output !== undefined && (
                <div className="mb-2">
                  <span className="font-semibold">Output:</span>
                  <pre className="mt-1 text-xs overflow-auto bg-white p-2 rounded border border-green-100">
                    {typeof output.output === 'string'
                      ? output.output
                      : JSON.stringify(output.output, null, 2)}
                  </pre>
                </div>
              )}
              {output.error && (
                <div className="mb-2 text-red-600">
                  <span className="font-semibold">Error:</span>
                  <pre className="mt-1 text-xs overflow-auto bg-red-50 p-2 rounded border border-red-200">
                    {typeof output.error === 'string'
                      ? output.error
                      : JSON.stringify(output.error, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        );
      }

      // Fallback if output structure is unexpected
      return (
        <div className="mb-4 p-3 bg-gray-50 rounded border-l-4 border-gray-400 shadow">
          <div className="flex items-center font-semibold text-gray-700">
            <span className="inline-block mr-2 bg-gray-200 text-gray-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              MCP
            </span>
            MCP tool executed
          </div>
          <div className="mt-2 pl-5">
            <div className="mb-2">
              <span className="text-xs font-semibold text-gray-600 mb-1">
                Input:
              </span>
              <pre className="text-xs overflow-auto bg-white p-2 rounded border border-gray-200">
                {JSON.stringify(invocation.input, null, 2)}
              </pre>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-600 mb-1">
                Output:
              </span>
              <pre className="text-xs overflow-auto bg-white p-2 rounded border border-gray-200">
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      );
    }
    case 'output-error': {
      return (
        <div className="mb-4 p-3 bg-red-50 rounded border-l-4 border-red-400 shadow">
          <div className="flex items-center font-semibold text-red-700">
            <span className="inline-block mr-2 bg-red-200 text-red-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              MCP
            </span>
            MCP tool error
          </div>
          <div className="mt-2 pl-5 text-sm text-red-600">
            {invocation.errorText}
          </div>
        </div>
      );
    }
  }
}
