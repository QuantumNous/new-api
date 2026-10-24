import type { Telemetry } from './telemetry';

/**
 * Registers one or more telemetry integrations globally.
 */
export function registerTelemetry(...integrations: Telemetry[]): void {
  if (!globalThis.AI_SDK_TELEMETRY_INTEGRATIONS) {
    globalThis.AI_SDK_TELEMETRY_INTEGRATIONS = [];
  }
  globalThis.AI_SDK_TELEMETRY_INTEGRATIONS.push(...integrations);
}

export function getGlobalTelemetryIntegrations(): Telemetry[] {
  return globalThis.AI_SDK_TELEMETRY_INTEGRATIONS ?? [];
}
