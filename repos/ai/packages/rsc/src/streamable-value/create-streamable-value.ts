import { HANGING_STREAM_WARNING_TIME_MS } from '../util/constants';
import { createResolvablePromise } from '../util/create-resolvable-promise';
import {
  STREAMABLE_VALUE_TYPE,
  type StreamablePatch,
  type StreamableValue,
} from './streamable-value';
const STREAMABLE_VALUE_INTERNAL_LOCK = Symbol('streamable.value.lock');

/**
 * Create a wrapped, changeable value that can be streamed to the client.
 * On the client side, the value can be accessed via the readStreamableValue() API.
 */
function createStreamableValue<T = any, E = any>(
  initialValue?: T | ReadableStream<T>,
) {
  const isReadableStream =
    initialValue instanceof ReadableStream ||
    (typeof initialValue === 'object' &&
      initialValue !== null &&
      'getReader' in initialValue &&
      typeof initialValue.getReader === 'function' &&
      'locked' in initialValue &&
      typeof initialValue.locked === 'boolean');

  if (!isReadableStream) {
    return createStreamableValueImpl<T, E>(initialValue);
  }

  const streamableValue = createStreamableValueImpl<T, E>();

  // Since the streamable value will be from a readable stream, it's not allowed
  // to update the value manually as that introduces race conditions and
  // unexpected behavior.
  // We lock the value to prevent any updates from the user.
  streamableValue[STREAMABLE_VALUE_INTERNAL_LOCK] = true;

  (async () => {
    try {
      // Consume the readable stream and update the value.
      const reader = initialValue.getReader();

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        // Unlock the value to allow updates.
        streamableValue[STREAMABLE_VALUE_INTERNAL_LOCK] = false;
        if (typeof value === 'string') {
          streamableValue.append(value);
        } else {
          streamableValue.update(value);
        }
        // Lock the value again.
        streamableValue[STREAMABLE_VALUE_INTERNAL_LOCK] = true;
      }

      streamableValue[STREAMABLE_VALUE_INTERNAL_LOCK] = false;
      streamableValue.done();
    } catch (e) {
      streamableValue[STREAMABLE_VALUE_INTERNAL_LOCK] = false;
      streamableValue.error(e);
    }
  })();

  return streamableValue;
}

// It's necessary to define the type manually here, otherwise TypeScript compiler
// will not be able to infer the correct return type as it's circular.
type StreamableValueWrapper<T, E> = {
  /**
   * The value of the streamable. This can be returned from a Server Action and
   * received by the client. To read the streamed values, use the
   * `readStreamableValue` or `useStreamableValue` APIs.
   */
  readonly value: StreamableValue<T, E>;

  /**
   * This method updates the current value with a new one.
   */
  update(value: T): StreamableValueWrapper<T, E>;

  /**
   * This method is used to append a delta string to the current value. It
   * requires the current value of the streamable to be a string.
   *
   * @example
   * ```jsx
   * const streamable = createStreamableValue('hello');
   * streamable.append(' world');
   *
   * // The value will be 'hello world'
   * ```
   */
  append(value: T): StreamableValueWrapper<T, E>;

  /**
   * This method is used to signal that there is an error in the value stream.
   * It will be thrown on the client side when consumed via
   * `readStreamableValue` or `useStreamableValue`.
   */
  error(error: any): StreamableValueWrapper<T, E>;

  /**
   * This method marks the value as finalized. You can either call it without
   * any parameters or with a new value as the final state.
   * Once called, the value cannot be updated or appended anymore.
   *
   * This method is always **required** to be called, otherwise the response
   * will be stuck in a loading state.
   */
  done(...args: [T] | []): StreamableValueWrapper<T, E>;

  /**
   * @internal This is an internal lock to prevent the value from being
   * updated by the user.
   */
  [STREAMABLE_VALUE_INTERNAL_LOCK]: boolean;
};

