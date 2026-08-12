import type {
  IAreaChartSpec,
  IBarChartSpec,
  IBoxPlotChartSpec,
  ICircularProgressChartSpec,
  IHeatmapChartSpec,
  ILineChartSpec,
  ILinearProgressChartSpec,
  IPieChartSpec,
  IRangeColumnChartSpec,
  IScatterChartSpec,
  IWaterfallChartSpec
} from '../../../src';
import { default as VChart } from '../../../src';
import { totalLabel } from '../../../src/theme/builtin/common/component/total-label';
import { series } from '../../../src/theme/builtin/common/series';
import { createDiv, removeDom } from '../../util/dom';

describe('vchart updateSpec test', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';

    const data = [
      { city: '石家庄', type: '水果', value: 14500 },
      { city: '石家庄', type: '米面', value: 8500 },
      { city: '石家庄', type: '特产零食', value: 10000 },
      { city: '石家庄', type: '茶叶', value: 7000 },
      { city: '深圳', type: '水果', value: 9000 },
      { city: '深圳', type: '米面', value: 8500 },
      { city: '深圳', type: '特产零食', value: 11000 },
      { city: '深圳', type: '茶叶', value: 6000 },
      { city: '温州', type: '水果', value: 16000 },
      { city: '温州', type: '米面', value: 5000 },
      { city: '温州', type: '特产零食', value: 6000 },
      { city: '温州', type: '茶叶', value: 10000 },
      { city: '宁波', type: '水果', value: 14000 },
      { city: '宁波', type: '米面', value: 9000 },
      { city: '宁波', type: '特产零食', value: 10000 },
      { city: '宁波', type: '茶叶', value: 9000 },
      { city: '无锡', type: '水果', value: 14000 },
      { city: '无锡', type: '米面', value: 9000 },
      { city: '无锡', type: '特产零食', value: 10000 },
      { city: '无锡', type: '茶叶', value: 6000 },
      { city: '杭州', type: '水果', value: 9000 },
      { city: '杭州', type: '米面', value: 8500 },
      { city: '杭州', type: '特产零食', value: 10000 },
      { city: '杭州', type: '茶叶', value: 6000 },
      { city: '北京', type: '水果', value: 17000 },
      { city: '北京', type: '米面', value: 6000 },
      { city: '北京', type: '特产零食', value: 7000 },
      { city: '北京', type: '茶叶', value: 10000 },
      { city: '上海', type: '水果', value: 18000 },
      { city: '上海', type: '米面', value: 11000 },
      { city: '上海', type: '特产零食', value: 15000 },
      { city: '上海', type: '茶叶', value: 14000 }
    ];
    const spec = {
      type: 'bar',
      data: [
        {
          id: 'bar',
          values: data
        }
      ],
      xField: ['city'],
      yField: 'value',
      seriesField: 'type',
      markLine: []
    } as any;
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
  });

  afterAll(() => {
    removeDom(container);
    vchart.release();
  });

  it('should create markLine component', () => {
    const data = [
      { city: '石家庄', type: '水果', value: 14500 },
      { city: '石家庄', type: '米面', value: 8500 },
      { city: '石家庄', type: '特产零食', value: 10000 },
      { city: '石家庄', type: '茶叶', value: 7000 },
      { city: '深圳', type: '水果', value: 9000 },
      { city: '深圳', type: '米面', value: 8500 },
      { city: '深圳', type: '特产零食', value: 11000 },
      { city: '深圳', type: '茶叶', value: 6000 },
      { city: '温州', type: '水果', value: 16000 },
      { city: '温州', type: '米面', value: 5000 },
      { city: '温州', type: '特产零食', value: 6000 },
      { city: '温州', type: '茶叶', value: 10000 },
      { city: '宁波', type: '水果', value: 14000 },
      { city: '宁波', type: '米面', value: 9000 },
      { city: '宁波', type: '特产零食', value: 10000 },
      { city: '宁波', type: '茶叶', value: 9000 },
      { city: '无锡', type: '水果', value: 14000 },
      { city: '无锡', type: '米面', value: 9000 },
      { city: '无锡', type: '特产零食', value: 10000 },
      { city: '无锡', type: '茶叶', value: 6000 },
      { city: '杭州', type: '水果', value: 9000 },
      { city: '杭州', type: '米面', value: 8500 },
      { city: '杭州', type: '特产零食', value: 10000 },
      { city: '杭州', type: '茶叶', value: 6000 },
      { city: '北京', type: '水果', value: 17000 },
      { city: '北京', type: '米面', value: 6000 },
      { city: '北京', type: '特产零食', value: 7000 },
      { city: '北京', type: '茶叶', value: 10000 },
      { city: '上海', type: '水果', value: 18000 },
      { city: '上海', type: '米面', value: 11000 },
      { city: '上海', type: '特产零食', value: 15000 },
      { city: '上海', type: '茶叶', value: 14000 }
    ];
    const spec2 = {
      type: 'bar',
      data: [
        {
          id: 'bar',
          values: data
        }
      ],
      xField: ['city'],
      yField: 'value',
      seriesField: 'type',
      markLine: [
        {
          y: 50000
        }
      ]
    };
    vchart.updateSpecSync(spec2);
    const components = vchart.getChart()?.getComponentsByKey('markLine');
    expect(components?.length).toBe(1);
  });
});

describe('vchart updateSpec mark style reInit test', () => {
  it('should preserve component-injected brush state styles after data-only updateSpec', () => {
    const container = createDiv();
    const dom = createDiv(container);
    const createSpec = (values: Array<{ type: string; value: number }>) =>
      ({
        type: 'bar',
        width: 300,
        height: 200,
        data: [
          {
            id: 'bar',
            values
          }
        ],
        xField: 'type',
        yField: 'value',
        brush: {
          visible: true,
          brushType: 'rect',
          inBrush: {
            colorAlpha: 1
          },
          outOfBrush: {
            colorAlpha: 0.2
          }
        }
      } as IBarChartSpec);
    const chart = new VChart(
      createSpec([
        { type: '1', value: 20 },
        { type: '2', value: 30 }
      ]),
      {
        dom,
        animation: false
      }
    );

    chart.renderSync();

    const getBarMark = () => {
      const barSeries = chart
        .getChart()
        ?.getAllSeries()
        .find(series => series.type === 'bar');
      const barMark = barSeries?.getMarks().find(mark => mark.name === 'bar') as any;

      expect(barMark).toBeDefined();
      return barMark;
    };
    const expectBrushStates = () => {
      const barMark = getBarMark();

      expect(barMark.stateStyle.inBrush.fillOpacity.style).toBe(1);
      expect(barMark.stateStyle.outOfBrush.fillOpacity.style).toBe(0.2);
    };

    try {
      expectBrushStates();

      chart.updateSpecSync(
        createSpec([
          { type: '1', value: 25 },
          { type: '2', value: 35 }
        ])
      );

      expectBrushStates();
    } finally {
      chart.release();
      removeDom(container);
    }
  });
});

