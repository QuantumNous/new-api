import type { ISymbolMarkSpec } from '../../../src/typings/visual';
import { merge } from '@visactor/vutils';
import { CommonChart } from '../../../src/chart/common/common';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { EventDispatcher } from '../../../src/event/event-dispatcher';
import { VChart, type ScatterSeries } from '../../../src';
// eslint-disable-next-line no-duplicate-imports
import { DataSet, dataViewParser, DataView } from '@visactor/vdataset';
import { createCanvas, removeDom } from '../../util/dom';
import type { IAttrs, VisualScaleType } from '../../../src/mark/interface';
import { dimensionStatistics } from '../../../src/data/transforms/dimension-statistics';
import { getTestCompiler } from '../../util/factory/compiler';
import { getTheme } from '../../util/context';

const VChartClass = VChart; // 确保引用 vchart 以确保注册所需的图表
// 保证引入执行 Build-in
let dataSet: DataSet;
const data = [
  {
    id: 'data0',
    values: [
      {
        x: 1270911,
        size: 219815,
        y: 5590,
        type: '办公用品',
        area: '中南'
      },
      {
        x: 919743,
        size: 148800,
        y: 1199,
        type: '家具',
        area: '华北'
      },
      {
        x: 1676224,
        size: 163453,
        y: 2517,
        type: '家具',
        area: '华东'
      },
      {
        x: 824673,
        size: 86067,
        y: 3622,
        type: '办公用品',
        area: '东北'
      },
      {
        x: 745813,
        size: 137265,
        y: 3020,
        type: '办公用品',
        area: '华北'
      },
      {
        x: 267870,
        size: 49633,
        y: 970,
        type: '办公用品',
        area: '西北'
      },
      {
        x: 1408628,
        size: 215585,
        y: 6341,
        type: '办公用品',
        area: '华东'
      },
      {
        x: 501533,
        size: 29303,
        y: 814,
        type: '家具',
        area: '西南'
      },
      {
        x: 920698,
        size: 72692,
        y: 1470,
        type: '家具',
        area: '东北'
      },
      {
        x: 316212,
        size: 24903,
        y: 468,
        type: '家具',
        area: '西北'
      },
      {
        x: 1399928,
        size: 199582,
        y: 2023,
        type: '家具',
        area: '中南'
      },
      {
        x: 347692,
        size: 49272,
        y: 1858,
        type: '办公用品',
        area: '西南'
      }
    ]
  },
  {
    id: 'data1',
    values: [
      {
        x: 936196,
        size: 83431,
        y: 1371,
        type: '技术',
        area: '东北'
      },
      {
        x: 453898,
        size: 19061,
        y: 727,
        type: '技术',
        area: '西南'
      },
      {
        x: 1466575,
        size: 251487,
        y: 2087,
        type: '技术',
        area: '中南'
      },
      {
        x: 230956,
        size: 24016,
        y: 347,
        type: '技术',
        area: '西北'
      },
      {
        x: 1599653,
        size: 228179,
        y: 2183,
        type: '技术',
        area: '华东'
      },
      {
        x: 781743,
        size: 144986,
        y: 927,
        type: '技术',
        area: '华北'
      }
    ]
  }
];

// 图表配置
const commonSpec = {
  type: 'common',
  axes: [
    { orient: 'left', range: { min: 0 }, type: 'linear' },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ]
};

const baseSeries = {
  type: 'scatter',
  xField: 'x',
  yField: 'y',
  seriesField: 'type'
};

