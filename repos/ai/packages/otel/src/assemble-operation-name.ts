import type { TelemetryOptions } from 'ai';

export function assembleOperationName({
  operationId,
  telemetry,
}: {
  operationId: string;
  telemetry?: TelemetryOptions;
}) {
  return {
    // standardized operation and resource name:
    'operation.name': `${operationId}${
      telemetry?.functionId != null ? ` ${telemetry.functionId}` : ''
    }`,
    'resource.name': telemetry?.functionId,

    // detailed, AI SDK specific data:
    'ai.operationId': operationId,
    'ai.telemetry.functionId': telemetry?.functionId,
  };
}
