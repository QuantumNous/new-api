import { castArray } from '../helpers';
import type { ServerSetupContext, ServerSetupFn } from '../types';

export async function applyServerSetup(
  setup: ServerSetupFn | ServerSetupFn[] | undefined,
  context: ServerSetupContext,
): Promise<(() => Promise<void> | void)[]> {
  const postCallbacks: (() => Promise<void> | void)[] = [];

  for (const handler of castArray(setup || [])) {
    const postCallback = await handler(context);

    if (typeof postCallback === 'function') {
      postCallbacks.push(postCallback);
    }
  }

  return postCallbacks;
}
