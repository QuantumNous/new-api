import { SankeySeriesTooltipHelper } from '../../../src/series/sankey/tooltip-helper';

const createMockSeries = () =>
  ({
    id: 'sankey-series',
    type: 'sankey',
    getSpec: () => ({
      categoryField: 'nodeName'
    }),
    getSeriesField: () => 'nodeName',
    getSeriesKeys: () => ["Agricultural 'waste'", 'Bio-conversion', 'CCCCC', 'DDD'],
    getDimensionField: () => ['nodeName'],
    getMeasureField: () => ['value'],
    getSeriesStyle:
      (): any =>
      (_: string): any =>
        undefined,
    getDefaultShapeType: () => 'square'
  } as any);

describe('[Series-Sankey] tooltip helper', () => {
  test('should resolve link title when source is 0', () => {
    const helper = new SankeySeriesTooltipHelper(createMockSeries());

    expect(
      helper.dimensionTooltipTitleCallback({
        source: 0,
        target: 2,
        value: 124.729,
        datum: {
          source: 0,
          target: 2,
          value: 124.729
        }
      } as any)
    ).toBe("Agricultural 'waste' => CCCCC");
  });
});