describe('vchart updateSpec field update classification test', () => {
  const getBarGraphicById = (chart: VChart, id: string) => {
    const barSeries = chart
      .getChart()
      ?.getAllSeries()
      .find(series => series.type === 'bar');
    const barMark = barSeries?.getMarks().find(mark => mark.name === 'bar') as any;
    const barGraphic = barMark?.getGraphics().find((graphic: any) => graphic.context?.data?.[0]?.id === id);

    expect(barMark).toBeDefined();
    expect(barGraphic).toBeDefined();
    return barGraphic as any;
  };
  const getBarGraphicByDatum = (chart: VChart, predicate: (datum: any) => boolean) => {
    const barSeries = chart
      .getChart()
      ?.getAllSeries()
      .find(series => series.type === 'bar');
    const barMark = barSeries?.getMarks().find(mark => mark.name === 'bar') as any;
    const barGraphic = barMark?.getGraphics().find((graphic: any) => predicate(graphic.context?.data?.[0]));

    expect(barMark).toBeDefined();
    expect(barGraphic).toBeDefined();
    return barGraphic as any;
  };
  const getBarHeight = (graphic: any) => Math.abs(graphic.attribute.y1 - graphic.attribute.y);

  it('should keep seriesField in default data key when a single dimension value equals the series value', () => {
    const container = createDiv();
    const dom = createDiv(container);
    const chart = new VChart(
      {
        type: 'bar',
        width: 300,
        height: 200,
        data: [
          {
            id: 'bar',
            values: [
              { category: 'A', group: 'A', value: 10 },
              { category: 'A', group: 'B', value: 20 }
            ]
          }
        ],
        xField: 'category',
        yField: 'value',
        seriesField: 'group',
        axes: [
          { orient: 'left', visible: false },
          { orient: 'bottom', visible: false }
        ]
      } as IBarChartSpec,
      {
        dom
      }
    );

    chart.renderSync();

    try {
      expect(getBarGraphicByDatum(chart, datum => datum?.group === 'A').context.key).toBe('A_A');
      expect(getBarGraphicByDatum(chart, datum => datum?.group === 'B').context.key).toBe('A_B');
    } finally {
      chart.release();
      removeDom(container);
    }
  });

  it('should update top-level xField through recompile without remaking chart', () => {
    const container = createDiv();
    const dom = createDiv(container);
    const createSpec = (xField: 'category' | 'nextCategory') =>
      ({
        type: 'bar',
        width: 300,
        height: 200,
        dataKey: 'id',
        data: [
          {
            id: 'bar',
            values: [
              { id: 'a', category: 'A', nextCategory: 'A', value: 10 },
              { id: 'b', category: 'B', nextCategory: 'A', value: 20 },
              { id: 'c', category: 'C', nextCategory: 'C', value: 30 }
            ]
          }
        ],
        xField,
        yField: 'value',
        axes: [
          { orient: 'left', visible: false },
          { orient: 'bottom', visible: false }
        ]
      } as IBarChartSpec);
    const chart = new VChart(createSpec('category'), {
      dom,
      animation: false
    });

    chart.renderSync();

    try {
      const chartBefore = chart.getChart();
      const barBefore = getBarGraphicById(chart, 'b');
      const xBefore = barBefore.attribute.x;

      chart.updateSpecSync(createSpec('nextCategory'));

      const barAfter = getBarGraphicById(chart, 'b');

      expect(chart.getChart()).toBe(chartBefore);
      expect(barAfter.attribute.x).not.toBe(xBefore);
    } finally {
      chart.release();
      removeDom(container);
    }
  });

  it('should update top-level yField through recompile without remaking chart', () => {
    const container = createDiv();
    const dom = createDiv(container);
    const createSpec = (yField: 'value' | 'nextValue') =>
      ({
        type: 'bar',
        width: 300,
        height: 200,
        dataKey: 'id',
        data: [
          {
            id: 'bar',
            values: [
              { id: 'a', category: 'A', value: 10, nextValue: 30 },
              { id: 'b', category: 'B', value: 30, nextValue: 30 }
            ]
          }
        ],
        xField: 'category',
        yField,
        axes: [
          { orient: 'left', visible: false },
          { orient: 'bottom', visible: false }
        ]
      } as IBarChartSpec);
    const chart = new VChart(createSpec('value'), {
      dom,
      animation: false
    });

    chart.renderSync();

    try {
      const chartBefore = chart.getChart();
      const barBefore = getBarGraphicById(chart, 'a');
      const yBefore = barBefore.attribute.y;
      const heightBefore = getBarHeight(barBefore);

      chart.updateSpecSync(createSpec('nextValue'));

      const barAfter = getBarGraphicById(chart, 'a');

      expect(chart.getChart()).toBe(chartBefore);
      expect(barAfter.attribute.y).not.toBe(yBefore);
      expect(getBarHeight(barAfter)).not.toBe(heightBefore);
    } finally {
      chart.release();
      removeDom(container);
    }
  });

  it('should remake when top-level seriesField changes because mark groupKey is initialized from seriesField', () => {
    const container = createDiv();
    const dom = createDiv(container);
    const createSpec = (seriesField: 'group' | 'nextGroup') =>
      ({
        type: 'bar',
        width: 300,
        height: 200,
        data: [
          {
            id: 'bar',
            values: [
              { category: 'A', value: 10, group: 'old-a', nextGroup: 'new-a' },
              { category: 'B', value: 20, group: 'old-b', nextGroup: 'new-b' }
            ]
          }
        ],
        xField: 'category',
        yField: 'value',
        seriesField,
        axes: [
          { orient: 'left', visible: false },
          { orient: 'bottom', visible: false }
        ]
      } as IBarChartSpec);
    const chart = new VChart(createSpec('group'), {
      dom,
      animation: false
    });

    chart.renderSync();

    try {
      const chartBefore = chart.getChart();

      chart.updateSpecSync(createSpec('nextGroup'));

      expect(chart.getChart()).not.toBe(chartBefore);
    } finally {
      chart.release();
      removeDom(container);
    }
  });
});

