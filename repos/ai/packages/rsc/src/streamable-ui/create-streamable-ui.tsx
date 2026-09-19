import { HANGING_STREAM_WARNING_TIME_MS } from '../util/constants';
import { createResolvablePromise } from '../util/create-resolvable-promise';
import { createSuspendedChunk } from './create-suspended-chunk';

// It's necessary to define the type manually here, otherwise TypeScript compiler
// will not be able to infer the correct return type as it's circular.
type StreamableUIWrapper = {
  /**
   * The value of the streamable UI. This can be returned from a Server Action and received by the client.
   */
  readonly value: React.ReactNode;

  /**
   * This method updates the current UI node. It takes a new UI node and replaces the old one.
   */
  update(value: React.ReactNode): StreamableUIWrapper;

  /**
   * This method is used to append a new UI node to the end of the old one.
   * Once appended a new UI node, the previous UI node cannot be updated anymore.
   *
   * @example
   * ```jsx
   * const ui = createStreamableUI(<div>hello</div>)
   * ui.append(<div>world</div>)
   *
   * // The UI node will be:
   * // <>
   * //   <div>hello</div>
   * //   <div>world</div>
   * // </>
   * ```
   */
  append(value: React.ReactNode): StreamableUIWrapper;

  /**
   * This method is used to signal that there is an error in the UI stream.
   * It will be thrown on the client side and caught by the nearest error boundary component.
   */
  error(error: any): StreamableUIWrapper;

  /**
   * This method marks the UI node as finalized. You can either call it without any parameters or with a new UI node as the final state.
   * Once called, the UI node cannot be updated or appended anymore.
   *
   * This method is always **required** to be called, otherwise the response will be stuck in a loading state.
   */
  done(...args: [React.ReactNode] | []): StreamableUIWrapper;
};

/**
 * Create a piece of changeable UI that can be streamed to the client.
 * On the client side, it can be rendered as a normal React node.
 */
function createStreamableUI(initialValue?: React.ReactNode) {
  let currentValue = initialValue;
  let closed = false;
  let { row, resolve, reject } = createSuspendedChunk(initialValue);

  function assertStream(method: string) {
    if (closed) {
      throw new Error(method + ': UI stream is already closed.');
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
          'The streamable UI has been slow to update. This may be a bug or a performance issue or you forgot to call `.done()`.',
        );
      }, HANGING_STREAM_WARNING_TIME_MS);
    }
  }
  warnUnclosedStream();

  const streamable: StreamableUIWrapper = {
    value: row,
    update(value: React.ReactNode) {
      assertStream('.update()');

      // There is no need to update the value if it's referentially equal.
      if (value === currentValue) {
        warnUnclosedStream();
        return streamable;
      }

      const resolvable = createResolvablePromise();
      currentValue = value;

      resolve({ value: currentValue, done: false, next: resolvable.promise });
      resolve = resolvable.resolve;
      reject = resolvable.reject;

      warnUnclosedStream();

      return streamable;
    },
    append(value: React.ReactNode) {
      assertStream('.append()');

      const resolvable = createResolvablePromise();
      currentValue = value;

      resolve({ value, done: false, append: true, next: resolvable.promise });
      resolve = resolvable.resolve;
      reject = resolvable.reject;

      warnUnclosedStream();

      return streamable;
    },
    error(error: any) {
      assertStream('.error()');

      if (warningTimeout) {
        clearTimeout(warningTimeout);
      }
      closed = true;
      reject(error);

      return streamable;
    },
    done(...args: [] | [React.ReactNode]) {
      assertStream('.done()');

      if (warningTimeout) {
        clearTimeout(warningTimeout);
      }
      closed = true;
      if (args.length) {
        resolve({ value: args[0], done: true });
        return streamable;
      }
      resolve({ value: currentValue, done: true });

      return streamable;
    },
  };

  return streamable;
}

export { createStreamableUI };
