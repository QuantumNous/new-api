import {
  getTelemetryEvents,
  type TelemetryScenario,
} from '@/lib/telemetry-store';

const expectations: Record<TelemetryScenario, string[]> = {
  'happy-path': [
    'onStart',
    'onStepStart',
    'onLanguageModelCallStart',
    'onLanguageModelCallEnd',
    'onToolExecutionStart',
    'onToolExecutionEnd',
    'onStepFinish',
    'onFinish',
  ],
  'context-filtering': [
    'onStart',
    'onStepStart',
    'onToolExecutionStart',
    'onToolExecutionEnd',
    'onFinish',
  ],
  approval: [
    'onStart',
    'onStepStart',
    'onLanguageModelCallStart',
    'onLanguageModelCallEnd',
    'onFinish',
  ],
  'tool-error': [
    'onStart',
    'onToolExecutionStart',
    'onToolExecutionEnd',
    'onFinish',
  ],
  'model-error': ['onStart', 'onLanguageModelCallStart', 'onError'],
  reconnect: [
    'onStart',
    'onStepStart',
    'onFinish',
    'transport:postStreamInterrupted',
    'transport:reconnectStream',
  ],
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ telemetryRunId: string }> },
) {
  const { telemetryRunId } = await params;
  const scenario =
    (new URL(request.url).searchParams.get(
      'scenario',
    ) as TelemetryScenario | null) ?? 'happy-path';
  const events = getTelemetryEvents(telemetryRunId);
  const telemetryEvents = events.filter(event => event.source === 'telemetry');
  const serializedTelemetryEvents = JSON.stringify(telemetryEvents);

  return Response.json({
    telemetryRunId,
    scenario,
    events,
    expectations: expectations[scenario].map(name => {
      const [source, eventName] = name.includes(':')
        ? name.split(':')
        : ['telemetry', name];
      return {
        name,
        met: events.some(
          event => event.source === source && event.name === eventName,
        ),
      };
    }),
    contextFiltering: {
      includesAllowedRuntimeContext: serializedTelemetryEvents.includes(
        'tenant_telemetry_e2e',
      ),
      excludesRuntimeSecret: !serializedTelemetryEvents.includes(
        'runtime-secret-not-for-telemetry',
      ),
      excludesToolSecret:
        !serializedTelemetryEvents.includes(
          'weather-secret-not-for-telemetry',
        ) &&
        !serializedTelemetryEvents.includes('delete-secret-not-for-telemetry'),
    },
  });
}
