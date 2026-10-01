import { DevToolsTelemetry } from '@ai-sdk/devtools';
import type { Telemetry } from 'ai';

const INTEGRATION_KEY = '__nextWorkflowDevToolsIntegration';

type GlobalSlot = typeof globalThis & {
  [INTEGRATION_KEY]?: Telemetry;
};

function getIntegration(): Telemetry {
  const g = globalThis as GlobalSlot;
  if (g[INTEGRATION_KEY] == null) {
    g[INTEGRATION_KEY] = DevToolsTelemetry();
  }
  return g[INTEGRATION_KEY];
}

interface BridgePayload {
  name: keyof Telemetry;
  event: unknown;
}

export async function POST(req: Request) {
  const { name, event } = (await req.json()) as BridgePayload;
  const integration = getIntegration();
  const callback = integration[name] as
    | ((event: unknown) => unknown)
    | undefined;
  if (callback != null) {
    await callback.call(integration, event);
  }
  return new Response(null, { status: 204 });
}
