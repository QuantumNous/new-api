import shouldRenderFormState from '../../logic/shouldRenderFormState';
import type { ReadFormState } from '../../types';

describe('shouldRenderFormState', () => {
  const updateFormState = jest.fn();

  beforeEach(() => {
    updateFormState.mockClear();
  });

  it('should return true when formState is Empty', () => {
    const proxy = {
      isValid: true,
    } as ReadFormState;
    const result = shouldRenderFormState({}, proxy, updateFormState);
    expect(result).toBe(true);
  });

  it('should return matched key when incoming state contains subscribed key among others', () => {
    const proxy = { isValid: true } as ReadFormState;
    const result = shouldRenderFormState(
      { isValid: false, isDirty: true },
      proxy,
      updateFormState,
    );
    expect(result).toBe('isValid');
  });

  it('should not notify when incoming state keys do not overlap with subscribed keys', () => {
    const proxy = { values: true } as ReadFormState;
    const result = shouldRenderFormState(
      { name: 'secondName', errors: {} },
      proxy,
      updateFormState,
    );
    expect(result).toBeUndefined();
  });

  it('should return true when changed state key is subscribed', () => {
    const proxy: ReadFormState = {
      isDirty: true,
      isValid: false,
    } as ReadFormState;
    const result = shouldRenderFormState(
      { isDirty: true },
      proxy,
      updateFormState,
    );

    expect(result).toBe('isDirty');
    expect(updateFormState).toHaveBeenCalledWith({ isDirty: true });
  });

  it('should return false when changed state key is not subscribed', () => {
    const proxy: ReadFormState = {
      isDirty: false,
      isValid: true,
    } as ReadFormState;
    const result = shouldRenderFormState(
      { isDirty: true },
      proxy,
      updateFormState,
    );

    expect(result).toBeUndefined();
  });

  it('calls Object.keys on formState exactly once regardless of which branch is taken', () => {
    const keysSpy = jest.spyOn(Object, 'keys');

    // non-root, non-empty, no matching key → reaches .find() branch
    const proxy = { isValid: true } as ReadFormState;
    shouldRenderFormState({ isDirty: true }, proxy, updateFormState);

    // Each call to shouldRenderFormState should produce exactly one
    // Object.keys(formState) call. The proxy may also be keyed once (isRoot
    // length check is skipped here), so the formState key must not appear 2-3×.
    const formStateKeyCalls = keysSpy.mock.calls.filter(
      (args) =>
        args[0] != null &&
        typeof args[0] === 'object' &&
        'isDirty' in (args[0] as object),
    );
    expect(formStateKeyCalls).toHaveLength(1);

    keysSpy.mockRestore();
  });

  describe('when root subscribe', () => {
    it('should return subscribed key name if expecting all', () => {
      const proxy: ReadFormState = {
        isDirty: 'all',
        isValid: false,
      } as ReadFormState;
      const result = shouldRenderFormState(
        { isDirty: true },
        proxy,
        updateFormState,
        true,
      );

      expect(result).toBe('isDirty');
    });

    it('should return undefined if not expecting all', () => {
      const proxy: ReadFormState = {
        isDirty: true,
        isValid: false,
      } as ReadFormState;
      const result = shouldRenderFormState(
        { isDirty: true },
        proxy,
        updateFormState,
        true,
      );

      expect(result).toBeUndefined();
    });
  });
});
