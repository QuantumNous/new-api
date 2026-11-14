import { describe, it, expectTypeOf } from 'vitest';
import i18next, { getFixedT, TFunction } from 'i18next';

// Under `enableSelector: 'strict'`, `NsResource` drops its flattened-primary
// form: every namespace is reachable only via `$.<ns>.…`, never flat on `$`.
// This applies uniformly to single-ns hooks and multi-ns hooks alike.

declare const t: TFunction;

describe('t (strict)', () => {
  it('requires the primary namespace as the first selector segment', () => {
    // Flat primary access is gone — the next line would have typechecked under
    // the default `enableSelector: true` mode.
    // @ts-expect-error strict mode forbids flat primary access
    t(($) => $.beverage);

    expectTypeOf(t(($) => $.ns1.beverage)).toEqualTypeOf<'beverage'>();
    expectTypeOf(t(($) => $.ns1.coffee.drip.black)).toEqualTypeOf<'a strong cup of black coffee'>();
  });

  it('exposes secondary namespaces uniformly with the primary', () => {
    const tMulti = i18next.getFixedT(null, ['ns1', 'ns2']);
    expectTypeOf(tMulti(($) => $.ns1.beverage)).toEqualTypeOf<'beverage'>();
    expectTypeOf(tMulti(($) => $.ns2.fromNs2)).toEqualTypeOf<'hello from ns2'>();
    expectTypeOf(tMulti(($) => $.ns2.nested.deep)).toEqualTypeOf<'deeply nested in ns2'>();
  });

  it('rejects accessing a namespace not in the scope', () => {
    const tMulti = i18next.getFixedT(null, ['ns1', 'ns2']);
    // ns3 is not in the hook's namespace list, so it's not on $.
    // @ts-expect-error ns3 is not in scope
    tMulti(($) => $.ns3.fromNs3);
  });

  it('single-ns hook: still requires the namespace prefix', () => {
    const tSingle = i18next.getFixedT(null, 'ns2');
    expectTypeOf(tSingle(($) => $.ns2.fromNs2)).toEqualTypeOf<'hello from ns2'>();

    // @ts-expect-error no flat access even under single-ns scope
    tSingle(($) => $.fromNs2);
  });

  it('explicit ns opt narrows the scope', () => {
    expectTypeOf(t(($) => $.ns2.fromNs2, { ns: 'ns2' })).toEqualTypeOf<'hello from ns2'>();

    // @ts-expect-error wrong namespace under explicit ns opt
    t(($) => $.ns1.beverage, { ns: 'ns2' });
  });

  it('getFixedT works the same way', () => {
    expectTypeOf(getFixedT(null, 'ns1')(($) => $.ns1.beverage)).toEqualTypeOf<'beverage'>();
  });
});
