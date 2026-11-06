import {
  createCallbacksTransformer,
  type StreamCallbacks,
} from './stream-callbacks';
import { describe, it, expect, vi } from 'vitest';

describe('createCallbacksTransformer', () => {
  async function processStream(
    input: string[],
    callbacks?: StreamCallbacks,
  ): Promise<string[]> {
    const transformer = createCallbacksTransformer(callbacks);
    const readable = new ReadableStream({
      start(controller) {
        for (const chunk of input) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const output: string[] = [];
    const writable = new WritableStream({
      write(chunk) {
        output.push(chunk);
      },
    });

    await readable.pipeThrough(transformer).pipeTo(writable);
    return output;
  }

  it('should pass through messages without callbacks', async () => {
    const input = ['Hello', ' ', 'World'];
    const output = await processStream(input);

    expect(output).toEqual(input);
  });

  it('should pass through messages with empty callbacks object', async () => {
    const input = ['Hello', ' ', 'World'];
    const output = await processStream(input, {});

    expect(output).toEqual(input);
  });

  it('should call onStart once at the beginning', async () => {
    const onStart = vi.fn();
    const input = ['Hello', ' ', 'World'];

    await processStream(input, { onStart });

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('should call async onStart', async () => {
    const onStart = vi.fn().mockResolvedValue(undefined);
    const input = ['Hello'];

    await processStream(input, { onStart });

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('should call onToken for each message', async () => {
    const onToken = vi.fn();
    const input = ['Hello', ' ', 'World'];

    await processStream(input, { onToken });

    expect(onToken).toHaveBeenCalledTimes(3);
    expect(onToken).toHaveBeenNthCalledWith(1, 'Hello');
    expect(onToken).toHaveBeenNthCalledWith(2, ' ');
    expect(onToken).toHaveBeenNthCalledWith(3, 'World');
  });

  it('should call async onToken', async () => {
    const onToken = vi.fn().mockResolvedValue(undefined);
    const input = ['Hello', 'World'];

    await processStream(input, { onToken });

    expect(onToken).toHaveBeenCalledTimes(2);
  });

  it('should call onText for each string message', async () => {
    const onText = vi.fn();
    const input = ['Hello', ' ', 'World'];

    await processStream(input, { onText });

    expect(onText).toHaveBeenCalledTimes(3);
    expect(onText).toHaveBeenNthCalledWith(1, 'Hello');
    expect(onText).toHaveBeenNthCalledWith(2, ' ');
    expect(onText).toHaveBeenNthCalledWith(3, 'World');
  });

  it('should call async onText', async () => {
    const onText = vi.fn().mockResolvedValue(undefined);
    const input = ['Hello'];

    await processStream(input, { onText });

    expect(onText).toHaveBeenCalledTimes(1);
  });

  it('should call onFinal with aggregated response', async () => {
    const onFinal = vi.fn();
    const input = ['Hello', ' ', 'World'];

    await processStream(input, { onFinal });

    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith('Hello World');
  });

  it('should call async onFinal', async () => {
    const onFinal = vi.fn().mockResolvedValue(undefined);
    const input = ['Hello', 'World'];

    await processStream(input, { onFinal });

    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith('HelloWorld');
  });

  it('should call onFinal with empty string when no messages', async () => {
    const onFinal = vi.fn();
    const input: string[] = [];

    await processStream(input, { onFinal });

    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith('');
  });

  it('should call all callbacks in correct order', async () => {
    const callOrder: string[] = [];

    const callbacks: StreamCallbacks = {
      onStart: () => {
        callOrder.push('start');
      },
      onToken: token => {
        callOrder.push(`token:${token}`);
      },
      onText: text => {
        callOrder.push(`text:${text}`);
      },
      onFinal: completion => {
        callOrder.push(`final:${completion}`);
      },
    };

    const input = ['A', 'B'];
    await processStream(input, callbacks);

    expect(callOrder).toEqual([
      'start',
      'token:A',
      'text:A',
      'token:B',
      'text:B',
      'final:AB',
    ]);
  });

  it('should handle single character messages', async () => {
    const onToken = vi.fn();
    const onFinal = vi.fn();
    const input = ['a', 'b', 'c'];

    await processStream(input, { onToken, onFinal });

    expect(onToken).toHaveBeenCalledTimes(3);
    expect(onFinal).toHaveBeenCalledWith('abc');
  });

  it('should handle messages with special characters', async () => {
    const onFinal = vi.fn();
    const input = ['Hello\n', 'World\t', '!'];

    await processStream(input, { onFinal });

    expect(onFinal).toHaveBeenCalledWith('Hello\nWorld\t!');
  });

  it('should handle unicode characters', async () => {
    const onFinal = vi.fn();
    const input = ['こんにちは', ' ', '🌍'];

    await processStream(input, { onFinal });

    expect(onFinal).toHaveBeenCalledWith('こんにちは 🌍');
  });
});