describe('vchart updateSpec of same spec', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterAll(() => {
    removeDom(container);
    vchart.release();
  });

  it('should not remake', () => {
    const spec = {
      type: 'bar',
      xField: ['eQkZvr2IzEDQ', '10001'],
      yField: ['10002'],
      direction: 'vertical',
      sortDataByAxis: true,
      seriesField: '30001',
      padding: {
        left: 6,
        right: 6,
        top: 6,
        bottom: 6
      },
      labelLayout: 'region',
      data: [
        {
          id: 'data',
          values: [
            {
              '10001': 'Profit',
              '10002': 20,
              '10003': 'HfH9clsXediN',
              '30001': '2023',
              eQkZvr2IzEDQ: 'Labels',
              HfH9clsXediN: 20,
              f9E7ulsVjzEg: '2023',
              dataKey: 0.12146121346369476
            },
            {
              '10001': 'Profit',
              '10002': 44,
              '10003': 'HfH9clsXediN',
              '30001': '2022',
              eQkZvr2IzEDQ: 'Labels',
              HfH9clsXediN: 44,
              f9E7ulsVjzEg: '2022',
              dataKey: 0.11935298916579362
            },
            {
              '10001': 'Profit',
              '10002': 15,
              '10003': 'HfH9clsXediN',
              '30001': '2023',
              eQkZvr2IzEDQ: 'Tables',
              HfH9clsXediN: 15,
              f9E7ulsVjzEg: '2023',
              dataKey: 0.6014295333929318
            },
            {
              '10001': 'Profit',
              '10002': 20,
              '10003': 'HfH9clsXediN',
              '30001': '2022',
              eQkZvr2IzEDQ: 'Tables',
              HfH9clsXediN: 20,
              f9E7ulsVjzEg: '2022',
              dataKey: 0.3618528674569743
            },
            {
              '10001': 'Profit',
              '10002': 50,
              '10003': 'HfH9clsXediN',
              '30001': '2023',
              eQkZvr2IzEDQ: 'Storage',
              HfH9clsXediN: 50,
              f9E7ulsVjzEg: '2023',
              dataKey: 0.3026198782849232
            },
            {
              '10001': 'Profit',
              '10002': 65,
              '10003': 'HfH9clsXediN',
              '30001': '2022',
              eQkZvr2IzEDQ: 'Storage',
              HfH9clsXediN: 65,
              f9E7ulsVjzEg: '2022',
              dataKey: 0.5628085740866975
            },
            {
              '10001': 'Profit',
              '10002': 15,
              '10003': 'HfH9clsXediN',
              '30001': '2023',
              eQkZvr2IzEDQ: 'Furn',
              HfH9clsXediN: 15,
              f9E7ulsVjzEg: '2023',
              dataKey: 0.058865883616797454
            },
            {
              '10001': 'Profit',
              '10002': 40,
              '10003': 'HfH9clsXediN',
              '30001': '2022',
              eQkZvr2IzEDQ: 'Furn',
              HfH9clsXediN: 40,
              f9E7ulsVjzEg: '2022',
              dataKey: 0.6552124287584555
            },
            {
              '10001': 'Profit',
              '10002': 57,
              '10003': 'HfH9clsXediN',
              '30001': '2023',
              eQkZvr2IzEDQ: 'Art',
              HfH9clsXediN: 57,
              f9E7ulsVjzEg: '2023',
              dataKey: 0.09013304102601305
            },
            {
              '10001': 'Profit',
              '10002': 35,
              '10003': 'HfH9clsXediN',
              '30001': '2022',
              eQkZvr2IzEDQ: 'Art',
              HfH9clsXediN: 35,
              f9E7ulsVjzEg: '2022',
              dataKey: 0.10762711388063928
            }
          ],
          fields: {
            '10001': {
              alias: '指标名称'
            },
            '10002': {
              alias: '指标值'
            },
            '30001': {
              alias: '图例项',
              domain: ['2023', '2022'],
              sortIndex: 0,
              lockStatisticsByDomain: true
            },
            eQkZvr2IzEDQ: {
              alias: 'Product',
              domain: ['Labels', 'Labels', 'Tables', 'Tables', 'Storage', 'Storage', 'Furn', 'Furn', 'Art', 'Art'],
              sortIndex: 0,
              lockStatisticsByDomain: true
            },
            f9E7ulsVjzEg: {
              alias: 'Year'
            },
            HfH9clsXediN: {
              alias: 'Profit'
            }
          }
        }
      ],
      stackInverse: true,
      percent: true,
      axes: [
        {
          type: 'band',
          tick: {
            style: {
              strokeOpacity: 0.2
            },
            visible: false
          },
          grid: {
            visible: false,
            style: {
              zIndex: 150,
              stroke: '#FFFFFF',
              lineWidth: 1,
              lineDash: []
            }
          },
          orient: 'bottom',
          visible: true,
          domainLine: {
            visible: false,
            style: {
              lineWidth: 1,
              stroke: '#d5d7e2'
            }
          },
          title: {
            visible: false,
            space: 5,
            text: '',
            style: {
              fontSize: 12,
              fill: 'rgba(255,255,255,0.5)',
              fontFamily: 'D-DIN',
              fontWeight: 'normal'
            }
          },
          maxHeight: null,
          autoIndent: false,
          sampling: false,
          zIndex: 200,
          label: {
            visible: true,
            space: 4,
            style: {
              fontSize: 12,
              fill: 'rgba(255,255,255,0.65)',
              angle: 0,
              fontFamily: 'D-DIN',
              fontWeight: 'normal',
              direction: 'horizontal',
              maxLineWidth: 174
            },
            autoHide: true,
            autoHideMethod: 'greedy',
            flush: true,
            lastVisible: true,
            autoHideSeparation: 4
          },
          hover: true,
          background: {
            visible: true,
            state: {
              hover: {
                fillOpacity: 0.08,
                fill: '#141414'
              },
              hover_reverse: {
                fillOpacity: 0.08,
                fill: '#141414'
              }
            }
          },
          paddingInner: 0.15,
          paddingOuter: 0.15,
          ticks: true
        },
        {
          type: 'linear',
          tick: {
            size: 4,
            visible: true,
            tickMode: 'd3'
          },
          niceType: 'rough',
          zIndex: 200,
          grid: {
            visible: true
          },
          orient: 'left',
          visible: true,
          domainLine: {
            visible: false,
            style: {
              lineWidth: 1,
              stroke: '#d5d7e2'
            }
          },
          title: {
            visible: false,
            text: '',
            space: 8,
            style: {
              fontSize: 12,
              fill: 'rgba(255,255,255,0.5)',
              fontFamily: 'D-DIN',
              fontWeight: 'normal'
            }
          },
          autoIndent: false,
          sampling: false,
          label: {
            visible: true,
            space: 6,
            flush: true,
            padding: 0,
            style: {
              fontSize: 12,
              maxLineWidth: 174,
              fill: 'rgba(255,255,255,0.65)',
              angle: 0,
              fontFamily: 'D-DIN',
              fontWeight: 'normal',
              dy: -1,
              direction: 'horizontal'
            },
            autoHide: true,
            autoHideMethod: 'greedy',
            autoHideSeparation: 4,
            rotateAngle: [null],
            labelOverlap: 'custom',
            tighten: false
          },
          background: {
            visible: true,
            state: {
              hover: {
                fillOpacity: 0.08,
                fill: '#141414'
              },
              hover_reverse: {
                fillOpacity: 0.08,
                fill: '#141414'
              }
            }
          },
          innerOffset: {
            top: 0
          },
          zero: true,
          nice: true,
          paddingInner: 0.15,
          paddingOuter: 0.15,
          maxWidth: 180,
          ticks: true
        },
        {
          type: 'linear',
          tick: {
            size: 4,
            visible: true,
            tickMode: 'd3'
          },
          niceType: 'rough',
          zIndex: 200,
          grid: {
            visible: false
          },
          orient: 'right',
          visible: true,
          domainLine: {
            visible: false
          },
          title: {
            visible: false
          },
          autoIndent: false,
          sampling: false,
          label: {
            visible: true,
            space: 6,
            flush: true,
            padding: 0,
            style: {
              visible: false,
              fontSize: 12,
              maxLineWidth: 174,
              fill: 'rgba(255,255,255,0.65)',
              angle: 0,
              fontFamily: 'D-DIN',
              fontWeight: 'normal',
              dy: -1,
              direction: 'horizontal'
            },
            autoHide: true,
            autoHideMethod: 'greedy',
            autoHideSeparation: 4,
            rotateAngle: [null],
            labelOverlap: 'custom',
            tighten: false
          },
          background: {
            visible: true,
            state: {
              hover: {
                fillOpacity: 0.08,
                fill: '#141414'
              },
              hover_reverse: {
                fillOpacity: 0.08,
                fill: '#141414'
              }
            }
          },
          innerOffset: {
            top: 0
          },
          zero: true,
          nice: true,
          paddingInner: 0.15,
          paddingOuter: 0.15,
          maxWidth: 180,
          ticks: true
        }
      ],
      color: {
        field: '30001',
        type: 'ordinal',
        range: ['rgb(0,110,255)', 'rgb(0,229,229)'],
        specified: {}
      },
      colorGradient: {
        type: 'linear',
        x0: {
          field: '30001',
          type: 'ordinal',
          range: [0, 0]
        },
        y0: {
          field: '30001',
          type: 'ordinal',
          range: [1, 1]
        },
        x1: {
          field: '30001',
          type: 'ordinal',
          range: [0.00001, 0.00001]
        },
        y1: {
          field: '30001',
          type: 'ordinal',
          range: [0, 0]
        },
        stops: [
          {
            offset: 0,
            color: {
              field: '30001',
              type: 'ordinal',
              range: ['rgba(0,110,255,0.2)', 'rgba(0,229,229,0.2)']
            }
          },
          {
            offset: 1,
            color: {
              field: '30001',
              type: 'ordinal',
              range: ['rgb(0,110,255)', 'rgb(0,229,229)']
            }
          }
        ]
      },
      legends: [
        {
          type: 'discrete',
          visible: true,
          id: 'legend-discrete',
          orient: 'top',
          position: 'end',
          layoutType: 'normal',
          maxRow: 1,
          title: {
            textStyle: {
              fontSize: 12,
              fill: 'rgba(255,255,255,0.45)'
            }
          },
          layoutLevel: 70,
          item: {
            focus: true,
            focusIconStyle: {
              size: 14
            },
            maxWidth: 400,
            spaceRow: 0,
            spaceCol: 0,
            padding: {
              left: 10,
              right: -10,
              top: 0,
              bottom: 5
            },
            background: {
              visible: false,
              style: {
                fillOpacity: 0.001
              }
            },
            label: {
              style: {
                fontSize: 12,
                fill: 'rgba(255,255,255,0.45)',
                fontFamily: 'D-DIN',
                fontWeight: 'normal'
              },
              state: {
                unSelected: {
                  fillOpacity: 0.2
                }
              }
            },
            shape: {
              style: {
                lineWidth: 0,
                symbolType: 'square',
                size: 12,
                fillOpacity: 1,
                width: 12,
                height: 7.416
              }
            }
          },
          pager: {
            layout: 'horizontal',
            padding: 0,
            textStyle: {},
            space: 0,
            handler: {
              preShape: 'triangleLeft',
              nextShape: 'triangleRight',
              style: {},
              state: {
                disable: {}
              }
            }
          },
          alignSelf: 'end',
          padding: {
            left: 10,
            right: 0,
            top: 0,
            bottom: 12
          }
        }
      ],
      label: {
        visible: false,
        offset: 3,
        overlap: {
          hideOnHit: true,
          avoidBaseMark: false,
          strategy: [
            {
              type: 'position',
              position: []
            }
          ],
          clampForce: true
        },
        style: {
          fontSize: 10,
          fontFamily: 'D-DIN',
          fontWeight: 'normal',
          zIndex: 400,
          lineHeight: '100%',
          fill: 'rgba(255,255,255,1)',
          strokeOpacity: 0
        },
        position: 'outside',
        smartInvert: false,
        fontWeight: 'normal'
      },
      tooltip: {
        visible: true,
        renderMode: 'canvas',
        mark: {
          visible: true
        },
        style: {
          panel: {
            padding: {
              top: 5,
              bottom: 10,
              left: 10,
              right: 10
            },
            backgroundColor: 'rgba(8, 28, 48, 0.95)',
            border: {
              color: '#CFCFCF',
              width: 0,
              radius: 2
            },
            shadow: {
              x: 0,
              y: 4,
              blur: 12,
              spread: 0,
              color: 'rgba(0, 0, 0, 0.2)'
            }
          },
          titleLabel: {
            fontSize: 14,
            fontColor: '#FFF',
            fontWeight: 'bold',
            fontFamily: 'D-DIN',
            align: 'left',
            lineHeight: 18
          },
          keyLabel: {
            fontSize: 12,
            fontColor: 'rgba(255,255,255,0.65)',
            fontWeight: 'normal',
            fontFamily: 'SourceHanSansCN-Normal',
            align: 'left',
            lineHeight: 18
          },
          valueLabel: {
            fontSize: 12,
            fontColor: '#FFF',
            fontWeight: 'normal',
            fontFamily: 'D-DIN',
            align: 'right',
            lineHeight: 18
          },
          shape: {
            size: 10,
            spacing: 10
          },
          spaceRow: 10
        },
        dimension: {
          visible: true
        }
      },
      hover: {
        enable: true
      },
      select: {
        enable: true
      },
      bar: {
        state: {
          hover: {
            cursor: 'pointer',
            fillOpacity: 0.8,
            stroke: '#58595B',
            lineWidth: 1,
            zIndex: 500
          },
          selected: {
            cursor: 'pointer',
            fillOpacity: 1,
            stroke: '#58595B',
            lineWidth: 1
          },
          selected_reverse: {
            fillOpacity: 0.3,
            lineWidth: 0.3
          }
        },
        style: {
          cornerRadius: 0,
          fill: {
            gradient: 'linear',
            x0: 0,
            y0: 1,
            stops: [
              {
                offset: 0
              },
              {
                offset: 1
              }
            ]
          },
          lineWidth: 2,
          stroke: {
            gradient: 'linear',
            x0: 0,
            y0: 1,
            stops: [
              {
                offset: 0
              },
              {
                offset: 1
              }
            ]
          }
        }
      },
      region: [
        {
          clip: true
        }
      ],
      background: 'rgba(0, 0, 0, 1)',
      animation: true,
      crosshair: {
        xField: {
          visible: true,
          line: {
            type: 'rect',
            style: {
              fillOpacity: 1,
              fill: 'rgba(80,156,255,0.1)'
            }
          }
        },
        gridZIndex: 100,
        yField: {
          line: {
            style: {
              fillOpacity: 1,
              fill: 'rgba(80,156,255,0.1)'
            }
          },
          visible: false
        }
      },
      morph: {
        enable: false
      },
      axesPadding: true,
      plotLayout: {
        clip: false
      },
      scales: [
        {
          id: 'gradientFillStop0',
          type: 'ordinal',
          range: [
            'rgba(0,110,255,0.2)',
            'rgba(0,229,229,0.2)',
            'rgba(46,85,234,0.2)',
            'rgba(184,231,254,0.2)',
            'rgba(0,214,137,0.2)',
            'rgba(183,249,245,0.2)',
            'rgba(251,204,113,0.2)',
            'rgba(244,110,80,0.2)'
          ],
          domain: [
            {
              dataId: 'data',
              fields: ['30001']
            }
          ]
        },
        {
          id: 'gradientFillStop1',
          type: 'ordinal',
          range: [
            'rgb(0,110,255)',
            'rgb(0,229,229)',
            'rgb(46,85,234)',
            'rgb(184,231,254)',
            'rgb(0,214,137)',
            'rgb(183,249,245)',
            'rgb(251,204,113)',
            'rgb(244,110,80)'
          ],
          domain: [
            {
              dataId: 'data',
              fields: ['30001']
            }
          ]
        },
        {
          id: 'gradientStrokeStop0',
          type: 'ordinal',
          range: [
            'rgba(51, 139, 255, 0.2)',
            'rgba(25, 255, 255, 0.2)',
            'rgba(92, 123, 239, 0.2)',
            'rgba(234, 248, 255, 0.2)',
            'rgba(10, 255, 167, 0.2)',
            'rgba(230, 253, 252, 0.2)',
            'rgba(252, 222, 163, 0.2)',
            'rgba(247, 150, 128, 0.2)'
          ],
          domain: [
            {
              dataId: 'data',
              fields: ['30001']
            }
          ]
        },
        {
          id: 'gradientStrokeStop1',
          type: 'ordinal',
          range: [
            'rgba(51, 139, 255, 1)',
            'rgba(25, 255, 255, 1)',
            'rgba(92, 123, 239, 1)',
            'rgba(234, 248, 255, 1)',
            'rgba(10, 255, 167, 1)',
            'rgba(230, 253, 252, 1)',
            'rgba(252, 222, 163, 1)',
            'rgba(247, 150, 128, 1)'
          ],
          domain: [
            {
              dataId: 'data',
              fields: ['30001']
            }
          ]
        },
        {
          id: 'gradientX1',
          type: 'ordinal',
          range: [0.00001, 0.00001, 0.00001, 0.00001, 0.00001, 0.00001, 0.00001, 0.00001],
          domain: [
            {
              dataId: 'data',
              fields: ['30001']
            }
          ]
        },
        {
          id: 'gradientY1',
          type: 'ordinal',
          range: [0, 0, 0, 0, 0, 0, 0, 0],
          domain: [
            {
              dataId: 'data',
              fields: ['30001']
            }
          ]
        }
      ],
      barWidth: '50%',
      barBackground: {
        fieldLevel: 1,
        visible: false,
        interactive: false,
        style: {
          cornerRadius: 0,
          fill: 'rgba(255,255,255,1)',
          fillOpacity: 0.25
        }
      },
      animationAppear: {
        bar: {
          type: 'growHeightIn',
          oneByOne: false,
          duration: 1000,
          delayAfter: 4000,
          loop: true
        }
      },
      animationEnter: {
        bar: {
          type: 'growHeightIn',
          oneByOne: false,
          duration: 1000,
          delayAfter: 4000,
          loop: false
        }
      },
      animationUpdate: {
        bar: {
          type: 'growHeightIn',
          oneByOne: false,
          duration: 1000,
          delayAfter: 4000,
          loop: false,
          options: {
            overall: true,
            orient: 'negative'
          }
        }
      },
      hash: '3136c561bad4328a39917f23d8606675'
    } as unknown as IBarChartSpec;
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(spec, false);

    expect(updateRes).toEqual({
      changeBackground: false,
      change: false,
      reCompile: false,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false,
      changeTheme: false
    });
  });

  it('should not remake when label is in series', () => {
    const spec = {
      type: 'bar',
      data: [
        {
          id: 'barData',
          values: [
            {
              name: 'Apple',
              value: 214480
            },
            {
              name: 'Google',
              value: 155506
            }
          ]
        }
      ],
      direction: 'horizontal',
      series: [
        {
          type: 'bar',
          xField: 'value',
          yField: 'name',
          label: {
            visible: true
          }
        }
      ],
      axes: [
        {
          orient: 'bottom',
          visible: false
        }
      ]
    };
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(spec, false);

    expect(updateRes).toEqual({
      changeBackground: false,
      change: false,
      changeTheme: false,
      reCompile: false,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });

  it('should not remake when label is in chart', () => {
    const spec = {
      data: [
        {
          id: 'barData',
          values: [
            {
              name: 'Apple',
              value: 214480
            },
            {
              name: 'Google',
              value: 155506
            }
          ]
        }
      ],
      direction: 'horizontal',
      type: 'bar',
      xField: 'value',
      yField: 'name',
      label: {
        visible: true
      },
      axes: [
        {
          orient: 'bottom',
          visible: false
        }
      ]
    };
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(spec, false);

    expect(updateRes).toEqual({
      changeBackground: false,
      change: false,
      changeTheme: false,
      reCompile: false,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });

  it('should not throw error when data is empty in series', () => {
    const spec: any = {
      type: 'common',
      seriesField: 'color',
      data: [
        {
          id: 'id0',
          values: [
            { x: '周一', type: '早餐', y: 15 },
            { x: '周一', type: '午餐', y: 25 },
            { x: '周二', type: '早餐', y: 12 },
            { x: '周二', type: '午餐', y: 30 },
            { x: '周三', type: '早餐', y: 15 },
            { x: '周三', type: '午餐', y: 24 },
            { x: '周四', type: '早餐', y: 10 },
            { x: '周四', type: '午餐', y: 25 },
            { x: '周五', type: '早餐', y: 13 },
            { x: '周五', type: '午餐', y: 20 },
            { x: '周六', type: '早餐', y: 10 },
            { x: '周六', type: '午餐', y: 22 },
            { x: '周日', type: '早餐', y: 12 },
            { x: '周日', type: '午餐', y: 19 }
          ]
        },
        {
          id: 'id1',
          values: [
            { x: '周一', type: '饮料', y: 22 },
            { x: '周二', type: '饮料', y: 43 },
            { x: '周三', type: '饮料', y: 33 },
            { x: '周四', type: '饮料', y: 22 },
            { x: '周五', type: '饮料', y: 10 },
            { x: '周六', type: '饮料', y: 30 },
            { x: '周日', type: '饮料', y: 50 }
          ]
        }
      ],
      series: [
        {
          type: 'bar',
          id: 'bar',
          data: {
            id: 'id0'
          },
          label: { visible: true },
          seriesField: 'type',

          xField: ['x', 'type'],
          yField: 'y'
        },
        {
          type: 'line',
          id: 'line',
          data: {
            id: 'id1'
          },
          label: { visible: true },
          seriesField: 'type',
          xField: 'x',
          yField: 'y',
          stack: false
        }
      ],
      axes: [
        { orient: 'left', seriesIndex: [0] },
        { orient: 'right', seriesId: ['line'], grid: { visible: false } },
        { orient: 'bottom', label: { visible: true }, type: 'band' }
      ],
      legends: {
        visible: true,
        orient: 'bottom'
      }
    };

    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(spec, false);

    expect(updateRes).toEqual({
      changeBackground: false,
      change: false,
      changeTheme: false,
      reCompile: false,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });
});

describe('vchart updateSpec of different about label', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterAll(() => {
    removeDom(container);
    vchart.release();
  });

  it('should reCompile when label config is in series update', () => {
    const spec = {
      type: 'bar',
      data: [
        {
          id: 'barData',
          values: [
            {
              name: 'Apple',
              value: 214480
            },
            {
              name: 'Google',
              value: 155506
            }
          ]
        }
      ],
      direction: 'horizontal',
      series: [
        {
          type: 'bar',
          xField: 'value',
          yField: 'name',
          label: {
            visible: true
          }
        }
      ],
      axes: [
        {
          orient: 'bottom',
          visible: false
        }
      ]
    };
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        series: [
          {
            type: 'bar',
            xField: 'value',
            yField: 'name',
            label: {
              visible: true,
              position: 'center'
            }
          }
        ]
      },
      false
    );

    expect(updateRes).toEqual({
      changeBackground: false,
      change: false,
      changeTheme: false,
      effects: {
        compile: true,
        layout: true,
        render: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });

  it('should reCompile when visible of label is in chart update', () => {
    const spec = {
      data: [
        {
          id: 'barData',
          values: [
            {
              name: 'Apple',
              value: 214480
            },
            {
              name: 'Google',
              value: 155506
            }
          ]
        }
      ],
      direction: 'horizontal',
      type: 'bar',
      xField: 'value',
      yField: 'name',
      label: {
        visible: true
      },
      axes: [
        {
          orient: 'bottom',
          visible: false
        }
      ]
    };
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        label: {
          visible: true,
          position: 'top'
        }
      },
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      effects: {
        compile: true,
        layout: true,
        render: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });

  it('should update locally when visible of existing axis grid change', () => {
    const spec = {
      type: 'area',
      data: [
        {
          id: 'area',
          values: [
            { x: '1990', y: 110, from: 'video ad' },
            { x: '1995', y: 160, from: 'video ad' },
            { x: '2000', y: 230, from: 'video ad' },
            { x: '2005', y: 300, from: 'video ad' },
            { x: '2010', y: 448, from: 'video ad' },
            { x: '2015', y: 500, from: 'video ad' },
            { x: '1990', y: 120, from: 'email marketing' },
            { x: '1995', y: 150, from: 'email marketing' },
            { x: '2000', y: 200, from: 'email marketing' },
            { x: '2005', y: 210, from: 'email marketing' },
            { x: '2010', y: 300, from: 'email marketing' },
            { x: '2015', y: 320, from: 'email marketing' }
          ]
        }
      ],
      label: {
        visible: true
      },
      xField: 'x',
      yField: 'y',
      seriesField: 'from',
      axes: [
        {
          orient: 'bottom',
          type: 'band' as const
        },
        {
          orient: 'left',
          type: 'linear' as const,
          grid: {
            visible: true
          }
        }
      ]
    };
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        axes: [
          {
            orient: 'bottom',
            type: 'band' as const
          },
          {
            orient: 'left',
            type: 'linear' as const,
            grid: {
              visible: false
            }
          }
        ]
      },
      false
    );

    expect(updateRes).toEqual({
      changeBackground: false,
      change: false,
      changeTheme: false,
      effects: {
        component: true,
        layout: true,
        render: true
      },
      reCompile: false,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });

  it('should reRender when `alternateColor` of axis grid change', () => {
    const spec = {
      type: 'area',
      data: [
        {
          id: 'area',
          values: [
            { x: '1990', y: 110, from: 'video ad' },
            { x: '1995', y: 160, from: 'video ad' },
            { x: '2000', y: 230, from: 'video ad' },
            { x: '2005', y: 300, from: 'video ad' },
            { x: '2010', y: 448, from: 'video ad' },
            { x: '2015', y: 500, from: 'video ad' },
            { x: '1990', y: 120, from: 'email marketing' },
            { x: '1995', y: 150, from: 'email marketing' },
            { x: '2000', y: 200, from: 'email marketing' },
            { x: '2005', y: 210, from: 'email marketing' },
            { x: '2010', y: 300, from: 'email marketing' },
            { x: '2015', y: 320, from: 'email marketing' }
          ]
        }
      ],
      label: {
        visible: true
      },
      xField: 'x',
      yField: 'y',
      seriesField: 'from',
      axes: [
        {
          orient: 'bottom',
          type: 'band' as const
        },
        {
          orient: 'left',
          type: 'linear' as const,
          grid: {
            visible: true
          }
        }
      ]
    };
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        axes: [
          {
            orient: 'bottom',
            type: 'band' as const
          },
          {
            orient: 'left',
            type: 'linear' as const,
            grid: {
              visible: true,
              alternateColor: ['pink', 'green']
            }
          }
        ]
      },
      false
    );

    expect(updateRes).toEqual({
      changeBackground: false,
      change: false,
      changeTheme: false,
      effects: {
        component: true,
        layout: true,
        render: true
      },
      reCompile: false,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });

  it('should reMake when `visible` of label change from `false` to `true`', () => {
    const spec = {
      type: 'area',
      data: {
        values: [
          {
            time: '2:00',
            value: 8
          },
          {
            time: '4:00',
            value: 9
          },
          {
            time: '6:00',
            value: 11
          },
          {
            time: '8:00',
            value: 14
          },
          {
            time: '10:00',
            value: 16
          },
          {
            time: '12:00',
            value: 17
          },
          {
            time: '14:00',
            value: 17
          },
          {
            time: '16:00',
            value: 16
          },
          {
            time: '18:00',
            value: 15
          }
        ]
      },
      xField: 'time',
      yField: 'value',
      label: {
        visible: false
      }
    };
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        label: {
          visible: true
        }
      },
      false
    );

    expect(updateRes).toEqual({
      changeBackground: false,
      change: false,
      changeTheme: false,
      reCompile: false,
      reMake: true,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });

  it('should reCompile when `visible` of label change from `true` to `false`', () => {
    const spec = {
      type: 'area',
      data: {
        values: [
          {
            time: '2:00',
            value: 8
          },
          {
            time: '4:00',
            value: 9
          },
          {
            time: '6:00',
            value: 11
          },
          {
            time: '8:00',
            value: 14
          },
          {
            time: '10:00',
            value: 16
          },
          {
            time: '12:00',
            value: 17
          },
          {
            time: '14:00',
            value: 17
          },
          {
            time: '16:00',
            value: 16
          },
          {
            time: '18:00',
            value: 15
          }
        ]
      },
      xField: 'time',
      yField: 'value',
      label: {
        visible: true
      }
    };
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        label: {
          visible: false
        }
      },
      false
    );

    expect(updateRes).toEqual({
      changeBackground: false,
      change: true,
      changeTheme: false,
      effects: {
        compile: true,
        component: true,
        layout: true,
        render: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });
});

describe('vchart updateSpec of stackCornerRadius', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterAll(() => {
    removeDom(container);
    vchart.release();
  });

  it('should reCompile without reMake when top-level stackCornerRadius callback changes', () => {
    const spec = {
      type: 'bar',
      data: [
        {
          id: 'barData',
          values: [
            { name: 'Apple', group: 'A', value: 214480 },
            { name: 'Apple', group: 'B', value: 155506 }
          ]
        }
      ],
      xField: 'name',
      yField: 'value',
      seriesField: 'group',
      stack: true,
      stackCornerRadius: () => 4
    } as unknown as IBarChartSpec;
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        stackCornerRadius: () => 8
      },
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      effects: {
        compile: true,
        layout: true,
        render: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });
});

describe('vchart updateSpec of bar layout config', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart | null;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterEach(() => {
    vchart?.release();
    vchart = null;
  });

  afterAll(() => {
    removeDom(container);
  });

  it.each([
    ['barWidth', 10, 20],
    ['barMinWidth', 8, 16],
    ['barMaxWidth', 24, 32],
    ['barGapInGroup', 4, 8],
    ['barMinHeight', 2, 6]
  ])('should reCompile without reMake when top-level %s changes', (key, prevValue, nextValue) => {
    const spec = {
      type: 'bar',
      data: [
        {
          id: 'barData',
          values: [
            { name: 'Apple', value: 214480 },
            { name: 'Google', value: 155506 }
          ]
        }
      ],
      xField: 'name',
      yField: 'value',
      [key]: prevValue
    } as unknown as IBarChartSpec;
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        [key]: nextValue
      },
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      effects: {
        compile: true,
        layout: true,
        render: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });

  it('should reuse bar layout policy for rangeColumn barWidth updates', () => {
    const spec = {
      type: 'rangeColumn',
      data: [
        {
          id: 'rangeData',
          values: [
            { name: 'Apple', min: 10, max: 20 },
            { name: 'Google', min: 15, max: 30 }
          ]
        }
      ],
      xField: 'name',
      minField: 'min',
      maxField: 'max',
      barWidth: 10
    } as IRangeColumnChartSpec;
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        barWidth: 20
      },
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      effects: {
        compile: true,
        layout: true,
        render: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });
});

describe('vchart updateSpec of line-like sampling config', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart | null;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterEach(() => {
    vchart?.release();
    vchart = null;
  });

  afterAll(() => {
    removeDom(container);
  });

  const createLineLikeSpec = (type: 'line' | 'area', sampling: 'lttb' | 'average', samplingFactor: number) =>
    ({
      type,
      data: [
        {
          id: 'lineData',
          values: [
            { name: 'A', value: 1 },
            { name: 'B', value: 2 },
            { name: 'C', value: 3 }
          ]
        }
      ],
      xField: 'name',
      yField: 'value',
      sampling,
      samplingFactor
    } as ILineChartSpec | IAreaChartSpec);

  it.each(['line', 'area'] as const)('should reCompile without reMake when top-level %s sampling changes', type => {
    const spec = createLineLikeSpec(type, 'lttb', 1);
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        sampling: 'average'
      },
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      effects: {
        compile: true,
        data: true,
        layout: true,
        render: true,
        scaleDomain: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });

  it.each(['line', 'area'] as const)(
    'should reCompile without reMake when top-level %s samplingFactor changes',
    type => {
      const spec = createLineLikeSpec(type, 'lttb', 1);
      vchart = new VChart(spec, {
        dom,
        animation: false
      });
      vchart.renderSync();
      const updateRes = (vchart as any)._updateSpec(
        {
          ...spec,
          samplingFactor: 2
        },
        false
      );

      expect(updateRes).toEqual({
        change: false,
        changeBackground: false,
        changeTheme: false,
        effects: {
          compile: true,
          data: true,
          layout: true,
          render: true,
          scaleDomain: true,
          series: true
        },
        reCompile: true,
        reMake: false,
        reRender: true,
        reSize: false,
        reTransformSpec: false
      });
    }
  );
});

describe('vchart updateSpec of boxPlot layout config', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart | null;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterEach(() => {
    vchart?.release();
    vchart = null;
  });

  afterAll(() => {
    removeDom(container);
  });

  it.each([
    ['boxWidth', 10, 20],
    ['boxMinWidth', 8, 16],
    ['boxMaxWidth', 24, 32],
    ['boxGapInGroup', 4, 8]
  ])('should reCompile without reMake when top-level %s changes', (key, prevValue, nextValue) => {
    const spec = {
      type: 'boxPlot',
      data: [
        {
          id: 'boxData',
          values: [
            { name: 'A', min: 1, q1: 2, median: 3, q3: 4, max: 5 },
            { name: 'B', min: 2, q1: 3, median: 4, q3: 5, max: 6 }
          ]
        }
      ],
      xField: 'name',
      minField: 'min',
      q1Field: 'q1',
      medianField: 'median',
      q3Field: 'q3',
      maxField: 'max',
      [key]: prevValue
    } as unknown as IBoxPlotChartSpec;
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        [key]: nextValue
      },
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      effects: {
        compile: true,
        layout: true,
        render: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });
});

describe('vchart updateSpec of linearProgress layout config', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart | null;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterEach(() => {
    vchart?.release();
    vchart = null;
  });

  afterAll(() => {
    removeDom(container);
  });

  it('should reCompile without reMake when top-level bandWidth changes', () => {
    const spec = {
      type: 'linearProgress',
      data: [
        {
          id: 'progressData',
          values: [{ name: 'A', value: 0.6 }]
        }
      ],
      xField: 'value',
      yField: 'name',
      bandWidth: 10
    } as ILinearProgressChartSpec;
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        bandWidth: 20
      },
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      effects: {
        compile: true,
        layout: true,
        render: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });

  it('should reCompile without reMake when top-level progress padding changes', () => {
    const spec = {
      type: 'linearProgress',
      data: [
        {
          id: 'progressData',
          values: [{ name: 'A', value: 0.6 }]
        }
      ],
      xField: 'value',
      yField: 'name',
      bandWidth: 10,
      progress: {
        topPadding: 1,
        bottomPadding: 1
      }
    } as ILinearProgressChartSpec;
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        progress: {
          topPadding: 2,
          bottomPadding: 2
        }
      },
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      effects: {
        compile: true,
        layout: true,
        render: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });
});

describe('vchart updateSpec of circularProgress layout config', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart | null;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterEach(() => {
    vchart?.release();
    vchart = null;
  });

  afterAll(() => {
    removeDom(container);
  });

  it('should reCompile without reMake when top-level cornerRadius changes', () => {
    const spec = {
      type: 'circularProgress',
      data: [
        {
          id: 'progressData',
          values: [{ category: 'A', value: 0.6 }]
        }
      ],
      categoryField: 'category',
      valueField: 'value',
      cornerRadius: 0
    } as ICircularProgressChartSpec;
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        cornerRadius: 8
      },
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      effects: {
        compile: true,
        layout: true,
        render: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });
});

