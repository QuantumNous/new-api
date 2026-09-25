import { expect } from 'vitest';
import * as React from 'react';
import { getReactElementRef } from './getReactElementRef';

describe('getReactElementRef', () => {
  it('returns null when not provided a React element', () => {
    expect(getReactElementRef(false)).toBe(null);
    expect(getReactElementRef(undefined)).toBe(null);
    expect(getReactElementRef(1)).toBe(null);

    const children = [<div key="1" />, <div key="2" />];
    expect(getReactElementRef(children)).toBe(null);
  });

  it('returns the ref of a React element', () => {
    const ref = React.createRef<HTMLDivElement>();
    const element = <div ref={ref} />;

    expect(getReactElementRef(element)).toBe(ref);
  });

  it('returns null for a fragment', () => {
    const element = (
      <React.Fragment>
        <p>Hello</p>
        <p>Hello</p>
      </React.Fragment>
    );

    expect(getReactElementRef(element)).toBe(null);
  });

  it('returns null for an element without a ref', () => {
    const element = <div />;

    expect(getReactElementRef(element)).toBe(null);
  });
});
