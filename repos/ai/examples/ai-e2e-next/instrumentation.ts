import { registerTelemetry } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';
import { LangfuseSpanProcessor, type ShouldExportSpan } from '@langfuse/otel';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

registerTelemetry(new LegacyOpenTelemetry());

const shouldExportSpan: ShouldExportSpan = span => {
  return span.otelSpan.instrumentationScope.name !== 'next.js';
};

export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  shouldExportSpan,
});

const tracerProvider = new NodeTracerProvider({
  spanProcessors: [langfuseSpanProcessor],
});

tracerProvider.register();
