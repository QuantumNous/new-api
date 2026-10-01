import { EventDispatcher } from '../../../src/event/event-dispatcher';
import type { BarSeries } from '../../../src';
// eslint-disable-next-line no-duplicate-imports
import { HistogramChart } from '../../../src';
import { DataSet, DataView, csvParser } from '@visactor/vdataset';
import { createCanvas, removeDom } from '../../util/dom';
import { getTestCompiler } from '../../util/factory/compiler';
import { GlobalScale } from '../../../src/scale/global-scale';
import { getTheme, initChartDataSet } from '../../util/context';

// 保证引入执行 Build-in
const dataSet = new DataSet();
initChartDataSet(dataSet);
dataSet.registerParser('csv', csvParser);
const dataView = new DataView(dataSet);
const data = `x,x1,y
0,1,12`;
dataView.parse(data, {
  type: 'csv'
});
const spec = {
  data: dataView,
  type: 'histogram',
  xField: 'x',
  x2Field: 'x1',
  yField: 'y',
  // "barPadding": 20
  axes: [
    {
      orient: 'bottom',
      bandPadding: 0.4
      // type: 'linear'
    }
  ]
};

describe('histogram chart test', () => {
  let canvasDom: HTMLCanvasElement;
  beforeEach(() => {
    canvasDom = createCanvas();
    canvasDom.style.position = 'relative';
    canvasDom.style.width = '500px';
    canvasDom.style.height = '500px';
    canvasDom.width = 500;
    canvasDom.height = 500;
  });

  afterEach(() => {
    removeDom(canvasDom);
  });

  test('histogram chart init', () => {
    const transformer = new HistogramChart.transformerConstructor({
      type: 'histogram',
      seriesType: 'bar',
      getTheme: getTheme,
      mode: 'desktop-browser'
    });
    const info = transformer.initChartSpec(spec as any);
    const chart = new HistogramChart(
      spec as any,
      {
        eventDispatcher: new EventDispatcher({} as any, { addEventListener: () => {} } as any),
        globalInstance: {
          isAnimationEnable: () => true,
          getContainer: () => ({}),
          getTooltipHandlerByUser: (() => undefined) as () => undefined
        },
        dataSet,
        map: new Map(),
        container: null,
        mode: 'desktop-browser',
        getCompiler: getTestCompiler,
        globalScale: new GlobalScale([], { getAllSeries: () => [] as any[] } as any),
        getTheme: getTheme,
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
    const series: BarSeries = chart.getAllSeries()[0] as BarSeries;
    expect(series.type).toEqual('bar');
    expect(series.getSpec().animation).toBeFalsy();

    // mark
    expect(series.getMarks().length).toEqual(2);

    expect(chart.getRegionsInIndex().length).toEqual(1);
    expect(series.getRegion().id).toEqual(chart.getRegionsInIndex()[0].id);
  });
});
