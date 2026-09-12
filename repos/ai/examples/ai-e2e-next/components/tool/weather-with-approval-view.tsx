import type { WeatherUIToolInvocation } from '@/tool/weather-tool';
import type { ChatAddToolApproveResponseFunction } from 'ai';

export default function WeatherWithApprovalView({
  invocation,
  addToolApprovalResponse,
}: {
  invocation: WeatherUIToolInvocation;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
}) {
  switch (invocation.state) {
    case 'approval-requested':
      if (invocation.approval.isAutomatic) {
        return <></>; // will be immediately replaced by the approval response
      }

      return (
        <div className="text-gray-500">
          Can I retrieve the weather for {invocation.input.city}?
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
      if (invocation.approval.isAutomatic) {
        return (
          <div className="text-gray-500">
            Weather tool execution for{' '}
            <span className="font-semibold">{invocation.input.city}</span> was
            automatically{' '}
            {invocation.approval.approved ? (
              <span className="text-green-600">approved</span>
            ) : (
              <span className="text-red-600">denied</span>
            )}
            .
            {invocation.approval.reason != null
              ? ` Reason: ${invocation.approval.reason}`
              : ''}
          </div>
        );
      }

      return (
        <div className="text-gray-500">
          Can I retrieve the weather for {invocation.input.city}?
          <div>{invocation.approval.approved ? 'Approved' : 'Denied'}</div>
        </div>
      );

    case 'output-available':
      return (
        <>
          {invocation.approval && (
            <div className="text-gray-500">
              Weather tool execution for{' '}
              <span className="font-semibold">{invocation.input.city}</span> was
              {invocation.approval.isAutomatic ? ' automatically' : ''}{' '}
              {invocation.approval.approved ? (
                <span className="text-green-600">approved</span>
              ) : (
                <span className="text-red-600">denied</span>
              )}
              .
              {invocation.approval.reason != null
                ? ` Reason: ${invocation.approval.reason}`
                : ''}
            </div>
          )}
          <div className="text-gray-500">
            {invocation.output.state === 'loading'
              ? 'Fetching weather information...'
              : `Weather in ${invocation.input.city}: ${invocation.output.weather}`}
          </div>
        </>
      );

    case 'output-denied':
      return (
        <div className="text-gray-500">
          Weather tool execution for{' '}
          <span className="font-semibold">{invocation.input.city}</span> was
          {invocation.approval.isAutomatic ? ' automatically' : ''}{' '}
          <span className="text-red-600">denied</span>.
          {invocation.approval.reason != null
            ? ` Reason: ${invocation.approval.reason}`
            : ''}
        </div>
      );

    case 'output-error':
      return <div className="text-red-500">Error: {invocation.errorText}</div>;
  }
}
