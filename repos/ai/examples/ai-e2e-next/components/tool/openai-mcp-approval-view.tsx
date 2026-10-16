import type { ChatAddToolApproveResponseFunction, DynamicToolUIPart } from 'ai';

// Type definitions for MCP output
type McpOutput = {
  type: 'call';
  serverLabel: string;
  name: string;
  arguments?: string;
  output?: string | unknown;
  error?: string | unknown;
};

export default function OpenAIMCPApprovalView({
  invocation,
  addToolApprovalResponse,
}: {
  invocation: DynamicToolUIPart;
  addToolApprovalResponse?: ChatAddToolApproveResponseFunction;
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
    case 'approval-requested': {
      return (
        <div className="mb-4 p-3 bg-yellow-50 rounded border-l-4 border-yellow-400 shadow">
          <div className="flex items-center font-semibold text-yellow-700">
            <span className="inline-block mr-2 bg-yellow-200 text-yellow-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              MCP
            </span>
            Approval Required
          </div>
          <div className="mt-2 pl-5 text-sm text-yellow-800">
            <div className="mb-2">
              <span className="font-semibold">Tool:</span>{' '}
              <span className="font-mono">{invocation.toolName}</span>
            </div>
            {invocation.input !== undefined && (
              <div className="mb-3">
                <span className="font-semibold">Arguments:</span>
                <pre className="mt-1 text-xs overflow-auto bg-white p-2 rounded border border-yellow-100">
                  {typeof invocation.input === 'string'
                    ? invocation.input
                    : JSON.stringify(invocation.input, null, 2)}
                </pre>
              </div>
            )}
          </div>
          {addToolApprovalResponse && (
            <div className="mt-3 pl-5 flex gap-2">
              <button
                className="px-4 py-2 text-white bg-green-500 rounded transition-colors hover:bg-green-600 text-sm font-medium"
                onClick={() =>
                  addToolApprovalResponse({
                    id: invocation.approval.id,
                    approved: true,
                  })
                }
              >
                Approve
              </button>
              <button
                className="px-4 py-2 text-white bg-red-500 rounded transition-colors hover:bg-red-600 text-sm font-medium"
                onClick={() =>
                  addToolApprovalResponse({
                    id: invocation.approval.id,
                    approved: false,
                  })
                }
              >
                Deny
              </button>
            </div>
          )}
        </div>
      );
    }
    case 'approval-responded': {
      return (
        <div className="mb-4 p-3 bg-gray-50 rounded border-l-4 border-gray-400 shadow">
          <div className="flex items-center font-semibold text-gray-700">
            <span className="inline-block mr-2 bg-gray-200 text-gray-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              MCP
            </span>
            {invocation.approval.approved
              ? 'Approved - Executing...'
              : 'Denied'}
          </div>
        </div>
      );
    }
    case 'output-available': {
      const output = invocation.output as McpOutput | undefined;
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
                  <pre className="mt-1 text-xs overflow-auto bg-white p-2 rounded border border-green-100 max-h-64">
                    {typeof output.output === 'string'
                      ? output.output
                      : JSON.stringify(output.output, null, 2)}
                  </pre>
                </div>
              )}
              {output.error != null && (
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
    case 'output-denied': {
      return (
        <div className="mb-4 p-3 bg-red-50 rounded border-l-4 border-red-400 shadow">
          <div className="flex items-center font-semibold text-red-700">
            <span className="inline-block mr-2 bg-red-200 text-red-900 rounded px-2 py-0.5 text-xs font-mono tracking-wider">
              MCP
            </span>
            Tool execution denied
          </div>
          <div className="mt-2 pl-5 text-sm text-red-600">
            The tool execution was not approved by the user.
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
