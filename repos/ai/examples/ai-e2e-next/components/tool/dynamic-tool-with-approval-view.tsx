import type {
  ChatAddToolApproveResponseFunction,
  ChatRequestOptions,
  DynamicToolUIPart,
} from 'ai';

export default function WeatherWithApprovalView({
  invocation,
  addToolApprovalResponse,
  requestOptions,
}: {
  invocation: DynamicToolUIPart;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  requestOptions?: ChatRequestOptions;
}) {
  switch (invocation.state) {
    case 'approval-requested':
      return (
        <div className="text-gray-500">
          <div className="mb-2 bg-gray-600 rounded-xl border border-gray-900 shadow-lg">
            <pre className="overflow-x-auto p-4 text-sm text-gray-100 whitespace-pre-wrap">
              <div className="pb-2 font-semibold">
                Execute tool &quot;{invocation.toolName}&quot;
              </div>
              {JSON.stringify(invocation.input, null, 2)}
            </pre>
          </div>
          <div>
            <button
              className="px-4 py-2 mr-2 text-white bg-blue-500 rounded transition-colors hover:bg-blue-600"
              onClick={() =>
                addToolApprovalResponse({
                  id: invocation.approval.id,
                  approved: true,
                  options: requestOptions,
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
                  options: requestOptions,
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
          <div className="mb-2 bg-gray-600 rounded-xl border border-gray-900 shadow-lg">
            <pre className="overflow-x-auto p-4 text-sm text-gray-100 whitespace-pre-wrap">
              <div className="pb-2 font-semibold">
                Execute tool &quot;{invocation.toolName}&quot;
              </div>
              {JSON.stringify(invocation.input, null, 2)}
              <div className="font-semibold">
                {invocation.approval.approved ? 'Approved' : 'Denied'}
              </div>
            </pre>
          </div>
        </div>
      );

    case 'output-available':
      const isPreliminary = invocation.preliminary ?? false;
      return (
        <div className="text-gray-500">
          <div className="mb-2 bg-gray-600 rounded-xl border border-gray-900 shadow-lg">
            <pre className="overflow-x-auto p-4 text-sm text-gray-100 whitespace-pre-wrap">
              <div className="pb-2 font-semibold">
                {isPreliminary ? 'Executing' : 'Executed'} tool &quot;
                {invocation.toolName}&quot;
              </div>
              {JSON.stringify(invocation.input, null, 2)}
              <div className="pt-2 pb-2 font-semibold">Output:</div>
              {JSON.stringify(invocation.output, null, 2)}
            </pre>
          </div>
        </div>
      );
    case 'output-denied':
      return (
        <div className="text-red-500">
          Tool {invocation.toolName} with input{' '}
          {JSON.stringify(invocation.input)} execution denied.
        </div>
      );
    case 'output-error':
      return <div className="text-red-500">Error: {invocation.errorText}</div>;
  }
}