describe('global-scale test', () => {
  let canvasDom: HTMLCanvasElement;
  let chart: CommonChart;
  beforeEach(() => {
    dataSet = new DataSet();
    dataSet.registerParser('dataview', dataViewParser);
    dataSet.registerTransform('dimensionStatistics', dimensionStatistics);
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

  test('global-scale base', () => {
    const scalesSpec = [
      {
        id: 'size',
        type: 'linear',
        domain: [
          {
            dataId: 'data0',
            fields: ['size']
          },
          {
            dataId: 'data1',
            fields: ['size']
          }
        ],
        range: [10, 25]
      },
      {
        id: 'color',
        type: 'linear',
        domain: [
          {
            dataId: 'data0',
            fields: ['y']
          },
          {
            dataId: 'data1',
            fields: ['y']
          }
        ],
        range: ['red', 'blue']
      },
      {
        id: 'shape',
        type: 'ordinal',
        domain: [
          {
            dataId: 'data0',
            fields: ['area']
          },
          {
            dataId: 'data1',
            fields: ['area']
          }
        ],
        range: ['star', 'triangleLeft', 'diamond']
      }
    ];
    const seriesSpec = [
      merge({}, baseSeries, {
        data: {
          id: 'data0'
        },
        point: {
          style: {
            fill: {
              scale: 'color',
              field: 'y'
            },
            size: {
              field: 'size',
              scale: 'size'
            },
            shape: {
              scale: 'shape',
              field: 'area'
            }
          }
        }
      }),
      merge({}, baseSeries, {
        data: {
          id: 'data1'
        },
        point: {
          style: {
            fill: {
              scale: 'color',
              field: 'y'
            },
            size: {
              field: 'size',
              scale: 'size'
            },
            shape: {
              scale: 'shape',
              field: 'area'
            }
          }
        }
      })
    ];
    const spec = merge({}, commonSpec, {
      series: seriesSpec,
      scales: scalesSpec,
      data: data.map(d => {
        return new DataView(dataSet, { name: d.id }).parse(d.values);
      })
    });
    const transformer = new CommonChart.transformerConstructor({
      type: 'common',
      getTheme: getTheme,
      mode: 'desktop-browser'
    });
    const info = transformer.initChartSpec(spec);
    chart = new CommonChart(
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
        getSpecInfo: () => info,
        getCompiler: getTestCompiler,
        getTheme: getTheme
      } as any
    );
    chart.created(transformer);
    chart.init();

    // spec
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const globalScale = chart._globalScale;

    expect(globalScale.getScale('color')?.type).toEqual('linear');
    expect(globalScale.getScale('color')?.range()).toEqual(['red', 'blue']);
    expect(globalScale.getScale('color')?.domain()).toEqual([347, 6341]);

    expect(globalScale.getScale('size')?.type).toEqual('linear');
    expect(globalScale.getScale('size')?.range()).toEqual([10, 25]);
    expect(globalScale.getScale('size')?.domain()).toEqual([19061, 251487]);

    expect(globalScale.getScale('shape')?.type).toEqual('ordinal');
    expect(globalScale.getScale('shape')?.range()).toEqual(['star', 'triangleLeft', 'diamond']);
    expect(globalScale.getScale('shape')?.domain()).toEqual(['中南', '华北', '华东', '东北', '西北', '西南']);

    const series: ScatterSeries = chart.getAllSeries()[0] as ScatterSeries;
    const markStyle = series.getMarkInName('point')?.stateStyle.normal as IAttrs<ISymbolMarkSpec>;
    expect((markStyle.fill?.style as VisualScaleType)?.scale === globalScale.getScale('color')).toEqual(true);
    expect((markStyle.size?.style as VisualScaleType)?.scale === globalScale.getScale('size')).toEqual(true);
    expect((markStyle.shape?.style as VisualScaleType)?.scale === globalScale.getScale('shape')).toEqual(true);
  });

  test('global-scale mark attribute changeDomain', () => {
    const scalesSpec = [
      {
        id: 'size',
        type: 'linear',
        domain: [
          {
            dataId: 'data0',
            fields: ['size']
          }
        ],
        range: [10, 25]
      },
      {
        id: 'color',
        type: 'linear',
        domain: [
          {
            dataId: 'data0',
            fields: ['y']
          },
          {
            dataId: 'data1',
            fields: ['y']
          }
        ],
        range: ['red', 'blue']
      },
      {
        id: 'shape',
        type: 'ordinal',
        domain: [
          {
            dataId: 'data0',
            fields: ['area']
          },
          {
            dataId: 'data1',
            fields: ['area']
          }
        ],
        range: ['star', 'triangleLeft', 'diamond']
      }
    ];
    const seriesSpec = [
      merge({}, baseSeries, {
        data: {
          id: 'data0'
        },
        point: {
          style: {
            fill: {
              scale: 'color',
              field: 'y'
            },
            size: {
              field: 'size',
              scale: 'size'
            },
            shape: {
              scale: 'shape',
              field: 'area'
            }
          }
        }
      }),
      merge({}, baseSeries, {
        data: {
          id: 'data1'
        },
        point: {
          style: {
            fill: {
              scale: 'color',
              field: 'y',
              changeDomain: 'replace'
            },
            size: {
              field: 'size',
              scale: 'size',
              changeDomain: 'expand'
            },
            shape: {
              scale: 'shape',
              field: 'area'
            }
          }
        }
      })
    ];
    const spec = merge({}, commonSpec, {
      series: seriesSpec,
      scales: scalesSpec,
      data: data.map(d => {
        return new DataView(dataSet, { name: d.id }).parse(d.values);
      })
    });
    const transformer = new CommonChart.transformerConstructor({
      type: 'common',
      getTheme: getTheme,
      mode: 'desktop-browser'
    });
    const info = transformer.initChartSpec(spec);
    chart = new CommonChart(
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
        getSpecInfo: () => info,
        getCompiler: getTestCompiler,
        getTheme: getTheme
      } as any
    );
    chart.created(transformer);
    chart.init();

    // spec
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const globalScale = chart._globalScale;

    expect(globalScale.getScale('color')?.type).toEqual('linear');
    expect(globalScale.getScale('color')?.range()).toEqual(['red', 'blue']);
    expect(globalScale.getScale('color')?.domain()).toEqual([347, 6341]);

    expect(globalScale.getScale('size')?.type).toEqual('linear');
    expect(globalScale.getScale('size')?.range()).toEqual([10, 25]);
    expect(globalScale.getScale('size')?.domain()).toEqual([24903, 219815]);

    expect(globalScale.getScale('shape')?.type).toEqual('ordinal');
    expect(globalScale.getScale('shape')?.range()).toEqual(['star', 'triangleLeft', 'diamond']);
    expect(globalScale.getScale('shape')?.domain()).toEqual(['中南', '华北', '华东', '东北', '西北', '西南']);

    const series0: ScatterSeries = chart.getAllSeries()[0] as ScatterSeries;
    const markStyle0 = series0.getMarkInName('point')?.stateStyle.normal as IAttrs<ISymbolMarkSpec>;
    expect((markStyle0.fill?.style as VisualScaleType)?.scale === globalScale.getScale('color')).toEqual(true);
    expect((markStyle0.size?.style as VisualScaleType)?.scale === globalScale.getScale('size')).toEqual(true);
    expect((markStyle0.shape?.style as VisualScaleType)?.scale === globalScale.getScale('shape')).toEqual(true);

    const series1: ScatterSeries = chart.getAllSeries()[1] as ScatterSeries;
    const markStyle1 = series1.getMarkInName('point')?.stateStyle.normal as IAttrs<ISymbolMarkSpec>;
    expect((markStyle1.fill?.style as VisualScaleType)?.scale === globalScale.getScale('color')).toEqual(false);
    expect((markStyle1.size?.style as VisualScaleType)?.scale === globalScale.getScale('size')).toEqual(false);
    expect((markStyle1.shape?.style as VisualScaleType)?.scale === globalScale.getScale('shape')).toEqual(true);

    expect((markStyle1.fill?.style as VisualScaleType)?.scale.domain()).toEqual([347, 2183]);
    expect((markStyle1.size?.style as VisualScaleType)?.scale.domain()).toEqual([19061, 251487]);
  });
});
