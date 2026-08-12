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
});