describe('vchart updateSpec of heatmap data field config', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart | null;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterEach(() => {
    vchart?.release();
    vchart = null;
  });

  afterAll(() => {
    removeDom(container);
  });

  it('should reCompile without reMake when top-level valueField changes', () => {
    const spec = {
      type: 'heatmap',
      data: [
        {
          id: 'heatmapData',
          values: [
            { x: 'A', y: 'K1', v1: 1, v2: 2 },
            { x: 'B', y: 'K1', v1: 3, v2: 4 }
          ]
        }
      ],
      xField: 'x',
      yField: 'y',
      valueField: 'v1'
    } as IHeatmapChartSpec;
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        valueField: 'v2'
      },
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      effects: {
        compile: true,
        data: true,
        layout: true,
        render: true,
        scaleDomain: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });
});

describe('vchart updateSpec of pie data field config', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart | null;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterEach(() => {
    vchart?.release();
    vchart = null;
  });

  afterAll(() => {
    removeDom(container);
  });

  it('should reCompile without reMake when top-level valueField changes', () => {
    const spec = {
      type: 'pie',
      data: [
        {
          id: 'pieData',
          values: [
            { category: 'A', v1: 1, v2: 3 },
            { category: 'B', v1: 1, v2: 1 }
          ]
        }
      ],
      categoryField: 'category',
      valueField: 'v1'
    } as IPieChartSpec;
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        valueField: 'v2'
      },
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      effects: {
        compile: true,
        data: true,
        layout: true,
        render: true,
        scaleDomain: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: undefined,
      reSize: false,
      reTransformSpec: false
    });
  });

  it('should reCompile without reMake when top-level startAngle changes', () => {
    const spec = {
      type: 'pie',
      data: [
        {
          id: 'pieData',
          values: [
            { category: 'A', value: 1 },
            { category: 'B', value: 1 }
          ]
        }
      ],
      categoryField: 'category',
      valueField: 'value',
      startAngle: 0,
      endAngle: 360
    } as IPieChartSpec;
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        startAngle: 90,
        endAngle: 450
      },
      false
    );

    expect(updateRes).toEqual({
      change: true,
      changeBackground: false,
      changeTheme: false,
      effects: {
        compile: true,
        data: true,
        layout: true,
        render: true,
        scaleDomain: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });

  it('should reCompile without reMake when top-level minAngle changes', () => {
    const spec = {
      type: 'pie',
      data: [
        {
          id: 'pieData',
          values: [
            { category: 'A', value: 1 },
            { category: 'B', value: 100 }
          ]
        }
      ],
      categoryField: 'category',
      valueField: 'value',
      minAngle: 0
    } as IPieChartSpec;
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        minAngle: 30
      },
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      effects: {
        compile: true,
        data: true,
        layout: true,
        render: true,
        scaleDomain: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: undefined,
      reSize: false,
      reTransformSpec: false
    });
  });

  it('should reCompile without reMake when top-level outerRadius changes', () => {
    const spec = {
      type: 'pie',
      data: [
        {
          id: 'pieData',
          values: [
            { category: 'A', value: 1 },
            { category: 'B', value: 1 }
          ]
        }
      ],
      categoryField: 'category',
      valueField: 'value',
      outerRadius: 0.5
    } as IPieChartSpec;
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        outerRadius: 0.8
      },
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      effects: {
        compile: true,
        layout: true,
        render: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: undefined,
      reSize: false,
      reTransformSpec: false
    });
  });
});

