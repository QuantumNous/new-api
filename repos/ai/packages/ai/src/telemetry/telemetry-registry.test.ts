import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Telemetry } from './telemetry';
import {
  registerTelemetry,
  getGlobalTelemetryIntegrations,
} from './telemetry-registry';

beforeEach(() => {
  globalThis.AI_SDK_TELEMETRY_INTEGRATIONS = undefined;
});

describe('registerTelemetry', () => {
  it('adds an integration to the global registry', () => {
    const integration: Telemetry = { onStart: vi.fn() };

    registerTelemetry(integration);

    expect(getGlobalTelemetryIntegrations()).toEqual([integration]);
  });

  it('adds multiple integrations in registration order', () => {
    const integration1: Telemetry = { onStart: vi.fn() };
    const integration2: Telemetry = { onEnd: vi.fn() };

    registerTelemetry(integration1);
    registerTelemetry(integration2);

    expect(getGlobalTelemetryIntegrations()).toEqual([
      integration1,
      integration2,
    ]);
  });

  it('adds multiple integrations passed in a single call', () => {
    const integration1: Telemetry = { onStart: vi.fn() };
    const integration2: Telemetry = { onEnd: vi.fn() };
    const integration3: Telemetry = { onError: vi.fn() };

    registerTelemetry(integration1, integration2, integration3);

    expect(getGlobalTelemetryIntegrations()).toEqual([
      integration1,
      integration2,
      integration3,
    ]);
  });

  it('is a no-op when called with no integrations', () => {
    registerTelemetry();

    expect(getGlobalTelemetryIntegrations()).toEqual([]);
  });
});

describe('getGlobalTelemetryIntegrations', () => {
  it('returns an empty array when no integrations are registered', () => {
    expect(getGlobalTelemetryIntegrations()).toEqual([]);
  });
});
