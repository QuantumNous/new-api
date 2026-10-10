import type { Telemetry } from 'ai';

const telemetryConfig = {
  onStart() {},
  onRerankEnd(event: unknown) {
    console.log(event);
  },
};

export const telemetry: Telemetry = telemetryConfig;

export const eventType = 'onRerankEnd';
