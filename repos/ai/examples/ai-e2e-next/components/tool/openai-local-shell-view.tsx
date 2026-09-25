import type { openai } from '@ai-sdk/openai';
import type { ChatAddToolApproveResponseFunction, UIToolInvocation } from 'ai';

export default function LocalShellView({
  invocation,
  addToolApprovalResponse,
}: {
  invocation: UIToolInvocation<ReturnType<typeof openai.tools.localShell>>;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
}) {
  const action = invocation.input?.action;
  const command = action?.command?.join(' ') || '';

  switch (invocation.state) {
    case 'approval-requested':
      return (
        <div className="text-gray-500">
          Can I execute the command <code>{command}</code>?
          <div>
            <button
              className="px-4 py-2 mr-2 text-white bg-blue-500 rounded transition-colors hover:bg-blue-600"
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
              className="px-4 py-2 text-white bg-red-500 rounded transition-colors hover:bg-red-600"
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
        </div>
      );
    case 'approval-responded':
      return (
        <div className="text-gray-500">
          Can I execute the command <code>{command}</code>?
          <div>{invocation.approval.approved ? 'Approved' : 'Denied'}</div>
        </div>
      );

    case 'output-available':
      return (
        <div className="p-2 mb-2 bg-gray-900 rounded-xl border border-gray-600 shadow-lg">
          <div className="px-6 py-3 bg-gray-800 rounded-t-xl border-b border-gray-700">
            <div className="overflow-hidden tracking-wide text-gray-500 whitespace-nowrap text-xxs font-small text-ellipsis">
              Local Shell Execution
            </div>
          </div>

          <div className="p-6">
            <div className="mb-3">
              <div className="mb-2 text-sm font-medium text-blue-400">
                Command:
              </div>
              <pre className="overflow-x-auto p-4 text-sm text-gray-100 whitespace-pre-wrap bg-black rounded-lg">
                {command}
              </pre>
            </div>

            {action?.workingDirectory && (
              <div className="mb-3">
                <div className="mb-2 text-sm font-medium text-gray-400">
                  Working Directory:
                </div>
                <div className="p-3 font-mono text-sm text-gray-300 bg-black rounded-lg">
                  {action.workingDirectory}
                </div>
              </div>
            )}

            {invocation.state === 'output-available' && (
              <div className="mb-3">
                <div className="mb-2 text-sm font-medium text-yellow-400">
                  Output:
                </div>
                <div className="space-y-2">
                  <div className="p-3 bg-black rounded-lg">
                    <div className="font-mono text-sm text-green-300">
                      <span className="whitespace-pre-wrap">
                        {invocation.output.output}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );

    case 'output-denied':
      return (
        <div className="text-gray-500">
          Execution of <code>{command}</code> was denied.
        </div>
      );
    case 'output-error':
      return <div className="text-red-500">Error: {invocation.errorText}</div>;
  }
}
