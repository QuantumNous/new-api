import type { JSONValue } from 'ai';
import { SvelteMap } from 'svelte/reactivity';
import { createContext, KeyedStore } from './utils.svelte.js';

class CompletionStore {
  completions = new SvelteMap<string, string>();
  data = $state<JSONValue[]>([]);
  loading = $state(false);
  error = $state<Error>();
}

export class KeyedCompletionStore extends KeyedStore<CompletionStore> {
  constructor(
    value?: Iterable<readonly [string, CompletionStore]> | null | undefined,
  ) {
    super(CompletionStore, value);
  }
}

export const {
  hasContext: hasCompletionContext,
  getContext: getCompletionContext,
  setContext: setCompletionContext,
} = createContext<KeyedCompletionStore>('Completion');
