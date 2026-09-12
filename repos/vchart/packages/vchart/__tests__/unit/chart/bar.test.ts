import { GlobalScale } from '../../../src/scale/global-scale';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { EventDispatcher } from '../../../src/event/event-dispatcher';
import type { BarSeries } from '../../../src';
// eslint-disable-next-line no-duplicate-imports
import { BarChart, CommonChart } from '../../../src';
import { DataSet } from '@visactor/vdataset';
import { createCanvas, removeDom } from '../../util/dom';
import { getTheme, initChartDataSet } from '../../util/context';
import { getTestCompiler } from '../../util/factory/compiler';

// 保证引入执行 Build-in
const dataSet = new DataSet();
initChartDataSet(dataSet);

const data = [
  { y: '757', x: '0', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '642', x: '1', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '635', x: '2', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '686', x: '3', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '602', x: '4', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '749', x: '5', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '859', x: '6', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '638', x: '7', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '872', x: '8', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '843', x: '9', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '636', x: '0', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '751', x: '1', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '754', x: '2', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '792', x: '3', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '657', x: '4', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '835', x: '5', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '696', x: '6', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '685', x: '7', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '893', x: '8', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '661', x: '9', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '646', x: '0', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '879', x: '1', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '680', x: '2', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '775', x: '3', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '749', x: '4', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '843', x: '5', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '691', x: '6', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '633', x: '7', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '832', x: '8', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '636', x: '9', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '669', x: '0', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '713', x: '1', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '706', x: '2', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '695', x: '3', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '855', x: '4', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '806', x: '5', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '721', x: '6', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '613', x: '7', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '748', x: '8', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '664', x: '9', y2: '0', type: 'B', type2: 'B', color: 'D' }
];
const spec = {
  data: {
    id: 'barData',
    values: data
  },
  type: 'bar',
  xField: ['x', 'type'],
  yField: 'y',
  seriesField: 'color',
  axes: [
    { orient: 'bottom', type: 'band' },
    { orient: 'left', type: 'linear' }
  ],
  animation: true
};

