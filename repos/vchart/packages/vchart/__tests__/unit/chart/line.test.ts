import type { ILineChartSpec } from '../../../src/chart/line/interface';
import { GlobalScale } from '../../../src/scale/global-scale';
import type { LineSeries } from '../../../src/series/line/line';
import { DataSet, DataView, csvParser } from '@visactor/vdataset';
import { LineChart, registerLineChart } from '../../../src/chart/line/line';
import { EventDispatcher } from '../../../src/event/event-dispatcher';
import { getTestCompiler } from '../../util/factory/compiler';
import { getTheme, initChartDataSet } from '../../util/context';

registerLineChart();
const dataSet = new DataSet();
initChartDataSet(dataSet);
dataSet.registerParser('csv', csvParser);
const dataView = new DataView(dataSet);
const data = `x,type,y
1,1,850
2,2,740
3,3,900
4,4,570
5,5,670`;
dataView.parse(data, {
  type: 'csv'
});
const spec = {
  type: 'line',
  data: dataView,
  xField: 'x',
  yField: 'y',
  animation: false
};

describe('line chart test', () => {
  test('line chart init', () => {
    const transformer = new LineChart.transformerConstructor({
      type: 'line',
      seriesType: 'line',
      getTheme: getTheme,
      mode: 'desktop-browser'
    });
    const info = transformer.initChartSpec(spec as any);
    const chart = new LineChart(
      spec as any,
      {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        eventDispatcher: new EventDispatcher({} as any, { addEventListener: () => {} } as any),
        globalInstance: {
          isAnimationEnable: () => true,
          getContainer: () => ({}),
          getTooltipHandlerByUser: (() => undefined) as () => undefined
        },
        render: {} as any,
        dataSet,
        map: new Map(),
        container: null,
        mode: 'desktop-browser',
        getCompiler: getTestCompiler,
        globalScale: new GlobalScale([], { getAllSeries: () => [] as any[] } as any),
        getTheme: getTheme,
        onError: () => {},
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
    const series: LineSeries = chart.getAllSeries()[0] as LineSeries;
    expect(series.type).toEqual('line');
    expect(series.fieldX).toEqual(['x']);
    expect(series.fieldY).toEqual(['y']);
    expect(series.getSpec().animation).toBeFalsy();

    // mark
    expect(series.getMarks().length).toEqual(3);

    // const mark = series.getMarks()[0];
    // scale.range在layout之后设置，所以这里的range为默认的[0,1]
    //TODO: 开发过程中这里会经常发生变动，稳定后再放出来
    // expect(mark.getAttribute('x', { x: '1' }, 'normal')).toEqual(
    //   0.11538461538461547
    // );
    // expect(mark.getAttribute('y', { y: 100 }, 'normal')).toEqual(
    //   0.18803418803418803
    // );

    expect(chart.getRegionsInIndex().length).toEqual(1);
    expect(series.getRegion().id).toEqual(chart.getRegionsInIndex()[0].id);
  });

  test('line chart init in mode which is `mobile-browser`', () => {
    const spec = {
      type: 'line',
      data: dataView,
      xField: 'x',
      yField: 'y',
      select: false
    } as ILineChartSpec;
    const transformer = new LineChart.transformerConstructor({
      type: 'line',
      seriesType: 'line',
      getTheme: getTheme,
      mode: 'desktop-browser'
    });
    const info = transformer.initChartSpec(spec as any);
    const chart = new LineChart(spec, {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      eventDispatcher: new EventDispatcher({} as any, { addEventListener: () => {} } as any),
      globalInstance: {
        isAnimationEnable: () => true,
        getContainer: () => ({}),
        getTooltipHandlerByUser: (() => undefined) as () => undefined
      },
      render: {} as any,
      dataSet,
      map: new Map(),
      container: null,
      mode: 'mobile-browser',
      getCompiler: getTestCompiler,
      globalScale: new GlobalScale([], { getAllSeries: () => [] as any[] } as any),
      getTheme: getTheme,
      getSpecInfo: () => info
    } as any);
    chart.created(transformer);
    chart.init();

    // spec
    const transformSpec = chart.getSpec();
    expect(transformSpec.hover).toBeUndefined();
    expect(transformSpec.select).toBe(false);

    expect(chart.getAllSeries().length).toEqual(1);
  });
});
