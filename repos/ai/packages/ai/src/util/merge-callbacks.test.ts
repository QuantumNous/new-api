import { describe, expect, it } from 'vitest';
import { mergeCallbacks } from './merge-callbacks';

describe('mergeCallbacks', () => {
  it('should invoke callbacks in parallel, wait for them to settle, and continue after errors', async () => {
    const calls: string[] = [];

    let resolveFirstCallback!: () => void;
    const firstCallbackCompleted = new Promise<void>(resolve => {
      resolveFirstCallback = resolve;
    });

    const merged = mergeCallbacks<{ value: string }>(
      async event => {
        calls.push(`first start: ${event.value}`);
        await firstCallbackCompleted;
        calls.push('first end');
      },
      undefined,
      () => {
        calls.push('second before throw');
        throw new Error('callback error');
      },
      event => {
        calls.push(`third: ${event.value}`);
      },
    );

    let mergedResolved = false;
    const mergedPromise = Promise.resolve(merged({ value: 'hello' })).then(
      () => {
        mergedResolved = true;
      },
    );
    calls.push('after call');

    await Promise.resolve();

    expect(mergedResolved).toBe(false);
    expect(calls).toMatchInlineSnapshot(`
      [
        "first start: hello",
        "second before throw",
        "third: hello",
        "after call",
      ]
    `);

    resolveFirstCallback();
    await mergedPromise;

    expect(calls).toMatchInlineSnapshot(`
      [
        "first start: hello",
        "second before throw",
        "third: hello",
        "after call",
        "first end",
      ]
    `);
  });

  it('should ignore rejected callbacks', async () => {
    const calls: string[] = [];

    const merged = mergeCallbacks<{ value: string }>(
      async event => {
        calls.push(`first before reject: ${event.value}`);
        await Promise.resolve();
        throw new Error('callback error');
      },
      event => {
        calls.push(`second: ${event.value}`);
      },
    );

    await expect(merged({ value: 'hello' })).resolves.toBeUndefined();

    expect(calls).toMatchInlineSnapshot(`
      [
        "first before reject: hello",
        "second: hello",
      ]
    `);
  });

  it('should ignore undefined callbacks', async () => {
    const calls: string[] = [];

    const merged = mergeCallbacks<{ value: string }>(
      undefined,
      event => {
        calls.push(event.value);
      },
      undefined,
    );

    await merged({ value: 'hello' });

    expect(calls).toMatchInlineSnapshot(`
      [
        "hello",
      ]
    `);
  });
});
