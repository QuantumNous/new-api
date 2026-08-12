import { GatewayError } from './gateway-error';

const name = 'GatewayForbiddenError';
const marker = `vercel.ai.gateway.error.${name}`;
const symbol = Symbol.for(marker);

/**
 * Forbidden - the request was rejected by policy (e.g. a routing rule),
 * not an authentication failure.
 */
export class GatewayForbiddenError extends GatewayError {
  private readonly [symbol] = true; // used in isInstance

  readonly name = name;
  readonly type = 'forbidden';

  constructor({
    message = 'Forbidden',
    statusCode = 403,
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

  static isInstance(error: unknown): error is GatewayForbiddenError {
    return GatewayError.hasMarker(error) && symbol in error;
  }
}
