import { createUIMessageStreamResponse } from 'ai';
import type { NextRequest } from 'next/server';
import { getRun } from 'workflow/api';
import {
  appendTelemetryEvent,
  getTelemetryRunIdForWorkflowRun,
} from '@/lib/telemetry-store';
import { toUIMessageStream } from '@/workflow/telemetry-agent';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const startIndex = Number(
    new URL(request.url).searchParams.get('startIndex') ?? '0',
  );
  const telemetryRunId = getTelemetryRunIdForWorkflowRun(runId);

  if (telemetryRunId != null) {
    appendTelemetryEvent({
      telemetryRunId,
      source: 'transport',
      name: 'reconnectStream',
      summary: { workflowRunId: runId, startIndex },
    });
  }

  const run = await getRun(runId);
  const readable = toUIMessageStream(run.getReadable({ startIndex }));

  return createUIMessageStreamResponse({
    stream: readable,
    headers: {
      'x-workflow-run-id': runId,
    },
  });
}
