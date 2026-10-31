import {
  KeyedCompletionStore,
  setCompletionContext,
} from './completion-context.svelte.js';
import {
  KeyedStructuredObjectStore,
  setStructuredObjectContext,
} from './structured-object-context.svelte.js';

export function createAIContext() {
  const completionStore = new KeyedCompletionStore();
  setCompletionContext(completionStore);

  const objectStore = new KeyedStructuredObjectStore();
  setStructuredObjectContext(objectStore);
}
