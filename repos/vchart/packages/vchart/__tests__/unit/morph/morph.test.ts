import VChart, { BarChart, CommonChart, type ISpec } from '../../../src';
import { DataSet, DataView, csvParser } from '@visactor/vdataset';
import { EventDispatcher } from '../../../src/event/event-dispatcher';
import { createCanvas, removeDom } from '../../util/dom';
import { getTestCompiler } from '../../util/factory/compiler';
import { GlobalScale } from '../../../src/scale/global-scale';
import { getTheme, initChartDataSet } from '../../util/context';
import { BaseMark } from '../../../src/mark/base/base-mark';

const dataSet = new DataSet();
initChartDataSet(dataSet);
dataSet.registerParser('csv', csvParser);

const data = [
  {
    name: '广东',
    value: 21197
  },
  {
    name: '江苏',
    value: 20383
  }
];

type DataType = { name: string; value: number; ratio: string; type?: string };

const scatterData = ['A', 'B', 'C'].reduce((acc: any[], cur: string) => {
  const seriesData = data.map(d => {
    return { name: d.name, value: d.value + ~~(Math.random() * 10000 - 5000), type: cur };
  });
  return [...acc, ...seriesData];
}, []) as DataType[];

const barData = scatterData.reduce((acc: any[], cur: DataType) => {
  const oneData = acc.find(d => d.name === cur.name) as DataType;
  if (oneData) {
    oneData.value += cur.value;
  } else {
    acc.push(cur);
  }
  return acc;
}, []);

