import { createAsyncHook } from '../src/hooks';

describe('createAsyncHook', () => {
  test('should execute callback functions in order', async () => {
    const myHook = createAsyncHook();
    const callback1 = rstest.fn();
    const callback2 = rstest.fn();

    myHook.tap(callback1);
    myHook.tap(callback2);
    await myHook.callChain();
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  test('should keep params if callback functions return void', async () => {
    const myHook = createAsyncHook();
    const callback1 = rstest.fn();
    const callback2 = rstest.fn();

    myHook.tap(callback1);
    myHook.tap(callback2);

    const result = await myHook.callChain(1);
    expect(result).toEqual([1]);
  });

  test('should allow modifying params in callback functions', async () => {
    const myHook = createAsyncHook();
    const callback1 = async () => 2;
    const callback2 = async () => 3;

    myHook.tap(callback1);
    myHook.tap(callback2);

    const result = await myHook.callChain(1);
    expect(result).toEqual([3]);
  });

  test('should allow specifying hook order', async () => {
    const myHook = createAsyncHook();
    const result: number[] = [];

    myHook.tap(() => {
      result.push(1);
    });
    myHook.tap({
      handler: () => {
        result.push(2);
      },
      order: 'post',
    });
    myHook.tap({
      handler: () => {
        result.push(3);
      },
      order: 'post',
    });
    myHook.tap({
      handler: () => {
        result.push(4);
      },
      order: 'default',
    });
    myHook.tap({
      handler: () => {
        result.push(5);
      },
      order: 'pre',
    });
    myHook.tap({
      handler: () => {
        result.push(6);
      },
      order: 'pre',
    });
    myHook.tap({
      handler: () => {
        result.push(7);
      },
      order: 'default',
    });

    await myHook.callChain();

    expect(result).toEqual([5, 6, 1, 4, 7, 2, 3]);
  });

  test('should pass callChain results between callbacks', async () => {
    const logs: string[] = [];
    const hook = createAsyncHook();

    hook.tap((msg) => {
      logs.push(`first: ${msg}`);
      return 'modified message';
    });

    hook.tap((msg) => {
      logs.push(`second: ${msg}`);
    });

    await hook.callChain('original message');

    expect(logs).toEqual(['first: original message', 'second: modified message']);
  });

  test('should collect all callBatch callback results', async () => {
    const hook = createAsyncHook();

    hook.tap((msg) => {
      return `result 1: ${msg}`;
    });

    hook.tap((msg) => {
      return `result 2: ${msg}`;
    });

    const results = await hook.callBatch('test message');

    expect(results).toEqual(['result 1: test message', 'result 2: test message']);
  });
});
