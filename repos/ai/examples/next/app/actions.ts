'use server';

import { revalidatePath } from 'next/cache';

export async function invalidateRouterCache() {
  /*
   * note: this path does not exist, but it will
   * trigger a client-side reload.
   */
  revalidatePath('/just-trigger-client-reload');
  await Promise.resolve();
}
