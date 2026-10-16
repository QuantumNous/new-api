import { describe, it, expectTypeOf } from 'vitest';
import i18next, { getFixedT, TFunction, keyFromSelector, SelectorKey } from 'i18next';

declare const t: TFunction;

describe('t', () => {
  it('basic selector usage', () => {
    expectTypeOf(t(($) => $.beverage)).toEqualTypeOf<'beverage'>();

    expectTypeOf(t(($) => $['beverage|beer'])).toEqualTypeOf<'beer'>();

    expectTypeOf(t(($) => $.coffee.bar['espresso|americano'])).toEqualTypeOf<'a hot americano'>();

    expectTypeOf(t(($) => $.coffee.bar['espresso|cappuccino'], { count: 1 })).toEqualTypeOf<
      'a dry cappuccino' | '{{count}} dry cappuccinos'
    >();

    expectTypeOf(t(($) => $.coffee.bar['espresso|cappuccino'], { count: 1 })).toEqualTypeOf<
      'a dry cappuccino' | '{{count}} dry cappuccinos'
    >();

    expectTypeOf(
      // @ts-expect-error: plural keys have been removed
      t(($) => $.coffee.bar['espresso|cappuccino_one']),
    ).toEqualTypeOf<'a dry cappuccino'>();

    expectTypeOf(t(($) => $.coffee.bar['espresso|cappuccino'], { count: 1 })).toEqualTypeOf<
      'a dry cappuccino' | '{{count}} dry cappuccinos'
    >();

    expectTypeOf(
      // @ts-expect-error: plural keys have been removed
      t(($) => $.coffee.bar['espresso|cappuccino_other']),
    ).toEqualTypeOf<'{{count}} dry cappuccinos'>();

    expectTypeOf(t(($) => $.coffee.bar['espresso|latte'], { count: 1 })).toEqualTypeOf<
      'a foamy latte' | '{{count}} foamy lattes'
    >();

    expectTypeOf(t(($) => $.coffee.bar['espresso|latte'], { count: 1 })).toEqualTypeOf<
      'a foamy latte' | '{{count}} foamy lattes'
    >();

    expectTypeOf(
      // @ts-expect-error: plural keys have been removed
      t(($) => $.coffee.bar['espresso|latte_one']),
    ).toEqualTypeOf<'a foamy latte'>();

    expectTypeOf(
      // @ts-expect-error: plural keys have been removed
      t(($) => $.coffee.bar['espresso|latte_other']),
    ).toEqualTypeOf<'{{count}} foamy lattes'>();

    expectTypeOf(t(($) => $.coffee.bar.shot)).toEqualTypeOf<'a shot of espresso'>();

    expectTypeOf(t(($) => $.coffee.drip.black)).toEqualTypeOf<'a strong cup of black coffee'>();

    expectTypeOf(t(($) => $['dessert|cake'])).toEqualTypeOf<'a nice cake'>();

    expectTypeOf(t(($) => $['dessert|muffin'], { count: 1 })).toEqualTypeOf<
      'a nice muffin' | '{{count}} nice muffins'
    >();

    expectTypeOf(t(($) => $['dessert|muffin'], { count: 1 })).toEqualTypeOf<
      'a nice muffin' | '{{count}} nice muffins'
    >();

    expectTypeOf(
      // @ts-expect-error: plural keys have been removed
      t(($) => $['dessert|muffin_one']),
    ).toEqualTypeOf<'a nice muffin'>();

    expectTypeOf(
      // @ts-expect-error: plural keys have been removed
      t(($) => $['dessert|muffin_other']),
    ).toEqualTypeOf<'{{count}} nice muffins'>();

    expectTypeOf(t(($) => $.sodas.coca_cola.coke)).toEqualTypeOf<'a can of coke'>();

    expectTypeOf(t(($) => $.sodas.coca_cola['coke|diet'], { count: 1 })).toEqualTypeOf<
      'a can of diet coke' | '{{count}} cans of diet coke'
    >();

    expectTypeOf(t(($) => $.sodas.coca_cola['coke|diet'], { count: 1 })).toEqualTypeOf<
      'a can of diet coke' | '{{count}} cans of diet coke'
    >();

    expectTypeOf(
      // @ts-expect-error: plural keys have been removed
      t(($) => $.sodas.coca_cola['coke|diet_one']),
    ).toEqualTypeOf<'a can of diet coke'>();

    expectTypeOf(
      // @ts-expect-error: plural keys have been removed
      t(($) => $.sodas.coca_cola['coke|diet_other']),
    ).toEqualTypeOf<'{{count}} cans of diet coke'>();

    expectTypeOf(t(($) => $.sodas.faygo.orange, { count: 1 })).toEqualTypeOf<
      'one orange faygo' | '{{count}} orange faygo'
    >();

    expectTypeOf(
      // @ts-expect-error: plural keys have been removed
      t(($) => $.sodas.faygo.orange_one),
    ).toEqualTypeOf<'one orange faygo'>();

    expectTypeOf(
      // @ts-expect-error: plural keys have been removed
      t(($) => $.sodas.faygo.orange_other),
    ).toEqualTypeOf<'{{count}} orange faygo'>();

    expectTypeOf(t(($) => $.sodas.faygo.purple)).toEqualTypeOf<'purple faygo'>();

    expectTypeOf(t(($) => $.tea, { count: 1 })).toEqualTypeOf<
      'a cuppa tea and a lie down' | '{{count}} cups of tea and a big sleep'
    >();

    expectTypeOf(t(($) => $.tea, { count: 1 })).toEqualTypeOf<
      'a cuppa tea and a lie down' | '{{count}} cups of tea and a big sleep'
    >();

    // @ts-expect-error: plural keys are removed
    expectTypeOf(t(($) => $.tea_other)).toEqualTypeOf<'{{count}} cups of tea and a big sleep'>();

    // @ts-expect-error: plural selectors require count
    t(($) => $.tea);

    // @ts-expect-error: plural selectors require count
    t(($) => $.sodas.faygo.orange);
  });

  it('selector works with arrays', () => {
    expectTypeOf(t(($) => $.array[0])).toEqualTypeOf<'element one'>();

    expectTypeOf(t(($) => $.array[1].elementTwo)).toEqualTypeOf<'element two'>();

    expectTypeOf(
      t(($) => $.array[2].elementThree[0].nestedElementThree),
    ).toEqualTypeOf<'element three'>();
  });

  it('selector works with context', () => {
    expectTypeOf(t(($) => $.dessert, { context: 'cake' })).toEqualTypeOf<'a nice cake'>();

    expectTypeOf(t(($) => $.dessert, { context: 'muffin', count: 2 })).toEqualTypeOf<
      'a nice muffin' | '{{count}} nice muffins'
    >();

    expectTypeOf(
      t(($) => $.coffee.bar.espresso, { context: 'cappuccino', count: 2 }),
    ).toEqualTypeOf<'a dry cappuccino' | '{{count}} dry cappuccinos'>();

    expectTypeOf(t(($) => $.coffee.bar.espresso, { context: 'latte', count: 3 })).toEqualTypeOf<
      'a foamy latte' | '{{count}} foamy lattes'
    >();

    expectTypeOf(t(($) => $.sodas.coca_cola.coke, { context: 'diet', count: 1 })).toEqualTypeOf<
      'a can of diet coke' | '{{count}} cans of diet coke'
    >();
  });

  it('returnObjects + context', () => {
    // Array elements should preserve their properties when using context
    expectTypeOf(
      t(($) => $.array[1], { returnObjects: true, context: 'cappuccino' }),
    ).toEqualTypeOf<{
      elementTwo: 'element two';
    }>();
  });

  it('getFixedT', () => {
    const fixedT = getFixedT(null, 'ns1', 'coffee');

    expectTypeOf(fixedT(($) => $.bar.shot)).toEqualTypeOf<'a shot of espresso'>();
  });

  it('namespace: single', () => {
    expectTypeOf(t(($) => $.fromNs2, { ns: 'ns2' })).toEqualTypeOf<'hello from ns2'>();
  });

  it('namespace: multiple', () => {
    expectTypeOf(t(($) => $.fromNs2, { ns: ['ns2', 'ns3'] })).toEqualTypeOf<'hello from ns2'>();
    expectTypeOf(t(($) => $.fromNs3, { ns: ['ns3', 'ns2'] })).toEqualTypeOf<'hello from ns3'>();
  });

  it('returnObjects', () => {
    expectTypeOf(t(($) => $.sodas.faygo, { returnObjects: true })).toEqualTypeOf<{
      orange: 'one orange faygo' | '{{count}} orange faygo';
      purple: 'purple faygo';
    }>();

    expectTypeOf(t(($) => $.array[1], { returnObjects: true })).toEqualTypeOf<{
      elementTwo: 'element two';
    }>();
  });

  it('defaultValue', () => {
    expectTypeOf(t(($) => $.beverage, { defaultValue: 'defaultValue' })).toEqualTypeOf<
      'beverage' | 'defaultValue'
    >();
    expectTypeOf(t(($) => $['beverage|beer'], { defaultValue: 'defaultValue' })).toEqualTypeOf<
      'beer' | 'defaultValue'
    >();
    expectTypeOf(t(($) => $.array[0], { defaultValue: 'defaultValue' })).toEqualTypeOf<
      'element one' | 'defaultValue'
    >();
    expectTypeOf(t(($) => $.array[1].elementTwo, { defaultValue: 'hi' })).toEqualTypeOf<
      'element two' | 'hi'
    >();
  });

  it('returnObjects + defaultValue', () => {
    expectTypeOf(
      t(($) => $.array[1], { returnObjects: true, defaultValue: 'defaultValue' }),
    ).toEqualTypeOf<{ elementTwo: 'element two' } | 'defaultValue'>();
  });

  it('defaultValue + context', () => {
    expectTypeOf(
      t(($) => $.beverage, { context: 'beer', defaultValue: 'defaultValue' }),
    ).toEqualTypeOf<'beer' | 'defaultValue'>();
  });

  it('returnObjects + defaultValue + context', () => {
    expectTypeOf(
      t(($) => $.beverage, { returnObjects: true, defaultValue: 'defaultValue', context: 'beer' }),
    ).toEqualTypeOf<'beer' | 'defaultValue'>();
  });

  it('supports interpolation', () => {
    t(($) => $.interpolation.val, { val: '' });
  });

  it('selector fallback array — single namespace', () => {
    // Both selectors resolve to the same type; result is the union.
    expectTypeOf(t([($) => $.beverage, ($) => $.coffee.bar.shot])).toEqualTypeOf<
      'beverage' | 'a shot of espresso'
    >();

    // Fallback between a plural group and a plain string.
    expectTypeOf(t([($) => $.tea, ($) => $.coffee.drip.black])).toEqualTypeOf<
      | 'a cuppa tea and a lie down'
      | '{{count}} cups of tea and a big sleep'
      | 'a strong cup of black coffee'
    >();

    // Fallback within nested keys.
    expectTypeOf(t([($) => $.sodas.faygo.purple, ($) => $.sodas.coca_cola.coke])).toEqualTypeOf<
      'purple faygo' | 'a can of coke'
    >();
  });

  // Both selectors resolve to plural groups; PluralValue brand is stripped from both.
  expectTypeOf(t([($) => $.tea, ($) => $.sodas.faygo.orange])).toEqualTypeOf<
    | 'a cuppa tea and a lie down'
    | '{{count}} cups of tea and a big sleep'
    | 'one orange faygo'
    | '{{count}} orange faygo'
  >();

  it('selector fallback array — with options', () => {
    // defaultValue widens the return type for every selector in the array.
    expectTypeOf(
      t([($) => $.beverage, ($) => $.coffee.bar.shot], { defaultValue: 'fallback' }),
    ).toEqualTypeOf<'beverage' | 'a shot of espresso' | 'fallback'>();

    // Note: returnObjects: true with a selector array is not separately tested here —
    // the existing single-selector returnObjects tests already cover that code path,
    // and pinning the exact disjoint-union shape requires toEqualTypeOf (which fails
    // on disjoint unions) or toMatchTypeOf (which is directional and cannot assert both
    // members simultaneously). Coverage is provided by the single-selector suite above.
  });

  it('selector fallback array — explicit namespace', () => {
    // Array of selectors targeting a non-default namespace.
    expectTypeOf(
      t([($) => $.fromNs2, ($) => $.fromNs2], { ns: 'ns2' }),
    ).toEqualTypeOf<'hello from ns2'>();

    // Mixed namespaces in fallback — GetSource exposes the primary namespace (ns2) keys
    // directly on $, while secondary namespaces are hung under their name ($.ns3).
    // At runtime, keysFromSelector rewrites secondary-namespace paths to "ns3:fromNs3"
    // so extractFromKey routes them correctly, while primary-namespace paths are left as-is.
    expectTypeOf(
      t([($) => $.fromNs2, ($) => $.ns3.fromNs3], { ns: ['ns2', 'ns3'] as const }),
    ).toEqualTypeOf<'hello from ns2' | 'hello from ns3'>();
  });

  it('selector fallback array — @ts-expect-error on invalid keys', () => {
    expectTypeOf(
      // @ts-expect-error: plural suffixed keys are removed from the selector source
      t([($) => $.tea_one, ($) => $.tea_other]),
    ).toEqualTypeOf<'a cuppa tea and a lie down' | '{{count}} cups of tea and a big sleep'>();
  });

  it('keyFromSelector returns SelectorKey', () => {
    const key = keyFromSelector(($) => $.beverage);
    expectTypeOf(key).toEqualTypeOf<SelectorKey>();

    // plain strings are NOT assignable to SelectorKey (branded)
    // @ts-expect-error
    const badKey: SelectorKey = 'beverage';

    void badKey;
  });

  it('t accepts a single SelectorKey', () => {
    const key = keyFromSelector(($) => $.beverage);
    const result = t(key);
    expectTypeOf(result).toBeString();
  });

  it('t accepts a SelectorKey with options', () => {
    const key = keyFromSelector(($) => $.tea);
    const result = t(key, { count: 1 });
    expectTypeOf(result).toBeString();
  });

  it('t accepts an array of SelectorKeys', () => {
    const key1 = keyFromSelector(($) => $.beverage);
    const key2 = keyFromSelector(($) => $.coffee.bar.shot);
    const result = t([key1, key2]);
    expectTypeOf(result).toBeString();
  });

  it('keyFromSelector is type-safe against resources', () => {
    // valid keys work
    keyFromSelector(($) => $.beverage);
    keyFromSelector(($) => $.coffee.bar.shot);
    keyFromSelector(($) => $.sodas.faygo.purple);

    // @ts-expect-error: invalid top-level key
    keyFromSelector(($) => $.nonExistent);

    // @ts-expect-error: invalid nested key
    keyFromSelector(($) => $.coffee.bar.nonExistent);
  });

  it('keyFromSelector with explicit ns', () => {
    keyFromSelector(($) => $.fromNs2, { ns: 'ns2' });

    // @ts-expect-error: key from wrong namespace
    keyFromSelector(($) => $.fromNs2, { ns: 'ns3' });
  });

  it('exists narrows to SelectorKey', () => {
    const key = 'beverage' as string;
    if (i18next.exists(key)) {
      expectTypeOf(key).toEqualTypeOf<string & SelectorKey>();
      // can now pass to t()
      t(key);
    }
  });
});
