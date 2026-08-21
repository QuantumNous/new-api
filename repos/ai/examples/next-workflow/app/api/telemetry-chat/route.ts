import { createUIMessageStreamResponse, type UIMessage } from 'ai';
import { start } from 'workflow/api';
import {
  appendTelemetryEvent,
  rememberWorkflowRun,
  resetTelemetryRun,
  type TelemetryScenario,
} from '@/lib/telemetry-store';
import { telemetryChat, toUIMessageStream } from '@/workflow/telemetry-agent';

interface TelemetryChatRequest {
  messages: UIMessage[];
  scenario?: TelemetryScenario;
  telemetryRunId?: string;
  resetTelemetry?: boolean;
}

export async function POST(req: Request) {
  const body = (await req.json()) as TelemetryChatRequest;
  const scenario = body.scenario ?? 'happy-path';
  const telemetryRunId = body.telemetryRunId ?? crypto.randomUUID();
  const requestId = crypto.randomUUID();

  if (body.resetTelemetry !== false) {
    resetTelemetryRun(telemetryRunId);
  }

  appendTelemetryEvent({
    telemetryRunId,
    source: 'transport',
    name: 'postStart',
    summary: { scenario, requestId },
  });

  const run = await start(telemetryChat, [
    body.messages,
    {
      telemetryRunId,
      requestId,
      tenantId: 'tenant_telemetry_e2e',
      scenario,
    },
  ]);

  rememberWorkflowRun({ workflowRunId: run.runId, telemetryRunId });

  appendTelemetryEvent({
    telemetryRunId,
    source: 'transport',
    name: 'workflowRunStarted',
    summary: { workflowRunId: run.runId },
  });

  const stream = toUIMessageStream(run.readable);

  return createUIMessageStreamResponse({
    stream:
      scenario === 'reconnect'
        ? interruptAfterChunks({
            stream,
            telemetryRunId,
            chunkCount: 3,
          })
        : stream,
    headers: {
      'x-workflow-run-id': run.runId,
      'x-telemetry-run-id': telemetryRunId,
    },
  });
}

function interruptAfterChunks({
  stream,
  telemetryRunId,
  chunkCount,
}: {
  stream: ReadableStream<unknown>;
  telemetryRunId: string;
  chunkCount: number;
}) {
  const reader = stream.getReader();
  let chunks = 0;

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      controller.enqueue(value);
      chunks++;

      if (chunks >= chunkCount) {
        appendTelemetryEvent({
          telemetryRunId,
          source: 'transport',
          name: 'postStreamInterrupted',
          summary: { chunks },
        });
        reader.releaseLock();
        controller.close();
      }
    },
    cancel() {
      reader.releaseLock();
    },
  });
}
