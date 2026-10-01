import type { Telemetry } from 'ai';

const telemetryConfig = {
  onStart() {},
  onEmbedFinish(event: unknown) {
    console.log(event);
  },
};

export const telemetry: Telemetry = telemetryConfig;

export const eventType = 'onEmbedFinish';
