import { describe, expectTypeOf, it } from 'vitest';
import { toUIMessageStream, type ToUIMessageStreamOptions } from './index';

describe('ToUIMessageStreamOptions', () => {
  it('exports lifecycle controls together with typed callbacks', () => {
    type State = { messages: string[] };

    const options: ToUIMessageStreamOptions<State> = {
      sendStart: false,
      sendFinish: false,
      onFinish: state => {
        expectTypeOf(state).toEqualTypeOf<State | undefined>();
      },
    };

    toUIMessageStream<State>(new ReadableStream(), options);
  });
});
