import type { openai } from '@ai-sdk/openai';
import type { ChatAddToolApproveResponseFunction, UIToolInvocation } from 'ai';

export default function ShellView({
  invocation,
  addToolApprovalResponse,
}: {
  invocation: UIToolInvocation<ReturnType<typeof openai.tools.shell>>;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
}) {
  const action = invocation.input?.action;
  const commands = action?.commands || [];

  switch (invocation.state) {
    case 'approval-requested':
      return (
        <div className="p-2 mb-2 bg-white rounded-xl border border-gray-300 shadow-lg">
          <div className="px-6 py-3 bg-gray-100 rounded-t-xl border-b border-gray-300">
            <div className="overflow-hidden tracking-wide text-black whitespace-nowrap text-xxs font-small text-ellipsis">
              Shell Command Approval Required
            </div>
          </div>

          <div className="p-6">
            <div className="mb-4">
              <div className="mb-2 text-sm font-medium text-black">
                Commands to execute:
              </div>
              <div className="space-y-2">
                {commands.map((cmd, index) => (
                  <pre
                    key={index}
                    className="overflow-x-auto p-4 text-sm text-black whitespace-pre-wrap bg-gray-100 rounded-lg border border-gray-300"
                  >
                    {index + 1}. {cmd}
                  </pre>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="px-4 py-2 text-white bg-blue-500 rounded transition-colors hover:bg-blue-600"
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
        </div>
      );

    case 'approval-responded':
      return (
        <div className="p-2 mb-2 bg-white rounded-xl border border-gray-300 shadow-lg">
          <div className="px-6 py-3 bg-gray-100 rounded-t-xl border-b border-gray-300">
            <div className="overflow-hidden tracking-wide text-black whitespace-nowrap text-xxs font-small text-ellipsis">
              Shell Command Approval
            </div>
          </div>

          <div className="p-6">
            <div className="mb-4">
              <div className="mb-2 text-sm font-medium text-black">
                Commands:
              </div>
              <div className="space-y-2">
                {commands.map((cmd, index) => (
                  <pre
                    key={index}
                    className="overflow-x-auto p-4 text-sm text-black whitespace-pre-wrap bg-gray-100 rounded-lg border border-gray-300"
                  >
                    {index + 1}. {cmd}
                  </pre>
                ))}
              </div>
            </div>

            <div
              className={`text-sm font-medium ${
                invocation.approval.approved ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {invocation.approval.approved ? '✓ Approved' : '✗ Denied'}
            </div>
          </div>
        </div>
      );

    case 'output-available':
      const outputs = invocation.output?.output || [];

      return (
        <div className="p-2 mb-2 bg-white rounded-xl border border-gray-300 shadow-lg">
          <div className="px-6 py-3 bg-gray-100 rounded-t-xl border-b border-gray-300">
            <div className="overflow-hidden tracking-wide text-black whitespace-nowrap text-xxs font-small text-ellipsis">
              Shell Execution Results
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {commands.map((cmd, index) => {
                const output = outputs[index];
                const outcome = output?.outcome;

                return (
                  <div key={index} className="space-y-2">
                    <div>
                      <div className="mb-2 text-sm font-medium text-black">
                        Command {index + 1}:
                      </div>
                      <pre className="overflow-x-auto p-4 text-sm text-black whitespace-pre-wrap bg-gray-100 rounded-lg border border-gray-300">
                        {cmd}
                      </pre>
                    </div>

                    {outcome && (
                      <div className="space-y-2">
                        {outcome.type === 'timeout' ? (
                          <div className="p-3 bg-red-50 border border-red-300 rounded-lg">
                            <div className="text-sm font-medium text-red-600">
                              ⏱ Timeout
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-gray-100 border border-gray-300 rounded-lg">
                            <div className="text-xs text-black mb-1">
                              Exit Code: {outcome.exitCode}
                            </div>
                          </div>
                        )}

                        {output.stdout && (
                          <div>
                            <div className="mb-2 text-sm font-medium text-black">
                              Output:
                            </div>
                            <div className="p-3 bg-gray-100 rounded-lg border border-gray-300">
                              <div className="font-mono text-sm text-black whitespace-pre-wrap">
                                {output.stdout}
                              </div>
                            </div>
                          </div>
                        )}

                        {output.stderr && (
                          <div>
                            <div className="mb-2 text-sm font-medium text-black">
                              Error:
                            </div>
                            <div className="p-3 bg-red-50 rounded-lg border border-red-300">
                              <div className="font-mono text-sm text-red-600 whitespace-pre-wrap">
                                {output.stderr}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );

    case 'output-denied':
      return (
        <div className="p-2 mb-2 bg-white rounded-xl border border-gray-300 shadow-lg">
          <div className="px-6 py-3 bg-gray-100 rounded-t-xl border-b border-gray-300">
            <div className="overflow-hidden tracking-wide text-black whitespace-nowrap text-xxs font-small text-ellipsis">
              Shell Command Denied
            </div>
          </div>

          <div className="p-6">
            <div className="mb-4">
              <div className="mb-2 text-sm font-medium text-black">
                Commands:
              </div>
              <div className="space-y-2">
                {commands.map((cmd, index) => (
                  <pre
                    key={index}
                    className="overflow-x-auto p-4 text-sm text-black whitespace-pre-wrap bg-gray-100 rounded-lg border border-gray-300"
                  >
                    {index + 1}. {cmd}
                  </pre>
                ))}
              </div>
            </div>

            <div className="text-sm font-medium text-red-600">
              Execution was denied by user.
            </div>
          </div>
        </div>
      );

    case 'output-error':
      return (
        <div className="p-2 mb-2 bg-red-50 rounded-xl border border-red-300 shadow-lg">
          <div className="p-6">
            <div className="mb-2 text-sm font-medium text-red-600">Error:</div>
            <div className="text-sm text-black">{invocation.errorText}</div>
          </div>
        </div>
      );
  }
}
