import { AISDKError } from '@ai-sdk/provider';
import { HarnessError } from './harness-error';

const name = 'AI_HarnessCapabilityUnsupportedError';
const marker = `vercel.ai.error.${name}`;
const symbol = Symbol.for(marker);

/**
 * Thrown when a caller asks the harness to do something the adapter (or the
 * supplied sandbox) does not support, e.g. requesting manual compaction from
 * an adapter that only auto-compacts, or invoking `getPortUrl` on a sandbox
 * that does not expose one.
 *
 * The caller supplies the full human-readable message. Optional `harnessId`
 * is recorded as structured context for tooling.
 */
export class HarnessCapabilityUnsupportedError extends HarnessError {
  private readonly [symbol] = true;

  readonly harnessId?: string;

  constructor({
    message,
    harnessId,
    cause,
  }: {
    message: string;
    harnessId?: string;
    cause?: unknown;
  }) {
    super({ message, cause });
    Object.defineProperty(this, 'name', { value: name });
    this.harnessId = harnessId;
  }

  static isInstance(
    error: unknown,
  ): error is HarnessCapabilityUnsupportedError {
    return AISDKError.hasMarker(error, marker);
  }
}
