import { AISDKError } from '@ai-sdk/provider';

const name = 'AI_HarnessError';
const marker = `vercel.ai.error.${name}`;
const symbol = Symbol.for(marker);

/**
 * Base error type for failures originating in or signalled by a harness
 * adapter. Specific failure modes (e.g. unsupported capability) extend this
 * class.
 */
export class HarnessError extends AISDKError {
  private readonly [symbol] = true;

  constructor({ message, cause }: { message: string; cause?: unknown }) {
    super({ name, message, cause });
  }

  static isInstance(error: unknown): error is HarnessError {
    return AISDKError.hasMarker(error, marker);
  }
}
