import { asArray, type Arrayable } from '@ai-sdk/provider-utils';
import type { Callback } from './callback';

/**
 * Notifies all provided callbacks with the given event in parallel.
 * Errors in callbacks do not break the generation flow.
 */
export async function notify<EVENT>(options: {
  event: EVENT;
  callbacks?: Arrayable<Callback<EVENT> | undefined | null>;
}): Promise<void> {
  await Promise.all(
    asArray(options.callbacks).map(async callback => {
      try {
        await callback?.(options.event);
      } catch {}
    }),
  );
}