describe('vchart updateSpec of scatter data field config', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart | null;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterEach(() => {
    vchart?.release();
    vchart = null;
  });

  afterAll(() => {
    removeDom(container);
  });

  it('should reCompile without reMake when top-level sizeField changes', () => {
    const spec = {
      type: 'scatter',
      data: [
        {
          id: 'scatterData',
          values: [
            { x: 'A', y: 1, s1: 1, s2: 2 },
            { x: 'B', y: 2, s1: 2, s2: 1 }
          ]
        }
      ],
      xField: 'x',
      yField: 'y',
      size: [10, 20],
      sizeField: 's1'
    } as IScatterChartSpec;
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        sizeField: 's2'
      },
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      effects: {
        compile: true,
        data: true,
        layout: true,
        render: true,
        scaleDomain: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });
});

describe('vchart updateSpec of waterfall data transform config', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart | null;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterEach(() => {
    vchart?.release();
    vchart = null;
  });

  afterAll(() => {
    removeDom(container);
  });

  it('should reCompile without reMake when top-level calculationMode changes', () => {
    const spec = {
      type: 'waterfall',
      data: [
        {
          id: 'waterfallData',
          values: [
            { name: 'A', value: 3 },
            { name: 'B', value: 1 },
            { name: 'C', value: 2 }
          ]
        }
      ],
      xField: 'name',
      yField: 'value',
      calculationMode: 'increase'
    } as IWaterfallChartSpec;
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        calculationMode: 'decrease'
      },
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      effects: {
        compile: true,
        data: true,
        layout: true,
        render: true,
        scaleDomain: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });
});

