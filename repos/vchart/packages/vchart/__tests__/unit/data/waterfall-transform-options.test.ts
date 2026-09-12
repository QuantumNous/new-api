import { STACK_FIELD_END, STACK_FIELD_START } from '../../../src/constant/data';
import { WaterfallDefaultSeriesField } from '../../../src/constant/waterfall';
import {
  waterfall,
  waterfallFillTotal,
  type IWaterfallFillEndOpt,
  type IWaterfallOpt
} from '../../../src/data/transforms/waterfall';

const seriesFieldName = {
  total: 'total',
  increase: 'increase',
  decrease: 'decrease'
};

describe('waterfall transform options', () => {
  test('resolves lazy fill-total options on every transform run', () => {
    let calculationMode: IWaterfallFillEndOpt['calculationMode'] = 'increase';
    const options = () =>
      ({
        indexField: 'x',
        valueField: 'y',
        seriesField: WaterfallDefaultSeriesField,
        total: { type: 'end', text: 'total' },
        calculationMode
      } as IWaterfallFillEndOpt);

    const firstInput = [{ x: 'A', y: 1 }];
    const first = waterfallFillTotal(firstInput, options as unknown as Parameters<typeof waterfallFillTotal>[1]);
    expect(first[first.length - 1]).toMatchObject({ x: 'total', y: 1 });
    expect(firstInput).toEqual([{ x: 'A', y: 1 }]);

    calculationMode = 'decrease';

    const secondInput = [{ x: 'A', y: 1 }];
    const second = waterfallFillTotal(secondInput, options as unknown as Parameters<typeof waterfallFillTotal>[1]);
    expect(second[0]).toMatchObject({ x: 'total', y: 1 });
    expect(secondInput).toEqual([{ x: 'A', y: 1 }]);
  });

  test('resolves lazy waterfall layout options on every transform run', () => {
    let calculationMode: IWaterfallOpt['calculationMode'] = 'increase';
    const options = () =>
      ({
        indexField: 'x',
        valueField: 'y',
        seriesField: WaterfallDefaultSeriesField,
        seriesFieldName,
        startAs: STACK_FIELD_START,
        endAs: STACK_FIELD_END,
        total: { type: 'end' },
        calculationMode,
        stackInverse: false,
        groupData: () => ({
          latestData: {
            dimensionValues: { x: new Set(['A', 'B']) },
            dimensionData: {
              A: [{ x: 'A', y: 1 }],
              B: [{ x: 'B', y: 2 }]
            }
          }
        })
      } as unknown as IWaterfallOpt);

    const first = waterfall([{}], options as unknown as Parameters<typeof waterfall>[1]);
    expect(first.map(d => d.index)).toEqual(['A', 'B']);

    calculationMode = 'decrease';

    const second = waterfall([{}], options as unknown as Parameters<typeof waterfall>[1]);
    expect(second.map(d => d.index)).toEqual(['B', 'A']);
  });
});
