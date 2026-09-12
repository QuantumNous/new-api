import type { WeatherUIToolInvocation } from '@/lib/tools/weather-tool';
import HarnessToolView from '@/components/tool/harness-tool-view';
import type { ChatAddToolApproveResponseFunction } from 'ai';

export default function WeatherView({
  invocation,
  addToolApprovalResponse,
}: {
  invocation: WeatherUIToolInvocation;
  addToolApprovalResponse?: ChatAddToolApproveResponseFunction;
}) {
  if (invocation.state === 'approval-requested') {
    return (
      <div className="mb-2">
        <HarnessToolView
          toolName="Weather"
          toolArg={invocation.input?.city}
          state={invocation.state}
        />
        <div className="flex gap-2 ml-4">
          <button
            type="button"
            className="px-2 py-1 text-xs text-white bg-green-600 rounded"
            onClick={() =>
              addToolApprovalResponse?.({
                id: invocation.approval.id,
                approved: true,
              })
            }
          >
            Approve
          </button>
          <button
            type="button"
            className="px-2 py-1 text-xs text-white bg-red-600 rounded"
            onClick={() =>
              addToolApprovalResponse?.({
                id: invocation.approval.id,
                approved: false,
                reason: 'User denied the weather lookup.',
              })
            }
          >
            Deny
          </button>
        </div>
      </div>
    );
  }

  if (invocation.state === 'approval-responded') {
    return (
      <HarnessToolView
        toolName="Weather"
        toolArg={invocation.input?.city}
        state={invocation.state}
        output={
          invocation.approval.approved
            ? 'Approved. Waiting for tool execution...'
            : `Denied${invocation.approval.reason ? `: ${invocation.approval.reason}` : ''}`
        }
      />
    );
  }

  return (
    <HarnessToolView
      toolName="Weather"
      toolArg={invocation.input?.city}
      state={invocation.state}
      output={
        invocation.output?.state === 'loading'
          ? 'Fetching weather information...'
          : `Weather in ${invocation.input?.city}: ${invocation.output?.weather} (temperature: ${invocation.output?.temperature}°)`
      }
      errorText={invocation.errorText}
    />
  );
}
