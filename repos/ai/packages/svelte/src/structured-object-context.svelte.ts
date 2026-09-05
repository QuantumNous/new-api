import type { DeepPartial } from 'ai';
import { createContext, KeyedStore } from './utils.svelte.js';

export class StructuredObjectStore<RESULT> {
  object = $state<DeepPartial<RESULT>>();
  loading = $state(false);
  error = $state<Error>();
}

export class KeyedStructuredObjectStore extends KeyedStore<
  StructuredObjectStore<unknown>
> {
  constructor(
    value?:
      | Iterable<readonly [string, StructuredObjectStore<unknown>]>
      | null
      | undefined,
  ) {
    super(StructuredObjectStore, value);
  }
}

export const {
  hasContext: hasStructuredObjectContext,
  getContext: getStructuredObjectContext,
  setContext: setStructuredObjectContext,
} = createContext<KeyedStructuredObjectStore>('StructuredObject');
