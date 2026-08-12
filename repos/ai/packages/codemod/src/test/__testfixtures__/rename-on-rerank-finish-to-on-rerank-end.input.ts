import type { Telemetry } from 'ai';

const telemetryConfig = {
  onStart() {},
  onRerankFinish(event: unknown) {
    console.log(event);
  },
};

export const telemetry: Telemetry = telemetryConfig;

export const eventType = 'onRerankFinish';
