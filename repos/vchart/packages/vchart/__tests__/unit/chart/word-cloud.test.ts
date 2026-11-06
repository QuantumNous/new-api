import { GlobalScale } from '../../../src/scale/global-scale';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { EventDispatcher } from '../../../src/event/event-dispatcher';
import type { IWordCloudChartSpec } from '../../../src';
// eslint-disable-next-line no-duplicate-imports
import { default as VChart } from '../../../src';
import { DataSet, csvParser } from '@visactor/vdataset';
import { WordCloudChart } from '../../../src/chart/word-cloud/word-cloud';
import type { WordCloudSeries } from '../../../src/series/word-cloud/word-cloud';
import { dataWordCloud } from '../../data/data-wordcloud';
import { createCanvas, removeDom } from '../../util/dom';
import { getTestCompiler } from '../../util/factory/compiler';
import { getTheme, initChartDataSet } from '../../util/context';

// 保证引入执行 Build-in
const dataSet = new DataSet();
initChartDataSet(dataSet);
dataSet.registerParser('csv', csvParser);

const spec: IWordCloudChartSpec = {
  type: 'wordCloud',
  width: 320,
  height: 400,
  data: [
    {
      name: 'data',
      values: dataWordCloud
    }
  ],
  nameField: 'challenge_name',
  valueField: 'sum_count',
  seriesField: 'challenge_name',
  maskShape: 'circle',
  wordCloudConfig: {
    drawOutOfBound: 'clip',
    zoomToFit: {
      shrink: true,
      enlarge: true,
      fontSizeLimitMin: 2
    }
  },
  random: false
};

describe('wordCloud chart test', () => {
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

  test('wordCloud chart init', () => {
    const transformer = new WordCloudChart.transformerConstructor({
      type: 'wordCloud',
      seriesType: 'wordCloud',
      getTheme: getTheme,
      mode: 'desktop-browser'
    });
    const info = transformer.initChartSpec(spec);
    const chart = new WordCloudChart(spec, {
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
      getSpecInfo: () => info
    } as any);
    chart.created(transformer);
    chart.init();

    // spec
    const transformSpec = chart.getSpec();
    expect(transformSpec.hover).toBeUndefined();
    expect(transformSpec.select).toBeUndefined();

    expect(chart.getAllSeries().length).toEqual(1);
    const series: WordCloudSeries = chart.getAllSeries()[0] as WordCloudSeries;
    expect(series.type).toEqual('wordCloud');
    expect(series.getSpec().animation).toBeFalsy();

    // mark
    expect(series.getMarks().length).toEqual(2);

    expect(chart.getRegionsInIndex().length).toEqual(1);
    expect(series.getRegion().id).toEqual(chart.getRegionsInIndex()[0].id);
  });

  test('wordCloud compiler', async () => {
    const cs = new VChart(spec, {
      mode: 'desktop-browser',
      renderCanvas: canvasDom,
      animation: false
    });
    await cs.renderAsync();
    const series: WordCloudSeries = cs.getChart().getAllSeries()[0] as WordCloudSeries;
    const dataResult = series.getViewData().latestData;
    expect(dataResult.length).toBe(2517); // 单词总数
    // 绘制单词数量和属性有随机性
    // expect(dataResult.filter(d => d.x && d.y).length).toBe(33); // 实际绘制单词总数
    // expect(dataResult[1].x).toBe(173);
    // expect(dataResult[1].y).toBe(238);
    // expect(dataResult[1].fontFamily).toBe('sans-serif');
    expect(dataResult[1].fontSize).toBe(37);
    expect(dataResult[1].fontStyle).toBe('normal');
    expect(dataResult[1].fontWeight).toBeCloseTo(440.94488188976374);
    expect(dataResult[1].angle).toBe(0);
  });

  test('wordCloud updateSpec', async () => {
    const spec1 = {
      type: 'wordCloud',
      nameField: 'name',
      valueField: 'value',
      data: {
        name: '1',
        values: [
          {
            name: '螺蛳粉',
            value: 957
          },
          {
            name: '钵钵鸡',
            value: 942
          },
          {
            name: '板栗',
            value: 842
          },
          {
            name: '胡辣汤',
            value: 828
          },
          {
            name: '关东煮',
            value: 665
          },
          {
            name: '羊肉汤',
            value: 627
          },
          {
            name: '热干面',
            value: 574
          }
        ]
      },
      word: {
        style: {}
      }
    };
    const cs = new VChart(
      {
        ...spec,
        word: {
          style: {
            fill: 'red'
          }
        }
      },
      {
        mode: 'desktop-browser',
        renderCanvas: canvasDom,
        animation: false
      }
    );
    await cs.renderAsync();
    await cs.updateSpec(spec1 as any);
    const series: WordCloudSeries = cs.getChart().getAllSeries()[0] as WordCloudSeries;
    const dataResult = series.getViewData().latestData;
    expect(dataResult.length).toBe(7); // 单词总数
    // 绘制单词数量和属性有随机性
    // expect(dataResult.filter(d => d.x && d.y).length).toBe(33); // 实际绘制单词总数
    // expect(dataResult[1].x).toBe(173);
    // expect(dataResult[1].y).toBe(238);
    // expect(dataResult[1].fontFamily).toBe('sans-serif');
    expect(dataResult[1].fontSize).toBe(39);
    expect(dataResult[1].fontStyle).toBe('normal');
    expect(dataResult[1].fontWeight).toBeCloseTo(488.2506527415144);
    expect(dataResult[1].angle).toBe(0);

    const marks = series.getMarks();
    const wordMark = marks[1];
    expect(wordMark.getGraphics()[0].attribute.fill).toBe('#1664FF');
  });
});
