import { DataSet, DataView, csvParser } from '@visactor/vdataset';
import { RangeColumnChart } from '../../../src';
import type { RangeColumnSeries } from '../../../src/series/range-column/range-column';
import { EventDispatcher } from '../../../src/event/event-dispatcher';
import { getTestCompiler } from '../../util/factory/compiler';
import { GlobalScale } from '../../../src/scale/global-scale';
import { getTheme, initChartDataSet } from '../../util/context';

// 保证引入执行 Build-in
const dataSet = new DataSet();
initChartDataSet(dataSet);
dataSet.registerParser('csv', csvParser);
const dataView = new DataView(dataSet);
const data = `type,min,max
'分类一', 76, 100
'分类二', 56, 108
'分类三', 38, 129
'分类四', 58, 155
'分类五', 45, 120
'分类六', 23, 99
'分类七', 18, 56
'分类八', 18, 34`;
dataView.parse(data, {
  type: 'csv'
});

const spec = {
  type: 'rangeColumn',
  data: dataView,
  xField: 'type',
  minField: 'min',
  maxField: 'max',
  axes: [
    { orient: 'bottom', type: 'band' },
    {
      orient: 'left',
      label: {
        visible: true
      },
      type: 'linear'
    }
  ],
  label: {
    visible: true,
    position: 'bothEnd'
  }
};

describe('rangeColumn chart test', () => {
  test('rangeColumn chart init', () => {
    const transformer = new RangeColumnChart.transformerConstructor({
      type: 'rangeColumn',
      seriesType: 'rangeColumn',
      getTheme: getTheme,
      mode: 'desktop-browser'
    });
    const info = transformer.initChartSpec(spec as any);
    const chart = new RangeColumnChart(
      spec as any,
      {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        eventDispatcher: new EventDispatcher({}, { addEventListener: () => {} }),
        globalInstance: {
          isAnimationEnable: () => true,
          getContainer: () => ({}),
          getTooltipHandlerByUser: (() => undefined) as () => undefined
        },
        // render: {},
        dataSet,
        map: new Map(),
        container: null,
        mode: 'desktop-browser',
        getCompiler: getTestCompiler,
        globalScale: new GlobalScale([], { getAllSeries: () => [] as any[] } as any),
        getTheme: getTheme,
        animation: false,
        getSpecInfo: () => info
      } as any
    );
    chart.created(transformer);
    chart.init();

    // spec
    const transformSpec = chart.getSpec();
    expect(transformSpec.hover).toBeUndefined();
    expect(transformSpec.select).toBeUndefined();

    expect(chart.getAllSeries().length).toEqual(1);
    const series: RangeColumnSeries = chart.getAllSeries()[0] as RangeColumnSeries;
    expect(series.type).toEqual('rangeColumn');
    expect(series.fieldX).toEqual(['type']);
    expect(series.fieldY).toEqual(['min', 'max']);
    expect(series.getSpec().animation).toBeFalsy();

    // mark
    expect(series.getMarks().length).toEqual(4);

    const bar = series.getMarks()[1];
    expect(bar.type).toEqual('rect');
    expect(bar.name).toEqual('bar');
    expect(chart.getRegionsInIndex().length).toEqual(1);

    const minLabel = series.getMarks()[2];
    expect(minLabel.type).toEqual('text');
    expect(minLabel.name).toEqual('minLabel');

    const maxLabel = series.getMarks()[3];
    expect(maxLabel.type).toEqual('text');
    expect(maxLabel.name).toEqual('maxLabel');
    expect(series.getRegion().id).toEqual(chart.getRegionsInIndex()[0].id);
  });
});
