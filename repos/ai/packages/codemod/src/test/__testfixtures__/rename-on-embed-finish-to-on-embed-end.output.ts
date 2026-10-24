import type { Telemetry } from 'ai';

const telemetryConfig = {
  onStart() {},
  onEmbedEnd(event: unknown) {
    console.log(event);
  },
};

export const telemetry: Telemetry = telemetryConfig;

export const eventType = 'onEmbedEnd';
