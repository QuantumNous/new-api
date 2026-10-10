import { GatewayError } from './gateway-error';

const name = 'GatewayFailedDependencyError';
const marker = `vercel.ai.gateway.error.${name}`;
const symbol = Symbol.for(marker);

/**
 * The request could not be fulfilled because a dependency it relied on was not
 * available on the credentials or provider used to serve it (HTTP 424). Not
 * retryable — the caller must change the request.
 */
export class GatewayFailedDependencyError extends GatewayError {
  private readonly [symbol] = true; // used in isInstance

  readonly name = name;
  readonly type = 'failed_dependency';

  constructor({
    message = 'Failed dependency',
    statusCode = 424,
    cause,
    generationId,
  }: {
    message?: string;
    statusCode?: number;
    cause?: unknown;
    generationId?: string;
  } = {}) {
    super({ message, statusCode, cause, generationId });
  }

  static isInstance(error: unknown): error is GatewayFailedDependencyError {
    return GatewayError.hasMarker(error) && symbol in error;
  }
}