describe('vchart updateSpec should not throw error', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterAll(() => {
    removeDom(container);
    vchart.release();
  });

  it('should remake when length of `axes` change', () => {
    const spec: IBarChartSpec = {
      type: 'bar',
      data: [
        {
          id: 'barData',
          values: [
            {
              name: 'Apple',
              value: 214480
            },
            {
              name: 'Google',
              value: 155506
            }
          ]
        }
      ],
      direction: 'horizontal',
      series: [
        {
          type: 'bar',
          xField: 'value',
          yField: 'name',
          label: {
            visible: true
          }
        }
      ],
      axes: [
        {
          orient: 'bottom',
          visible: true
        }
      ],
      markLine: [
        {
          y: 50,
          startSymbol: {
            visible: true,
            style: {
              symbolType: 'circle',
              size: 8
            }
          },
          label: {
            formatMethod: (...p: any[]) => {
              return p[0][0].y;
            },
            position: 'insideEndBottom',
            refY: -5,
            labelBackground: {
              visible: false
            }
          }
        }
      ]
    };
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        markLine: null
      },
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      reCompile: false,
      reMake: true,
      reRender: undefined,
      reSize: false,
      reTransformSpec: false
    });
  });
});

describe('vchart updateSpec of totalLabel', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterAll(() => {
    removeDom(container);
    vchart.release();
  });

  it('should reCompile', () => {
    const spec: ILineChartSpec = {
      type: 'line',
      data: {
        values: [
          { type: 'Nail polish', country: 'Africa', value: 4229 },
          { type: 'Nail polish', country: 'EU', value: 4376 },
          { type: 'Nail polish', country: 'China', value: 3054 },
          { type: 'Nail polish', country: 'USA', value: 12814 },
          { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
          { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
          { type: 'Eyebrow pencil', country: 'China', value: 5067 },
          { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
          { type: 'Rouge', country: 'Africa', value: 5221 },
          { type: 'Rouge', country: 'EU', value: 3574 },
          { type: 'Rouge', country: 'China', value: 7004 },
          { type: 'Rouge', country: 'USA', value: 11624 },
          { type: 'Lipstick', country: 'Africa', value: 9256 },
          { type: 'Lipstick', country: 'EU', value: 4376 },
          { type: 'Lipstick', country: 'China', value: 9054 },
          { type: 'Lipstick', country: 'USA', value: 8814 },
          { type: 'Eyeshadows', country: 'Africa', value: 3308 },
          { type: 'Eyeshadows', country: 'EU', value: 4572 },
          { type: 'Eyeshadows', country: 'China', value: 12043 },
          { type: 'Eyeshadows', country: 'USA', value: 12998 },
          { type: 'Eyeliner', country: 'Africa', value: 5432 },
          { type: 'Eyeliner', country: 'EU', value: 3417 },
          { type: 'Eyeliner', country: 'China', value: 15067 },
          { type: 'Eyeliner', country: 'USA', value: 12321 },
          { type: 'Foundation', country: 'Africa', value: 13701 },
          { type: 'Foundation', country: 'EU', value: 5231 },
          { type: 'Foundation', country: 'China', value: 10119 },
          { type: 'Foundation', country: 'USA', value: 10342 },
          { type: 'Lip gloss', country: 'Africa', value: 4008 },
          { type: 'Lip gloss', country: 'EU', value: 4572 },
          { type: 'Lip gloss', country: 'China', value: 12043 },
          { type: 'Lip gloss', country: 'USA', value: 22998 },
          { type: 'Mascara', country: 'Africa', value: 18712 },
          { type: 'Mascara', country: 'EU', value: 6134 },
          { type: 'Mascara', country: 'China', value: 10419 },
          { type: 'Mascara', country: 'USA', value: 11261 }
        ]
      },
      title: {
        visible: true,
        text: '100% stacked line chart of cosmetic products sales'
      },
      stack: true,
      xField: 'type',
      yField: 'value',
      seriesField: 'country',
      legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
      axes: [
        {
          orient: 'left',
          label: {
            formatMethod: (val: string | string[]) => {
              return `${(+val * 100).toFixed(2)}%`;
            }
          }
        }
      ],
      totalLabel: {
        visible: true
      },
      point: {
        visible: false
      },
      label: {
        visible: true
      }
    };
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        totalLabel: {
          ...spec.totalLabel,
          style: {
            fill: 'red'
          }
        }
      },
      false
    );

    expect(updateRes).toEqual({
      changeBackground: false,
      change: true,
      changeTheme: false,
      effects: {
        compile: true,
        layout: true,
        render: true,
        series: true
      },
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });
});

describe('vchart updateSpec of crosshair', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart;

  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterAll(() => {
    removeDom(container);
    vchart.release();
  });

  it('should update yField label formatMethod without reMake', () => {
    const createSpec = (formatMethod: (text: string | string[]) => string | string[]) =>
      ({
        type: 'bar',
        data: [
          {
            id: 'barData',
            values: [
              { name: 'Apple', value: 214480 },
              { name: 'Google', value: 155506 }
            ]
          }
        ],
        xField: 'name',
        yField: 'value',
        crosshair: {
          yField: {
            visible: true,
            line: {
              type: 'rect',
              style: {
                lineWidth: 0,
                opacity: 0.26,
                fill: '#4B4F54'
              }
            },
            label: {
              visible: true,
              formatMethod,
              labelBackground: {
                visible: true,
                style: {
                  fill: '#404349'
                }
              },
              style: {
                fill: '#ffffff'
              }
            }
          }
        }
      } as IBarChartSpec);

    const spec = createSpec(text => text);
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();

    const updateRes = (vchart as any)._updateSpec(
      createSpec(text => text),
      false
    );

    expect(updateRes.reMake).toBe(false);
    expect(updateRes.reCompile).toBe(false);
    expect(updateRes.effects).toEqual({
      component: true,
      layout: true,
      render: true
    });
  });
});

describe('vchart updateSpec of width, height', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterAll(() => {
    removeDom(container);
    vchart.release();
  });

  it('should reCompile', () => {
    const spec: ILineChartSpec = {
      type: 'line',
      data: {
        values: [
          { type: 'Nail polish', country: 'Africa', value: 4229 },
          { type: 'Nail polish', country: 'EU', value: 4376 },
          { type: 'Nail polish', country: 'China', value: 3054 },
          { type: 'Nail polish', country: 'USA', value: 12814 },
          { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
          { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
          { type: 'Eyebrow pencil', country: 'China', value: 5067 },
          { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
          { type: 'Rouge', country: 'Africa', value: 5221 },
          { type: 'Rouge', country: 'EU', value: 3574 },
          { type: 'Rouge', country: 'China', value: 7004 },
          { type: 'Rouge', country: 'USA', value: 11624 },
          { type: 'Lipstick', country: 'Africa', value: 9256 },
          { type: 'Lipstick', country: 'EU', value: 4376 },
          { type: 'Lipstick', country: 'China', value: 9054 },
          { type: 'Lipstick', country: 'USA', value: 8814 },
          { type: 'Eyeshadows', country: 'Africa', value: 3308 },
          { type: 'Eyeshadows', country: 'EU', value: 4572 },
          { type: 'Eyeshadows', country: 'China', value: 12043 },
          { type: 'Eyeshadows', country: 'USA', value: 12998 },
          { type: 'Eyeliner', country: 'Africa', value: 5432 },
          { type: 'Eyeliner', country: 'EU', value: 3417 },
          { type: 'Eyeliner', country: 'China', value: 15067 },
          { type: 'Eyeliner', country: 'USA', value: 12321 },
          { type: 'Foundation', country: 'Africa', value: 13701 },
          { type: 'Foundation', country: 'EU', value: 5231 },
          { type: 'Foundation', country: 'China', value: 10119 },
          { type: 'Foundation', country: 'USA', value: 10342 },
          { type: 'Lip gloss', country: 'Africa', value: 4008 },
          { type: 'Lip gloss', country: 'EU', value: 4572 },
          { type: 'Lip gloss', country: 'China', value: 12043 },
          { type: 'Lip gloss', country: 'USA', value: 22998 },
          { type: 'Mascara', country: 'Africa', value: 18712 },
          { type: 'Mascara', country: 'EU', value: 6134 },
          { type: 'Mascara', country: 'China', value: 10419 },
          { type: 'Mascara', country: 'USA', value: 11261 }
        ]
      },
      title: {
        visible: true,
        text: '100% stacked line chart of cosmetic products sales'
      },
      stack: true,
      xField: 'type',
      yField: 'value',
      seriesField: 'country',
      legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
      axes: [
        {
          orient: 'left',
          label: {
            formatMethod: (val: string | string[]) => {
              return `${(+val * 100).toFixed(2)}%`;
            }
          }
        }
      ],
      totalLabel: {
        visible: true
      },
      point: {
        visible: false
      },
      label: {
        visible: true
      }
    };
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        width: 600,
        height: 600
      },
      false
    );

    expect(updateRes).toEqual({
      changeBackground: false,
      change: true,
      changeTheme: false,
      reCompile: false,
      reMake: false,
      reRender: true,
      reSize: true,
      reTransformSpec: false
    });
  });
});

describe('vchart updateSpec of different axes', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterAll(() => {
    removeDom(container);
    vchart.release();
  });

  it('should remake when label is in series update', () => {
    const spec: ILineChartSpec = {
      type: 'line',
      data: {
        values: [
          {
            time: '2:00',
            value: 38
          },
          {
            time: '4:00',
            value: 56
          },
          {
            time: '6:00',
            value: 10
          },
          {
            time: '8:00',
            value: 70
          },
          {
            time: '10:00',
            value: 36
          },
          {
            time: '12:00',
            value: 94
          },
          {
            time: '14:00',
            value: 24
          },
          {
            time: '16:00',
            value: 44
          },
          {
            time: '18:00',
            value: 36
          },
          {
            time: '20:00',
            value: 68
          },
          {
            time: '22:00',
            value: 22
          }
        ]
      },
      xField: 'time',
      yField: 'value',
      line: {
        style: {
          curveType: 'monotone'
        }
      },
      axes: [{ orient: 'bottom', label: { style: { fill: 'red' } } }]
    };

    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        axes: [
          {
            ...(spec.axes as any)[0],
            visible: false
          }
        ]
      } as any,
      false
    );

    expect(updateRes).toEqual({
      change: false,
      changeBackground: false,
      changeTheme: false,
      reCompile: true,
      reMake: true,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });
});

