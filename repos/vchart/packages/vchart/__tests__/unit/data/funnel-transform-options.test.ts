import { funnel, type IFunnelOpt } from '../../../src/data/transforms/funnel';
import {
  FUNNEL_CURRENT_VALUE,
  FUNNEL_HEIGHT_RATIO,
  FUNNEL_LAST_VALUE,
  FUNNEL_LAST_VALUE_RATIO,
  FUNNEL_NEXT_VALUE,
  FUNNEL_NEXT_VALUE_RATIO,
  FUNNEL_REACH_RATIO,
  FUNNEL_TRANSFORM_RATIO,
  FUNNEL_VALUE_RATIO
} from '../../../src/constant/funnel';

describe('funnel transform options', () => {
  test('resolves lazy value options on every transform run', () => {
    let valueField = 'value';
    let range = { min: 0, max: 10 };
    const options = {
      valueField: () => valueField,
      isCone: true,
      range: () => range,
      asCurrentValue: FUNNEL_CURRENT_VALUE,
      asTransformRatio: FUNNEL_TRANSFORM_RATIO,
      asReachRatio: FUNNEL_REACH_RATIO,
      asHeightRatio: FUNNEL_HEIGHT_RATIO,
      asValueRatio: FUNNEL_VALUE_RATIO,
      asNextValueRatio: FUNNEL_NEXT_VALUE_RATIO,
      asLastValueRatio: FUNNEL_LAST_VALUE_RATIO,
      asLastValue: FUNNEL_LAST_VALUE,
      asNextValue: FUNNEL_NEXT_VALUE
    };
    const data = [
      { name: 'a', value: 10, nextValue: 20 },
      { name: 'b', value: 5, nextValue: 10 }
    ];

    const first = funnel(data as unknown as Parameters<typeof funnel>[0], options as unknown as IFunnelOpt);
    expect(first[0][FUNNEL_CURRENT_VALUE]).toBe(10);
    expect(first[0][FUNNEL_VALUE_RATIO]).toBe(1);

    valueField = 'nextValue';
    range = { min: 0, max: 20 };

    const second = funnel(data as unknown as Parameters<typeof funnel>[0], options as unknown as IFunnelOpt);
    expect(second[0][FUNNEL_CURRENT_VALUE]).toBe(20);
    expect(second[0][FUNNEL_VALUE_RATIO]).toBe(1);
  });

  test('keeps single zero value as the maximum funnel level', () => {
    const options = {
      valueField: 'value',
      isCone: true,
      asCurrentValue: FUNNEL_CURRENT_VALUE,
      asTransformRatio: FUNNEL_TRANSFORM_RATIO,
      asReachRatio: FUNNEL_REACH_RATIO,
      asHeightRatio: FUNNEL_HEIGHT_RATIO,
      asValueRatio: FUNNEL_VALUE_RATIO,
      asNextValueRatio: FUNNEL_NEXT_VALUE_RATIO,
      asLastValueRatio: FUNNEL_LAST_VALUE_RATIO,
      asLastValue: FUNNEL_LAST_VALUE,
      asNextValue: FUNNEL_NEXT_VALUE
    };
    const data = [{ name: 'Step1', value: 0 }];

    const result = funnel(data as unknown as Parameters<typeof funnel>[0], options as unknown as IFunnelOpt);

    expect(result[0][FUNNEL_CURRENT_VALUE]).toBe(0);
    expect(result[0][FUNNEL_VALUE_RATIO]).toBe(1);
    expect(result[0][FUNNEL_NEXT_VALUE_RATIO]).toBe(0);
  });

  test('maps configured range to value ratio and clamps out-of-range values', () => {
    const options = {
      valueField: 'value',
      isCone: true,
      range: { min: 10, max: 20 },
      asCurrentValue: FUNNEL_CURRENT_VALUE,
      asTransformRatio: FUNNEL_TRANSFORM_RATIO,
      asReachRatio: FUNNEL_REACH_RATIO,
      asHeightRatio: FUNNEL_HEIGHT_RATIO,
      asValueRatio: FUNNEL_VALUE_RATIO,
      asNextValueRatio: FUNNEL_NEXT_VALUE_RATIO,
      asLastValueRatio: FUNNEL_LAST_VALUE_RATIO,
      asLastValue: FUNNEL_LAST_VALUE,
      asNextValue: FUNNEL_NEXT_VALUE
    };
    const data = [
      { name: 'below', value: 5 },
      { name: 'middle', value: 15 },
      { name: 'above', value: 25 }
    ];

    const result = funnel(data as unknown as Parameters<typeof funnel>[0], options as unknown as IFunnelOpt);

    expect(result[0][FUNNEL_VALUE_RATIO]).toBe(0);
    expect(result[0][FUNNEL_NEXT_VALUE_RATIO]).toBe(0.5);
    expect(result[1][FUNNEL_VALUE_RATIO]).toBe(0.5);
    expect(result[1][FUNNEL_NEXT_VALUE_RATIO]).toBe(1);
    expect(result[1][FUNNEL_LAST_VALUE_RATIO]).toBe(0);
    expect(result[2][FUNNEL_VALUE_RATIO]).toBe(1);
    expect(result[2][FUNNEL_LAST_VALUE_RATIO]).toBe(0.5);
  });

  test('uses zero as default range min for backward compatibility', () => {
    const options = {
      valueField: 'value',
      isCone: true,
      asCurrentValue: FUNNEL_CURRENT_VALUE,
      asTransformRatio: FUNNEL_TRANSFORM_RATIO,
      asReachRatio: FUNNEL_REACH_RATIO,
      asHeightRatio: FUNNEL_HEIGHT_RATIO,
      asValueRatio: FUNNEL_VALUE_RATIO,
      asNextValueRatio: FUNNEL_NEXT_VALUE_RATIO,
      asLastValueRatio: FUNNEL_LAST_VALUE_RATIO,
      asLastValue: FUNNEL_LAST_VALUE,
      asNextValue: FUNNEL_NEXT_VALUE
    };
    const data = [
      { name: 'min', value: 10 },
      { name: 'max', value: 20 }
    ];

    const result = funnel(data as unknown as Parameters<typeof funnel>[0], options as unknown as IFunnelOpt);

    expect(result[0][FUNNEL_VALUE_RATIO]).toBe(0.5);
    expect(result[1][FUNNEL_VALUE_RATIO]).toBe(1);
  });

  test('uses zero as default range min when only range max is configured', () => {
    const options = {
      valueField: 'value',
      isCone: true,
      range: { max: 40 },
      asCurrentValue: FUNNEL_CURRENT_VALUE,
      asTransformRatio: FUNNEL_TRANSFORM_RATIO,
      asReachRatio: FUNNEL_REACH_RATIO,
      asHeightRatio: FUNNEL_HEIGHT_RATIO,
      asValueRatio: FUNNEL_VALUE_RATIO,
      asNextValueRatio: FUNNEL_NEXT_VALUE_RATIO,
      asLastValueRatio: FUNNEL_LAST_VALUE_RATIO,
      asLastValue: FUNNEL_LAST_VALUE,
      asNextValue: FUNNEL_NEXT_VALUE
    };
    const data = [
      { name: 'middle', value: 20 },
      { name: 'max', value: 40 }
    ];

    const result = funnel(data as unknown as Parameters<typeof funnel>[0], options as unknown as IFunnelOpt);

    expect(result[0][FUNNEL_VALUE_RATIO]).toBe(0.5);
    expect(result[1][FUNNEL_VALUE_RATIO]).toBe(1);
  });

  test('clamps values when range min equals max', () => {
    const options = {
      valueField: 'value',
      isCone: true,
      range: { min: 10, max: 10 },
      asCurrentValue: FUNNEL_CURRENT_VALUE,
      asTransformRatio: FUNNEL_TRANSFORM_RATIO,
      asReachRatio: FUNNEL_REACH_RATIO,
      asHeightRatio: FUNNEL_HEIGHT_RATIO,
      asValueRatio: FUNNEL_VALUE_RATIO,
      asNextValueRatio: FUNNEL_NEXT_VALUE_RATIO,
      asLastValueRatio: FUNNEL_LAST_VALUE_RATIO,
      asLastValue: FUNNEL_LAST_VALUE,
      asNextValue: FUNNEL_NEXT_VALUE
    };
    const data = [
      { name: 'below', value: 5 },
      { name: 'equal', value: 10 },
      { name: 'above', value: 15 }
    ];

    const result = funnel(data as unknown as Parameters<typeof funnel>[0], options as unknown as IFunnelOpt);

    expect(result[0][FUNNEL_VALUE_RATIO]).toBe(0);
    expect(result[1][FUNNEL_VALUE_RATIO]).toBe(1);
    expect(result[2][FUNNEL_VALUE_RATIO]).toBe(1);
  });
});
