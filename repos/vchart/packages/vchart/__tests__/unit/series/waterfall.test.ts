import { DataSet } from '@visactor/vdataset';
import type { ISeriesOption } from '../../../src/series/interface';
import { WaterfallSeries } from '../../../src/series/waterfall/waterfall';
import { initChartDataSet, seriesOption } from '../../util/context';
import { Direction } from '../../../src/typings/space';

describe('[Domain-Series-Waterfall] Waterfall Series', () => {
  let ctx: ISeriesOption;

  beforeEach(() => {
    const dataSet = new DataSet();
    initChartDataSet(dataSet);
    ctx = seriesOption({ dataSet });
  });

  test('leader line category positions should respect inverse axis in vertical mode', () => {
    const series = new WaterfallSeries<any>({}, ctx);
    (series as any)._direction = Direction.vertical;
    (series as any)._xAxisHelper = {
      isInverse: () => false
    };

    expect((series as any)._getLeaderLineCategoryPos(true, false)).toBe(1);
    expect((series as any)._getLeaderLineCategoryPos(false, false)).toBe(0);
    expect((series as any)._getLeaderLineCategoryPos(true, true)).toBe(0);
    expect((series as any)._getLeaderLineCategoryPos(false, true)).toBe(1);

    (series as any)._xAxisHelper = {
      isInverse: () => true
    };

    expect((series as any)._getLeaderLineCategoryPos(true, false)).toBe(0);
    expect((series as any)._getLeaderLineCategoryPos(false, false)).toBe(1);
    expect((series as any)._getLeaderLineCategoryPos(true, true)).toBe(1);
    expect((series as any)._getLeaderLineCategoryPos(false, true)).toBe(0);
  });

  test('leader line category positions should respect inverse axis in horizontal mode', () => {
    const series = new WaterfallSeries<any>({}, ctx);
    (series as any)._direction = Direction.horizontal;
    (series as any)._yAxisHelper = {
      isInverse: () => true
    };

    expect((series as any)._getLeaderLineCategoryPos(true, false)).toBe(0);
    expect((series as any)._getLeaderLineCategoryPos(false, false)).toBe(1);
  });
});