const scatterSpec = {
  type: 'common',
  series: [
    {
      type: 'scatter',
      data: { values: scatterData },
      xField: 'name',
      yField: 'value',
      seriesField: 'type'
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', label: { visible: true }, type: 'band' }]
};

const multiScatterSeriesSpec = {
  type: 'common',
  series: [
    {
      type: 'scatter',
      data: scatterData.filter(d => d.type === 'A'),
      xField: 'sex',
      yField: 'height',
      morph: {
        enable: false,
        morphKey: 'A'
      }
    },
    {
      type: 'scatter',
      data: scatterData.filter(d => d.type === 'B'),
      xField: 'sex',
      yField: 'height',
      morph: {
        morphKey: 'B'
      }
    },
    {
      type: 'scatter',
      data: scatterData.filter(d => d.type === 'C'),
      xField: 'sex',
      yField: 'height',
      morph: {
        morphElementKey: 'ratio'
      }
    }
  ]
};

const barSpec = {
  type: 'bar',
  data: new DataView(dataSet).parse(barData),
  xField: 'name',
  yField: 'value'
};

const createMorphUpdateLineSpec = (): ISpec => ({
  type: 'line',
  data: [
    {
      id: 'data',
      values: [
        { x: 'A', y: 1 },
        { x: 'B', y: 2 }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  point: {
    visible: true
  }
});

const createMorphUpdateBarSpec = (): ISpec => ({
  type: 'bar',
  data: [
    {
      id: 'data',
      values: [
        { x: 'A', y: 1 },
        { x: 'B', y: 2 }
      ]
    }
  ],
  xField: 'x',
  yField: 'y'
});

describe('Bar chart test', () => {
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

  test('default morph', () => {
    const transformer = new CommonChart.transformerConstructor({
      type: 'common',
      getTheme: getTheme,
      mode: 'desktop-browser'
    });
    const info = transformer.initChartSpec(scatterSpec as any);
    const scatterChart = new CommonChart(
      scatterSpec as any,
      {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
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
        animation: true,
        onError: () => {},
        getTheme: getTheme,
        getSpecInfo: () => info
      } as any
    );
    scatterChart.created(transformer);
    scatterChart.init();

    const barTransformer = new BarChart.transformerConstructor({
      type: 'bar',
      seriesType: 'bar',
      getTheme: getTheme,
      mode: 'desktop-browser'
    });
    const barInfo = barTransformer.initChartSpec(barSpec as any);
    const barChart = new BarChart(
      barSpec as any,
      {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
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
        animation: true,
        onError: () => {},
        getTheme: getTheme,
        getSpecInfo: () => barInfo
      } as any
    );
    barChart.created(barTransformer);
    barChart.init();

    const barSeries = barChart.getAllSeries()[0];
    const scatterSeries = scatterChart.getAllSeries()[0];

    expect(barSeries.getMarksInType('rect')[0].getMarkConfig().morphKey).toEqual(
      scatterSeries.getMarksInType('symbol')[0].getMarkConfig().morphKey
    );

    expect(barSeries.getMarksInType('rect')[0].getMarkConfig().morphElementKey).toBe('name');
    expect(barSeries.getMarksInType('rect')[0].getMarkConfig().morphElementKey).toEqual(
      scatterSeries.getMarksInType('symbol')[0].getMarkConfig().morphElementKey
    );
  });

  test('custom morph config', () => {
    const transformer = new CommonChart.transformerConstructor({
      type: 'common',
      getTheme: getTheme,
      mode: 'desktop-browser'
    });
    const info = transformer.initChartSpec(multiScatterSeriesSpec as any);
    const scatterChart = new CommonChart(
      multiScatterSeriesSpec as any,
      {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
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
        animation: true,
        onError: () => {},
        getTheme: getTheme,
        getSpecInfo: () => info
      } as any
    );
    scatterChart.created(transformer);
    scatterChart.init();

    const ASeries = scatterChart.getAllSeries()[0];
    const BSeries = scatterChart.getAllSeries()[1];
    const CSeries = scatterChart.getAllSeries()[2];

    // vchart morph config
    expect(ASeries.getMarksInType('symbol')[0].getMarkConfig().morph).toBe(false);
    expect(BSeries.getMarksInType('symbol')[0].getMarkConfig().morph).toBe(true);
    expect(CSeries.getMarksInType('symbol')[0].getMarkConfig().morph).toBe(true);
    expect(ASeries.getMarksInType('symbol')[0].getMarkConfig().morphKey).toBe('A');
    expect(BSeries.getMarksInType('symbol')[0].getMarkConfig().morphKey).toBe('B');
    expect(CSeries.getMarksInType('symbol')[0].getMarkConfig().morphKey).toBe('2_2');
    expect(ASeries.getMarksInType('symbol')[0].getMarkConfig().morphElementKey).toBe('sex');
    expect(BSeries.getMarksInType('symbol')[0].getMarkConfig().morphElementKey).toBe('sex');
    expect(CSeries.getMarksInType('symbol')[0].getMarkConfig().morphElementKey).toBe('ratio');
  });

  test('updateSpec remake keeps previous marks for morph and clears unused cached marks', () => {
    const originalPrepareMorph = BaseMark.prototype.prepareMorph;
    const originalRemoveProduct = BaseMark.prototype.removeProduct;
    const prepareMorphCalls: Array<{ target: string; source: string }> = [];
    const removeProductCalls: Array<{ name: string; args: unknown[] }> = [];
    const prepareMorphSpy = jest
      .spyOn(BaseMark.prototype, 'prepareMorph')
      .mockImplementation(function (this: BaseMark<any>, mark) {
        prepareMorphCalls.push({ target: this.name, source: mark.name });
        return originalPrepareMorph.call(this, mark);
      });
    const removeProductSpy = jest
      .spyOn(BaseMark.prototype, 'removeProduct')
      .mockImplementation(function (this: BaseMark<any>, ...args: unknown[]) {
        removeProductCalls.push({ name: this.name, args });
        return originalRemoveProduct.apply(this, args as any);
      });
    const chart = new VChart(createMorphUpdateLineSpec(), { dom: canvasDom, animation: true });

    try {
      chart.renderSync();
      prepareMorphCalls.length = 0;
      removeProductCalls.length = 0;

      chart.updateSpecSync(createMorphUpdateBarSpec());

      expect(prepareMorphCalls).toContainEqual({ target: 'bar', source: 'point' });
      expect(removeProductCalls).toContainEqual({ name: 'line', args: [] });
    } finally {
      chart.release();
      prepareMorphSpy.mockRestore();
      removeProductSpy.mockRestore();
    }
  });
});
