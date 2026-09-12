import { describe, it, expectTypeOf } from 'vitest';
import { Translation } from 'react-i18next';
import React from 'react';

describe('<Translation />', () => {
  it('should work with default namespace', () => (
    <Translation>{(t) => t(($) => $.foo)}</Translation>
  ));

  it('should work with named default namespace', () => (
    <Translation ns="custom">{(t) => t(($) => $.foo)}</Translation>
  ));

  it('should work with named namespace', () => (
    <Translation ns="alternate">{(t) => t(($) => $.baz)}</Translation>
  ));

  it('should work with namespace array', () => {
    <Translation ns={['alternate', 'custom']}>
      {(t) => `${t(($) => $.baz)} ${t(($) => $.custom.foo)}`}
    </Translation>;
  });

  it("raises a TypeError given a namespace that doesn't exist", () => {
    // @ts-expect-error
    <Translation>{(t) => t.fake}</Translation>;
  });

  it("raises a TypeError given a key that's not in the namespace", () => {
    // @ts-expect-error
    <Translation ns="custom">{(t) => t.fake}</Translation>;
  });

  it("raises a TypeError given a key that's not in the namespace (with namespace as prefix)", () => {
    // @ts-expect-error
    <Translation ns="custom">{(t) => t.custom.fake}</Translation>;
  });
});
