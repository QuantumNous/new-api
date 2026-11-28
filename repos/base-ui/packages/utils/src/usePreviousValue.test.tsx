import { expect } from 'vitest';
import * as React from 'react';
import { act, createRenderer } from '@mui/internal-test-utils';
import { usePreviousValue } from './usePreviousValue';

interface TestComponentProps {
  value: any;
  unrelatedProp?: any;
  children: (previous: any) => React.ReactNode;
}

function TestComponent({ value, children }: TestComponentProps) {
  const previous = usePreviousValue(value);
  return children(previous);
}

describe('usePrevious', () => {
  const { render } = createRenderer();

  it('should return null on the first render', () => {
    let previousValue: any;
    render(
      <TestComponent value="first">
        {(previous) => {
          previousValue = previous;
          return null;
        }}
      </TestComponent>,
    );

    expect(previousValue).toBe(null);
  });

  it('should return the previous value on subsequent renders', () => {
    let previousValue: any;
    const { setProps } = render(
      <TestComponent value="first">
        {(previous) => {
          previousValue = previous;
          return null;
        }}
      </TestComponent>,
    );

    expect(previousValue).toBe(null);

    setProps({ value: 'second' });
    expect(previousValue).toBe('first');

    setProps({ value: 'third' });
    expect(previousValue).toBe('second');
  });

  it('should work with primitive values', () => {
    let previousValue: any;
    const { setProps } = render(
      <TestComponent value={42}>
        {(previous) => {
          previousValue = previous;
          return null;
        }}
      </TestComponent>,
    );

    expect(previousValue).toBe(null);

    setProps({ value: 100 });
    expect(previousValue).toBe(42);

    setProps({ value: true });
    expect(previousValue).toBe(100);

    setProps({ value: false });
    expect(previousValue).toBe(true);
  });

  it('should ignore renders where the value does not change', () => {
    let previousValue: any;
    const { setProps } = render(
      <TestComponent value="stable">
        {(previous) => {
          previousValue = previous;
          return null;
        }}
      </TestComponent>,
    );

    expect(previousValue).toBe(null);

    setProps({ unrelatedProp: 1 });
    expect(previousValue).toBe(null);

    setProps({ unrelatedProp: 2 });
    expect(previousValue).toBe(null);
  });

  it('should work with object values', () => {
    let previousValue: any;
    const obj1 = { a: 1 };
    const obj2 = { b: 2 };
    const obj3 = { c: 3 };

    const { setProps } = render(
      <TestComponent value={obj1}>
        {(previous) => {
          previousValue = previous;
          return null;
        }}
      </TestComponent>,
    );

    expect(previousValue).toBe(null);

    setProps({ value: obj2 });
    expect(previousValue).toBe(obj1);

    setProps({ value: obj3 });
    expect(previousValue).toBe(obj2);
  });

  it('should handle undefined and null values', () => {
    let previousValue: any;
    const { setProps } = render(
      <TestComponent value={undefined}>
        {(previous) => {
          previousValue = previous;
          return null;
        }}
      </TestComponent>,
    );

    expect(previousValue).toBe(null);

    setProps({ value: null });
    expect(previousValue).toBe(undefined);

    setProps({ value: 'defined' });
    expect(previousValue).toBe(null);

    setProps({ value: undefined });
    expect(previousValue).toBe('defined');
  });

  it('should handle rapid value changes', () => {
    let previousValue: any;
    const { setProps } = render(
      <TestComponent value="initial">
        {(previous) => {
          previousValue = previous;
          return null;
        }}
      </TestComponent>,
    );

    expect(previousValue).toBe(null);

    act(() => {
      setProps({ value: 'first' });
      setProps({ value: 'second' });
      setProps({ value: 'third' });
    });

    // With React batching, only the final value 'third' causes a render,
    // so the previous value should be 'initial' (from the first render)
    expect(previousValue).toBe('initial');
  });

  it('should maintain type safety', () => {
    let previousValue: string | null = null;
    const { setProps } = render(
      <TestComponent value="hello">
        {(previous: string | null) => {
          previousValue = previous;
          return null;
        }}
      </TestComponent>,
    );

    expect(previousValue).toBe(null);

    setProps({ value: 'world' });
    expect(previousValue).toBe('hello');
    expect(typeof previousValue).toBe('string');
  });
});