describe('vchart updateSpec of different title', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterAll(() => {
    removeDom(container);
    vchart.release();
  });

  it('should reMake when `visible` of title change from `true` to `false`', () => {
    const spec = {
      type: 'area',
      data: [
        {
          id: 'area',
          values: [
            { x: '1990', y: 110, from: 'video ad' },
            { x: '1995', y: 160, from: 'video ad' },
            { x: '2000', y: 230, from: 'video ad' },
            { x: '2005', y: 300, from: 'video ad' },
            { x: '2010', y: 448, from: 'video ad' },
            { x: '2015', y: 500, from: 'video ad' },
            { x: '1990', y: 120, from: 'email marketing' },
            { x: '1995', y: 150, from: 'email marketing' },
            { x: '2000', y: 200, from: 'email marketing' },
            { x: '2005', y: 210, from: 'email marketing' },
            { x: '2010', y: 300, from: 'email marketing' },
            { x: '2015', y: 320, from: 'email marketing' }
          ]
        }
      ],
      title: {
        visible: true,
        text: 'test'
      },
      xField: 'x',
      yField: 'y',
      seriesField: 'from'
    };
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        title: {
          visible: false
        }
      },
      false
    );

    expect(updateRes).toEqual({
      changeBackground: false,
      change: true,
      changeTheme: false,
      reCompile: true,
      reMake: true,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });

  it('should reMake when `visible` of title change from `false` to `true`', () => {
    const spec = {
      type: 'area',
      data: [
        {
          id: 'area',
          values: [
            { x: '1990', y: 110, from: 'video ad' },
            { x: '1995', y: 160, from: 'video ad' },
            { x: '2000', y: 230, from: 'video ad' },
            { x: '2005', y: 300, from: 'video ad' },
            { x: '2010', y: 448, from: 'video ad' },
            { x: '2015', y: 500, from: 'video ad' },
            { x: '1990', y: 120, from: 'email marketing' },
            { x: '1995', y: 150, from: 'email marketing' },
            { x: '2000', y: 200, from: 'email marketing' },
            { x: '2005', y: 210, from: 'email marketing' },
            { x: '2010', y: 300, from: 'email marketing' },
            { x: '2015', y: 320, from: 'email marketing' }
          ]
        }
      ],
      title: {
        visible: false,
        text: 'test'
      },
      xField: 'x',
      yField: 'y',
      seriesField: 'from'
    };
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        title: {
          visible: true
        }
      },
      false
    );

    expect(updateRes).toEqual({
      changeBackground: false,
      change: false,
      changeTheme: false,
      reCompile: false,
      reMake: true,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });
});

