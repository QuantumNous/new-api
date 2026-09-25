import { describe, it, expectTypeOf } from 'vitest';
import { getFixedT, TFunction } from 'i18next';

declare const t: TFunction;

describe('t', () => {
  it('basic selector usage', () => {
    expectTypeOf(t(($) => $.beverage)).toBeString();

    expectTypeOf(t(($) => $['beverage|beer'])).toBeString();

    expectTypeOf(t(($) => $.coffee.bar['espresso|americano'])).toBeString();

    expectTypeOf(t(($) => $.coffee.bar['espresso|cappuccino'], { count: 1 })).toBeString();

    expectTypeOf(t(($) => $.coffee.bar['espresso|cappuccino'], { count: 1 })).toBeString();

    // @ts-expect-error: plural keys have been removed
    t(($) => $.coffee.bar['espresso|cappuccino_one']);

    expectTypeOf(t(($) => $.coffee.bar['espresso|cappuccino'], { count: 1 })).toBeString();

    // @ts-expect-error: plural keys have been removed
    t(($) => $.coffee.bar['espresso|cappuccino_other']);

    expectTypeOf(t(($) => $.coffee.bar['espresso|latte'], { count: 1 })).toBeString();

    expectTypeOf(t(($) => $.coffee.bar['espresso|latte'], { count: 1 })).toBeString();

    // @ts-expect-error: plural keys have been removed
    t(($) => $.coffee.bar['espresso|latte_one']);

    // @ts-expect-error: plural keys have been removed
    t(($) => $.coffee.bar['espresso|latte_other']);

    expectTypeOf(t(($) => $.coffee.bar.shot)).toBeString();

    expectTypeOf(t(($) => $.coffee.drip.black)).toBeString();

    expectTypeOf(t(($) => $['dessert|cake'])).toBeString();

    expectTypeOf(t(($) => $['dessert|muffin'], { count: 1 })).toBeString();

    expectTypeOf(t(($) => $['dessert|muffin'], { count: 1 })).toBeString();

    // @ts-expect-error: plural keys have been removed
    t(($) => $['dessert|muffin_one']);

    // @ts-expect-error: plural keys have been removed
    t(($) => $['dessert|muffin_other']);

    expectTypeOf(t(($) => $.sodas.coca_cola.coke)).toBeString();

    expectTypeOf(t(($) => $.sodas.coca_cola['coke|diet'], { count: 1 })).toBeString();

    expectTypeOf(t(($) => $.sodas.coca_cola['coke|diet'], { count: 1 })).toBeString();

    // @ts-expect-error: plural keys have been removed
    t(($) => $.sodas.coca_cola['coke|diet_one']);

    // @ts-expect-error: plural keys have been removed
    t(($) => $.sodas.coca_cola['coke|diet_other']);

    expectTypeOf(t(($) => $.sodas.faygo.orange, { count: 1 })).toBeString();

    // @ts-expect-error: plural keys have been removed
    t(($) => $.sodas.faygo.orange_one);

    // @ts-expect-error: plural keys have been removed
    t(($) => $.sodas.faygo.orange_other);

    expectTypeOf(t(($) => $.sodas.faygo.purple)).toBeString();

    expectTypeOf(t(($) => $.tea, { count: 1 })).toBeString();

    expectTypeOf(t(($) => $.tea, { count: 1 })).toBeString();

    // @ts-expect-error: plural keys are removed
    t(($) => $.tea_other);
  });

  it('selector works with context', () => {
    expectTypeOf(t(($) => $.dessert, { context: 'cake' })).toBeString();

    expectTypeOf(t(($) => $.dessert, { context: 'muffin', count: 2 })).toBeString();

    expectTypeOf(t(($) => $.coffee.bar.espresso, { context: 'cappuccino', count: 2 })).toBeString();

    expectTypeOf(t(($) => $.coffee.bar.espresso, { context: 'latte', count: 3 })).toBeString();

    expectTypeOf(t(($) => $.sodas.coca_cola.coke, { context: 'diet', count: 1 })).toBeString();
  });

  it('getFixedT', () => {
    const fixedT = getFixedT(null, 'ns1', 'coffee');

    expectTypeOf(fixedT(($) => $.bar.shot)).toBeString();
  });

  it('namespace: single', () => {
    expectTypeOf(t(($) => $.fromNs2, { ns: 'ns2' })).toBeString();
  });

  it('namespace: multiple', () => {
    expectTypeOf(t(($) => $.fromNs2, { ns: ['ns2', 'ns3'] })).toBeString();
    expectTypeOf(t(($) => $.fromNs3, { ns: ['ns3', 'ns2'] })).toBeString();
  });

  it('returnObjects', () => {
    expectTypeOf(t(($) => $.sodas.faygo, { returnObjects: true })).toEqualTypeOf<{
      purple: string;
      orange: string;
    }>();
  });

  it('defaultValue', () => {
    expectTypeOf(t(($) => $.beverage, { defaultValue: 'defaultValue' })).toBeString();

    expectTypeOf(t(($) => $['beverage|beer'], { defaultValue: 'defaultValue' })).toBeString();
  });

  it('returnObjects + defaultValue', () => {
    expectTypeOf(
      t(($) => $.coffee.bar, { returnObjects: true, defaultValue: 'defaultValue' }),
    ).toEqualTypeOf<
      | 'defaultValue'
      | {
          shot: string;
          'espresso|americano': string;
          'espresso|latte': string;
          'espresso|cappuccino': string;
        }
    >();
  });

  it('defaultValue + context', () => {
    expectTypeOf(
      t(($) => $.beverage, { context: 'beer', defaultValue: 'defaultValue' }),
    ).toBeString();
  });

  it('returnObjects + defaultValue + context', () => {
    expectTypeOf(
      t(($) => $.beverage, { returnObjects: true, defaultValue: 'defaultValue', context: 'beer' }),
    ).toBeString();
  });

  it('supports interpolation', () => {
    expectTypeOf(t(($) => $.interpolation.val, { val: '' })).toBeString();
  });
});