describe('Bar chart test', () => {
  let canvasDom: HTMLCanvasElement;
  let chart: BarChart | CommonChart;
  beforeEach(() => {
    canvasDom = createCanvas();
    canvasDom.style.position = 'relative';
    canvasDom.style.width = '500px';
    canvasDom.style.height = '500px';
    canvasDom.width = 500;
    canvasDom.height = 500;
  });

  afterEach(() => {
    chart?.release?.();
    chart = null;
    removeDom(canvasDom);
  });

  const createBarChart = (chartSpec: Record<string, unknown>) => {
    const transformer = new BarChart.transformerConstructor({
      type: 'bar',
      seriesType: 'bar',
      getTheme: getTheme,
      mode: 'desktop-browser'
    });
    const info = transformer.initChartSpec(chartSpec as never);
    const barChart = new BarChart(
      chartSpec as never,
      {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        eventDispatcher: new EventDispatcher({} as never, { addEventListener: () => {} } as never),
        globalInstance: {
          isAnimationEnable: () => true,
          getContainer: () => ({}),
          getTooltipHandlerByUser: (() => undefined) as () => undefined
        },
        render: {} as never,
        dataSet,
        map: new Map(),
        container: null,
        mode: 'desktop-browser',
        getCompiler: getTestCompiler,
        globalScale: new GlobalScale([], { getAllSeries: (): never[] => [] } as never),
        getTheme: getTheme,
        getSpecInfo: () => info
      } as never
    );
    barChart.created(transformer);
    barChart.init();
    return barChart;
  };

  const createCommonChart = (chartSpec: Record<string, unknown>) => {
    const transformer = new CommonChart.transformerConstructor({
      type: 'common',
      getTheme: getTheme,
      mode: 'desktop-browser'
    });
    const info = transformer.initChartSpec(chartSpec as never);
    const commonChart = new CommonChart(
      chartSpec as never,
      {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        eventDispatcher: new EventDispatcher({} as never, { addEventListener: () => {} } as never),
        globalInstance: {
          isAnimationEnable: () => true,
          getContainer: () => ({}),
          getTooltipHandlerByUser: (() => undefined) as () => undefined
        },
        render: {} as never,
        dataSet,
        map: new Map(),
        container: null,
        mode: 'desktop-browser',
        getCompiler: getTestCompiler,
        globalScale: new GlobalScale([], { getAllSeries: (): never[] => [] } as never),
        getTheme: getTheme,
        getSpecInfo: () => info
      } as never
    );
    commonChart.created(transformer);
    commonChart.init();
    return commonChart;
  };

  const getLinearBarWidth = (extraSpec: Record<string, unknown> = {}) => {
    const linearSpec = {
      type: 'bar',
      data: {
        values: [
          { x: 0, y: 10 },
          { x: 10, y: 20 },
          { x: 20, y: 12 }
        ]
      },
      xField: 'x',
      yField: 'y',
      axes: [
        { orient: 'bottom', type: 'linear' },
        { orient: 'left', type: 'linear' }
      ],
      ...extraSpec
    };
    chart = createBarChart(linearSpec);
    const series = chart.getAllSeries()[0] as BarSeries;
    const xScale = series.getXAxisHelper().getScale(0) as {
      domain: (domain: number[]) => void;
      range: (range: number[]) => void;
    };
    xScale.domain([0, 20]);
    xScale.range([0, 200]);

    return (
      series.getMarkInName('bar') as {
        getAttribute: (key: string, datum: unknown) => unknown;
      }
    ).getAttribute('width', series.getViewData().latestData[0]) as number;
  };

  test('Bar chart init', () => {
    chart = createBarChart(spec);

    // spec
    const transformSpec = chart.getSpec();
    expect(transformSpec.hover).toBeUndefined();
    expect(transformSpec.select).toBeUndefined();

    expect(chart.getAllSeries().length).toEqual(1);
    const series: BarSeries = chart.getAllSeries()[0] as BarSeries;
    expect(series.type).toEqual('bar');
    expect(series.getSpec().animation).toBeTruthy();

    expect(series.getStackValueField()).toBe('y');
    expect(series.getStackGroupFields()).toEqual(['x', 'type']);
    expect(series.fieldY2).toBe('__VCHART_STACK_START');
    expect(series.fieldX2).toBeUndefined();
  });

  test('Bar chart updateSpec', () => {
    chart = createBarChart(spec);
    chart.updateSpec(spec as never);

    expect(chart.getAllSeries().length).toEqual(1);
    const series: BarSeries = chart.getAllSeries()[0] as BarSeries;

    expect(series.getStackValueField()).toBe('y');
    expect(series.getStackGroupFields()).toEqual(['x', 'type']);
    expect(series.fieldY2).toBe('__VCHART_STACK_START');
    expect(series.fieldX2).toBeUndefined();
  });

  test('stackCornerRadius should build valid clip paths when barMinHeight is enabled', () => {
    const stackSpec = {
      type: 'bar',
      data: {
        values: [
          { type: 'Autocracies', year: '1930', value: 129 },
          { type: 'Autocracies', year: '1940', value: 133 },
          { type: 'Democracies', year: '1930', value: 22 },
          { type: 'Democracies', year: '1940', value: 13 },
          { type: 'Price', year: '1930', value: 1 },
          { type: 'Price', year: '1940', value: 1 }
        ]
      },
      barMaxWidth: 16,
      barGapInGroup: 2,
      barMinHeight: 2,
      stackCornerRadius: [0, 2, 2, 0],
      height: 500,
      xField: 'year',
      yField: 'value',
      seriesField: 'type'
    };
    chart = createBarChart(stackSpec);

    const series: BarSeries = chart.getAllSeries()[0] as BarSeries;
    const barMark = series.getMarkInName('bar') as unknown as {
      _markConfig: {
        clipPath: () => Array<{ attribute: { x: number; y: number; y1: number; width: number } }>;
      };
    };
    const clipPaths = barMark._markConfig.clipPath();

    expect(clipPaths.length).toBeGreaterThan(0);
    clipPaths.forEach(path => {
      expect(Number.isFinite(path.attribute.x)).toBe(true);
      expect(Number.isFinite(path.attribute.y)).toBe(true);
      expect(Number.isFinite(path.attribute.y1)).toBe(true);
      expect(Number.isFinite(path.attribute.width)).toBe(true);
    });
  });

  test('linear x axis bar uses adjacent data spacing as automatic width base', () => {
    expect(getLinearBarWidth()).toBe(50);
  });

  test('linear x axis bar respects numeric barWidth', () => {
    expect(getLinearBarWidth({ barWidth: 18 })).toBe(18);
  });

  test('linear x axis bar resolves percent barWidth from automatic width base', () => {
    expect(getLinearBarWidth({ barWidth: '25%' })).toBe(25);
  });

  test('linear x axis common chart bar series share automatic width base', () => {
    chart = createCommonChart({
      type: 'common',
      data: [
        {
          id: 'barA',
          values: [
            { x: 0, y: 10 },
            { x: 10, y: 20 }
          ]
        },
        {
          id: 'barB',
          values: [
            { x: 11, y: 12 },
            { x: 20, y: 18 }
          ]
        },
        {
          id: 'line',
          values: [
            { x: 10.2, y: 30 },
            { x: 10.3, y: 36 }
          ]
        }
      ],
      series: [
        { type: 'bar', dataId: 'barA', xField: 'x', yField: 'y' },
        { type: 'bar', dataId: 'barB', xField: 'x', yField: 'y' },
        { type: 'line', dataId: 'line', xField: 'x', yField: 'y' }
      ],
      axes: [
        { orient: 'bottom', type: 'linear' },
        { orient: 'left', type: 'linear' }
      ]
    });

    const barSeriesList = chart.getAllSeries().filter(series => series.type === 'bar') as BarSeries[];
    const xScale = barSeriesList[0].getXAxisHelper().getScale(0) as {
      domain: (domain: number[]) => void;
      range: (range: number[]) => void;
    };
    xScale.domain([0, 20]);
    xScale.range([0, 200]);

    const getWidth = (series: BarSeries) =>
      (
        series.getMarkInName('bar') as {
          getAttribute: (key: string, datum: unknown) => unknown;
        }
      ).getAttribute('width', series.getViewData().latestData[0]) as number;

    expect(getWidth(barSeriesList[0])).toBe(5);
    expect(getWidth(barSeriesList[1])).toBe(5);
  });
});
