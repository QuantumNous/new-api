export type TelemetryScenario =
  | 'happy-path'
  | 'context-filtering'
  | 'approval'
  | 'tool-error'
  | 'model-error'
  | 'reconnect';

export type TelemetryEventSource =
  | 'telemetry'
  | 'agent-callback'
  | 'transport'
  | 'workflow';

export interface TelemetryEventRecord {
  id: number;
  telemetryRunId: string;
  source: TelemetryEventSource;
  name: string;
  timestamp: string;
  summary?: unknown;
}

type TelemetryStore = {
  nextEventId: number;
  eventsByRunId: Record<string, TelemetryEventRecord[]>;
  telemetryRunIdByWorkflowRunId: Record<string, string>;
};

const store = ((
  globalThis as typeof globalThis & {
    __nextWorkflowTelemetryStore?: TelemetryStore;
  }
).__nextWorkflowTelemetryStore ??= {
  nextEventId: 1,
  eventsByRunId: {},
  telemetryRunIdByWorkflowRunId: {},
});

export function resetTelemetryRun(telemetryRunId: string) {
  store.eventsByRunId[telemetryRunId] = [];
}

export function rememberWorkflowRun({
  workflowRunId,
  telemetryRunId,
}: {
  workflowRunId: string;
  telemetryRunId: string;
}) {
  store.telemetryRunIdByWorkflowRunId[workflowRunId] = telemetryRunId;
}

export function getTelemetryRunIdForWorkflowRun(workflowRunId: string) {
  return store.telemetryRunIdByWorkflowRunId[workflowRunId];
}

export function appendTelemetryEvent({
  telemetryRunId,
  source,
  name,
  summary,
}: Omit<TelemetryEventRecord, 'id' | 'timestamp'>) {
  const event: TelemetryEventRecord = {
    id: store.nextEventId++,
    telemetryRunId,
    source,
    name,
    timestamp: new Date().toISOString(),
    summary,
  };

  store.eventsByRunId[telemetryRunId] ??= [];
  store.eventsByRunId[telemetryRunId].push(event);
  return event;
}

export async function recordTelemetryEvent(
  event: Omit<TelemetryEventRecord, 'id' | 'timestamp'>,
) {
  'use step';
  return appendTelemetryEvent(event);
}

export function getTelemetryEvents(telemetryRunId: string) {
  return store.eventsByRunId[telemetryRunId] ?? [];
}