function createStreamableValueImpl<T = any, E = any>(initialValue?: T) {
  let closed = false;
  let locked = false;
  let resolvable = createResolvablePromise<StreamableValue<T, E>>();

  let currentValue = initialValue;
  let currentError: E | undefined;
  let currentPromise: typeof resolvable.promise | undefined =
    resolvable.promise;
  let currentPatchValue: StreamablePatch;

  function assertStream(method: string) {
    if (closed) {
      throw new Error(method + ': Value stream is already closed.');
    }
    if (locked) {
      throw new Error(
        method + ': Value stream is locked and cannot be updated.',
      );
    }
  }

  let warningTimeout: NodeJS.Timeout | undefined;
  function warnUnclosedStream() {
    if (process.env.NODE_ENV === 'development') {
      if (warningTimeout) {
        clearTimeout(warningTimeout);
      }
      warningTimeout = setTimeout(() => {
        console.warn(
          'The streamable value has been slow to update. This may be a bug or a performance issue or you forgot to call `.done()`.',
        );
      }, HANGING_STREAM_WARNING_TIME_MS);
    }
  }
  warnUnclosedStream();

  function createWrapped(initialChunk?: boolean): StreamableValue<T, E> {
    // This makes the payload much smaller if there're mutative updates before the first read.
    let init: Partial<StreamableValue<T, E>>;

    if (currentError !== undefined) {
      init = { error: currentError };
    } else {
      if (currentPatchValue && !initialChunk) {
        init = { diff: currentPatchValue };
      } else {
        init = { curr: currentValue };
      }
    }

    if (currentPromise) {
      init.next = currentPromise;
    }

    if (initialChunk) {
      init.type = STREAMABLE_VALUE_TYPE;
    }

    return init;
  }

  // Update the internal `currentValue` and `currentPatchValue` if needed.
  function updateValueStates(value: T) {
    // If we can only send a patch over the wire, it's better to do so.
    currentPatchValue = undefined;
    if (typeof value === 'string') {
      if (typeof currentValue === 'string') {
        if (value.startsWith(currentValue)) {
          currentPatchValue = [0, value.slice(currentValue.length)];
        }
      }
    }

    currentValue = value;
  }

  const streamable: StreamableValueWrapper<T, E> = {
    set [STREAMABLE_VALUE_INTERNAL_LOCK](state: boolean) {
      locked = state;
    },
    get value() {
      return createWrapped(true);
    },
    update(value: T) {
      assertStream('.update()');

      const resolvePrevious = resolvable.resolve;
      resolvable = createResolvablePromise();

      updateValueStates(value);
      currentPromise = resolvable.promise;
      resolvePrevious(createWrapped());

      warnUnclosedStream();

      return streamable;
    },
    append(value: T) {
      assertStream('.append()');

      if (
        typeof currentValue !== 'string' &&
        typeof currentValue !== 'undefined'
      ) {
        throw new Error(
          `.append(): The current value is not a string. Received: ${typeof currentValue}`,
        );
      }
      if (typeof value !== 'string') {
        throw new Error(
          `.append(): The value is not a string. Received: ${typeof value}`,
        );
      }

      const resolvePrevious = resolvable.resolve;
      resolvable = createResolvablePromise();

      if (typeof currentValue === 'string') {
        currentPatchValue = [0, value];
        (currentValue as string) = currentValue + value;
      } else {
        currentPatchValue = undefined;
        currentValue = value;
      }

      currentPromise = resolvable.promise;
      resolvePrevious(createWrapped());

      warnUnclosedStream();

      return streamable;
    },
    error(error: any) {
      assertStream('.error()');

      if (warningTimeout) {
        clearTimeout(warningTimeout);
      }
      closed = true;
      currentError = error;
      currentPromise = undefined;

      resolvable.resolve({ error });

      return streamable;
    },
    done(...args: [] | [T]) {
      assertStream('.done()');

      if (warningTimeout) {
        clearTimeout(warningTimeout);
      }
      closed = true;
      currentPromise = undefined;

      if (args.length) {
        updateValueStates(args[0]);
        resolvable.resolve(createWrapped());
        return streamable;
      }

      resolvable.resolve({});

      return streamable;
    },
  };

  return streamable;
}

export { createStreamableValue };