describe('vchart updateSpec of different indicator', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart;
  beforeAll(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterAll(() => {
    removeDom(container);
    vchart.release();
  });

  it('should reMake when `visible` of indicator change to `false`', () => {
    const spec = {
      type: 'area',
      data: [
        {
          id: 'area',
          values: [
            { x: '1990', y: 110, from: 'video ad' },
            { x: '1995', y: 160, from: 'video ad' },
            { x: '2000', y: 230, from: 'video ad' },
            { x: '2005', y: 300, from: 'video ad' },
            { x: '2010', y: 448, from: 'video ad' },
            { x: '2015', y: 500, from: 'video ad' },
            { x: '1990', y: 120, from: 'email marketing' },
            { x: '1995', y: 150, from: 'email marketing' },
            { x: '2000', y: 200, from: 'email marketing' },
            { x: '2005', y: 210, from: 'email marketing' },
            { x: '2010', y: 300, from: 'email marketing' },
            { x: '2015', y: 320, from: 'email marketing' }
          ]
        }
      ],
      title: {
        visible: true,
        text: 'test'
      },
      xField: 'x',
      yField: 'y',
      seriesField: 'from',
      indicator: {
        title: {
          visible: true,
          style: {
            text: 'bbb'
          }
        },
        content: [
          {
            visible: true,
            style: {
              fontSize: 20,
              text: '2222'
            }
          }
        ]
      }
    };
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        indicator: {
          ...spec.indicator,
          visible: false
        }
      },
      false
    );

    expect(updateRes).toEqual({
      changeBackground: false,
      change: true,
      changeTheme: false,
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });

  it('should reMake when `visible` of indicator change from `false` to `true`', () => {
    const spec = {
      type: 'area',
      data: [
        {
          id: 'area',
          values: [
            { x: '1990', y: 110, from: 'video ad' },
            { x: '1995', y: 160, from: 'video ad' },
            { x: '2000', y: 230, from: 'video ad' },
            { x: '2005', y: 300, from: 'video ad' },
            { x: '2010', y: 448, from: 'video ad' },
            { x: '2015', y: 500, from: 'video ad' },
            { x: '1990', y: 120, from: 'email marketing' },
            { x: '1995', y: 150, from: 'email marketing' },
            { x: '2000', y: 200, from: 'email marketing' },
            { x: '2005', y: 210, from: 'email marketing' },
            { x: '2010', y: 300, from: 'email marketing' },
            { x: '2015', y: 320, from: 'email marketing' }
          ]
        }
      ],
      title: {
        visible: true,
        text: 'test'
      },
      xField: 'x',
      yField: 'y',
      seriesField: 'from',
      indicator: {
        title: {
          visible: false,
          style: {
            text: 'bbb'
          }
        },
        content: [
          {
            visible: true,
            style: {
              fontSize: 20,
              text: '2222'
            }
          }
        ]
      }
    };
    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
    const updateRes = (vchart as any)._updateSpec(
      {
        ...spec,
        indicator: {
          ...spec.indicator,
          visible: true
        }
      },
      false
    );

    expect(updateRes).toEqual({
      changeBackground: false,
      change: true,
      changeTheme: false,
      reCompile: true,
      reMake: false,
      reRender: true,
      reSize: false,
      reTransformSpec: false
    });
  });
});
