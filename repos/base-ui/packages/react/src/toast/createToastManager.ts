import { generateId } from '@base-ui/utils/generateId';
import type {
  ToastObject,
  ToastManagerAddOptions,
  ToastManagerPromiseOptions,
  ToastManagerUpdateOptions,
} from './useToastManager';

/**
 * Creates a new toast manager.
 */
export function createToastManager<Data extends object = any>(): ToastManager<Data> {
  const listeners = new Set<(data: ToastManagerEvent) => void>();

  function emit(data: ToastManagerEvent) {
    listeners.forEach((listener) => listener(data));
  }

  return {
    // This should be private aside from ToastProvider needing to access it.
    // https://x.com/drosenwasser/status/1816947740032872664
    ' subscribe': function subscribe(listener: (data: ToastManagerEvent) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    add<T extends Data = Data>(options: ToastManagerAddOptions<T>): string {
      const id = options.id || generateId('toast');
      const toastToAdd: ToastObject<T> = {
        ...options,
        id,
        transitionStatus: 'starting',
      };

      emit({
        action: 'add',
        options: toastToAdd,
      });

      return id;
    },

    close(id?: string): void {
      emit({
        action: 'close',
        options: { id },
      });
    },

    update<T extends Data = Data>(id: string, updates: ToastManagerUpdateOptions<T>): void {
      emit({
        action: 'update',
        options: {
          ...updates,
          id,
        },
      });
    },

    promise<Value, T extends Data = Data>(
      promiseValue: Promise<Value>,
      options: ToastManagerPromiseOptions<Value, T>,
    ): Promise<Value> {
      let handledPromise = promiseValue;

      emit({
        action: 'promise',
        options: {
          ...options,
          promise: promiseValue,
          setPromise(promise: Promise<Value>) {
            handledPromise = promise;
          },
        },
      });

      return handledPromise;
    },
  };
}

export interface ToastManager<Data extends object = any> {
  ' subscribe': (listener: (data: ToastManagerEvent) => void) => () => void;
  add: <T extends Data = Data>(options: ToastManagerAddOptions<T>) => string;
  close: (id?: string) => void;
  update: <T extends Data = Data>(id: string, updates: ToastManagerUpdateOptions<T>) => void;
  promise: <Value, T extends Data = Data>(
    promiseValue: Promise<Value>,
    options: ToastManagerPromiseOptions<Value, T>,
  ) => Promise<Value>;
}

export interface ToastManagerEvent {
  action: 'add' | 'close' | 'update' | 'promise';
  options: any;
}
