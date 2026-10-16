import VChart, {
  ManualTicker,
  registerStateTransition,
  type IBarChartSpec,
  type IChart,
  type ILineChartSpec,
  type IMark,
  type IMarkGraphic,
  type IPieChartSpec,
  type ISeries,
  type IWordCloudChartSpec
} from '../../../src';
import { createDiv, removeDom } from '../../util/dom';

registerStateTransition();

type AnimatedGraphic = IMarkGraphic & {
  attribute: Record<string, any>;
  baseAttributes?: Record<string, any>;
  finalAttribute?: Record<string, any>;
  getFinalAttribute?: () => Record<string, any> | undefined;
};

type TraversableGraphic = AnimatedGraphic & {
  type?: string;
  name?: string;
  parent?: TraversableGraphic;
  forEachChildren?: (cb: (child: TraversableGraphic) => void | boolean) => void;
};

const APPEAR_DURATION = 300;
const UPDATE_DURATION = 300;
const MARKER_DURATION = 800;
const MARKER_EXIT_DURATION = 1800;
const COLOR_BY_SERIES: Record<string, string> = {
  'east-利润profit': '#8D72F6',
  'east-销售量sales': '#5766EC',
  'north of east-利润profit': '#66A3FE',
  'north of east-销售量sales': '#51D5E6'
};

const createChartContainer = () => {
  const container = createDiv();
  const dom = createDiv(container);

  container.style.position = 'fixed';
  container.style.width = '500px';
  container.style.height = '500px';
  container.style.top = '0px';
  container.style.left = '0px';

  return { container, dom };
};

const createManualTicker = () => {
  const ticker = new ManualTicker();

  ticker.autoStop = false;

  return ticker;
};

const getGraphicFinalAttribute = (graphic: AnimatedGraphic) =>
  graphic.finalAttribute ?? graphic.getFinalAttribute?.() ?? {};

const expectClose = (actual: number, expected: number) => {
  expect(actual).toBeCloseTo(expected, 6);
};

const expectBarYLayout = (graphic: AnimatedGraphic, expected: { y: number; y1: number }) => {
  expectClose(graphic.attribute.y, expected.y);
  expectClose(graphic.attribute.y1, expected.y1);
  expectClose(graphic.baseAttributes?.y, expected.y);
  expectClose(graphic.baseAttributes?.y1, expected.y1);
  expectClose(getGraphicFinalAttribute(graphic).y, expected.y);
  expectClose(getGraphicFinalAttribute(graphic).y1, expected.y1);
};

const getBarGraphics = (chart: VChart) => {
  const model = chart.getChart() as IChart;
  const barSeries = model.getAllSeries().find((series: ISeries) => series.type === 'bar');

  expect(barSeries).toBeDefined();
  if (!barSeries) {
    throw new Error('Expected bar series to exist');
  }

  const barMark = barSeries.getMarks().find((mark: IMark) => mark.name === 'bar');

  expect(barMark).toBeDefined();
  if (!barMark) {
    throw new Error('Expected bar mark to exist');
  }

  return barMark.getGraphics() as AnimatedGraphic[];
};

const getLineGraphics = (chart: VChart) => {
  const model = chart.getChart() as IChart;
  const lineSeries = model.getAllSeries().find((series: ISeries) => series.type === 'line');

  expect(lineSeries).toBeDefined();
  if (!lineSeries) {
    throw new Error('Expected line series to exist');
  }

  const lineMark = lineSeries.getMarks().find((mark: IMark) => mark.name === 'line');

  expect(lineMark).toBeDefined();
  if (!lineMark) {
    throw new Error('Expected line mark to exist');
  }

  return lineMark.getGraphics() as AnimatedGraphic[];
};

const getPointGraphics = (chart: VChart) => {
  const model = chart.getChart() as IChart;
  const lineSeries = model.getAllSeries().find((series: ISeries) => series.type === 'line');

  expect(lineSeries).toBeDefined();
  if (!lineSeries) {
    throw new Error('Expected line series to exist');
  }

  const pointMark = lineSeries.getMarks().find((mark: IMark) => mark.name === 'point');

  expect(pointMark).toBeDefined();
  if (!pointMark) {
    throw new Error('Expected point mark to exist');
  }

  return pointMark.getGraphics() as AnimatedGraphic[];
};

const getWordGraphics = (chart: VChart) => {
  const model = chart.getChart() as IChart;
  const wordCloudSeries = model.getAllSeries().find((series: ISeries) => series.type === 'wordCloud');

  expect(wordCloudSeries).toBeDefined();
  if (!wordCloudSeries) {
    throw new Error('Expected wordCloud series to exist');
  }

  const wordMark = wordCloudSeries.getMarks().find((mark: IMark) => mark.name === 'word');

  expect(wordMark).toBeDefined();
  if (!wordMark) {
    throw new Error('Expected word mark to exist');
  }

  return wordMark.getGraphics() as AnimatedGraphic[];
};

const walkGraphics = (root: TraversableGraphic, visitor: (graphic: TraversableGraphic) => void) => {
  visitor(root);
  root.forEachChildren?.((child: TraversableGraphic) => {
    walkGraphics(child, visitor);
  });
};

const getAnimatedLabelTexts = (chart: VChart) => {
  const texts: TraversableGraphic[] = [];

  walkGraphics(chart.getStage() as unknown as TraversableGraphic, graphic => {
    if (graphic.type === 'text' && graphic.baseAttributes && getGraphicFinalAttribute(graphic).x !== undefined) {
      texts.push(graphic);
    }
  });

  return texts;
};

const getScatterDataLabels = (chart: VChart) =>
  getAnimatedLabelTexts(chart).filter(graphic => {
    return typeof graphic.attribute?.text === 'number' && getGraphicFinalAttribute(graphic).x !== undefined;
  });

const getLabelTextByFill = (chart: VChart, fill: string) => {
  const label = getAnimatedLabelTexts(chart).find(graphic => graphic.attribute.fill === fill);

  expect(label).toBeDefined();
  if (!label) {
    throw new Error(`Expected label with fill ${fill} to exist`);
  }

  return label;
};

const getVisibleBarByFill = (chart: VChart, fill: string) => {
  const bar = getBarGraphics(chart).find(
    graphic => graphic.attribute.fill === fill && graphic.attribute.visible !== false
  );

  expect(bar).toBeDefined();
  if (!bar) {
    throw new Error(`Expected visible bar with fill ${fill} to exist`);
  }

  return bar;
};

const getBarGraphicByKey = (chart: VChart, key: string) => {
  const bar = getBarGraphics(chart).find(graphic => graphic.context?.key === key);

  expect(bar).toBeDefined();
  if (!bar) {
    throw new Error(`Expected bar with key ${key} to exist`);
  }

  return bar;
};

const getGraphicDatum = (graphic: AnimatedGraphic) => {
  const data = graphic.context?.data;

  return Array.isArray(data) ? data[0] : data;
};

const getStateDatum = (datum: any) => (Array.isArray(datum) ? datum[0] : datum);

const createCustomGroupSpec = (x: number): IBarChartSpec =>
  ({
    type: 'bar',
    data: [
      {
        id: 'data',
        values: [{ x: 'A', y: 1 }]
      }
    ],
    xField: 'x',
    yField: 'y',
    animation: true,
    customMark: [
      {
        type: 'group',
        name: 'customGroup',
        animation: true,
        animationUpdate: false,
        style: {
          x,
          y: 20,
          width: 40,
          height: 30
        }
      }
    ]
  } as unknown as IBarChartSpec);

const getCustomGroupGraphic = (chart: VChart) => {
  const mark = (chart.getChart() as any).getAllMarks().find((m: IMark) => m.name === 'customGroup');

  expect(mark).toBeDefined();
  if (!mark) {
    throw new Error('Expected custom group mark to exist');
  }

  const group = mark.getGraphics?.()[0] as AnimatedGraphic;

  expect(group).toBeDefined();
  if (!group) {
    throw new Error('Expected custom group graphic to exist');
  }

  return group;
};

const getBarGraphicByDatum = (chart: VChart, predicate: (datum: any) => boolean) => {
  const bar = getBarGraphics(chart).find(graphic => predicate(getGraphicDatum(graphic)));

  expect(bar).toBeDefined();
  if (!bar) {
    throw new Error('Expected bar with matching datum to exist');
  }

  return bar;
};

const getBarCenterX = (graphic: AnimatedGraphic) => {
  const attrs = getGraphicFinalAttribute(graphic);

  return attrs.x + attrs.width / 2;
};

const expectStaticXLayout = (graphic: AnimatedGraphic, expectedX: number) => {
  expectClose(graphic.baseAttributes?.x, expectedX);
  expectClose(getGraphicFinalAttribute(graphic).x, expectedX);
};

const expectStaticRectLayout = (
  graphic: AnimatedGraphic,
  expected: { x: number; width: number; y: number; y1: number }
) => {
  expectClose(graphic.attribute.x, expected.x);
  expectClose(graphic.attribute.width, expected.width);
  expectClose(graphic.attribute.y, expected.y);
  expectClose(graphic.attribute.y1, expected.y1);
  expectClose(graphic.baseAttributes?.x, expected.x);
  expectClose(graphic.baseAttributes?.width, expected.width);
  expectClose(graphic.baseAttributes?.y, expected.y);
  expectClose(graphic.baseAttributes?.y1, expected.y1);
  expectClose(getGraphicFinalAttribute(graphic).x, expected.x);
  expectClose(getGraphicFinalAttribute(graphic).width, expected.width);
  expectClose(getGraphicFinalAttribute(graphic).y, expected.y);
  expectClose(getGraphicFinalAttribute(graphic).y1, expected.y1);
};

const simplifyPoints = (points: any[] = []) =>
  points.map(point => ({
    x: point.x,
    y: point.y,
    context: point.context
  }));

const expectPointsLayout = (actual: any[], expected: ReturnType<typeof simplifyPoints>) => {
  expect(actual.length).toBe(expected.length);
  actual.forEach((point, index) => {
    expectClose(point.x, expected[index].x);
    expectClose(point.y, expected[index].y);
    expect(point.context).toBe(expected[index].context);
  });
};

const expectLinePointsLayout = (graphic: AnimatedGraphic, expected: ReturnType<typeof simplifyPoints>) => {
  expectPointsLayout(graphic.attribute.points, expected);
  expectPointsLayout(graphic.baseAttributes?.points, expected);
  expectPointsLayout(getGraphicFinalAttribute(graphic).points, expected);
};

const getBarMarkProduct = (chart: VChart) => {
  const model = chart.getChart() as IChart;
  const barSeries = model.getAllSeries().find((series: ISeries) => series.type === 'bar');

  expect(barSeries).toBeDefined();
  if (!barSeries) {
    throw new Error('Expected bar series to exist');
  }

  const barMark = barSeries.getMarks().find((mark: IMark) => mark.name === 'bar') as IMark & {
    getProduct?: () => AnimatedGraphic;
  };

  expect(barMark).toBeDefined();
  if (!barMark?.getProduct) {
    throw new Error('Expected bar mark product to exist');
  }

  return barMark.getProduct();
};

const getBarClipPathRects = (chart: VChart) =>
  ((getBarMarkProduct(chart).attribute.path ?? []) as AnimatedGraphic[]).map(
    path => path.baseAttributes ?? path.attribute
  );

const getBarClipPathGraphics = (chart: VChart) => (getBarMarkProduct(chart).attribute.path ?? []) as AnimatedGraphic[];

const getPieGraphics = (chart: VChart) => {
  const model = chart.getChart() as IChart;
  const pieSeries = model.getAllSeries().find((series: ISeries) => series.type === 'pie');

  expect(pieSeries).toBeDefined();
  if (!pieSeries) {
    throw new Error('Expected pie series to exist');
  }

  const pieMark = pieSeries.getMarks().find((mark: IMark) => mark.name === 'pie');

  expect(pieMark).toBeDefined();
  if (!pieMark) {
    throw new Error('Expected pie mark to exist');
  }

  return pieMark.getGraphics() as AnimatedGraphic[];
};

const clickLegendItem = (chart: VChart, index: number) => {
  const legendModel = chart.getComponents().find((component: any) => component.type === 'discreteLegend') as any;
  const legendComponent = legendModel?._legendComponent;
  const legendItem = legendComponent?._itemsContainer?.getChildren?.()[index];

  if (!legendComponent?._onClick || !legendItem) {
    throw new Error(`Expected legend item ${index} to exist`);
  }

  legendComponent._onClick({
    target: legendItem
  });
};

const getMarkerGraphic = (chart: VChart, componentType: 'markPoint' | 'markLine' | 'markArea') => {
  const component = (chart.getChart() as any)?.getComponentsByKey(componentType)?.[0];
  const graphic = component?.getVRenderComponents?.()[0] as TraversableGraphic | undefined;

  expect(graphic).toBeDefined();
  if (!graphic) {
    throw new Error(`Expected ${componentType} component graphic to exist`);
  }

  return graphic;
};

const collectGraphics = (root: TraversableGraphic) => {
  const graphics: TraversableGraphic[] = [];

  walkGraphics(root, graphic => {
    graphics.push(graphic);
  });

  return graphics;
};

const isGraphicAttached = (graphic: TraversableGraphic) => Boolean(graphic.parent || (graphic as any).stage);

const isIntermediateOpacity = (value: unknown) => typeof value === 'number' && value > 0 && value < 1;

const hasIntermediateFade = (graphic: TraversableGraphic) =>
  isIntermediateOpacity(graphic.attribute?.fillOpacity) || isIntermediateOpacity(graphic.attribute?.strokeOpacity);

const expectMarkerExitFade = (
  chart: VChart,
  ticker: ManualTicker,
  markerGraphic: TraversableGraphic,
  removeMarkerSpec: () => any
) => {
  const trackedGraphics = collectGraphics(markerGraphic).filter(graphic => graphic !== markerGraphic);

  expect(trackedGraphics.length).toBeGreaterThan(0);

  chart.updateSpecSync(removeMarkerSpec());

  const exitStart = ticker.getTime();

  ticker.tickAt(exitStart + MARKER_EXIT_DURATION / 2);

  expect(trackedGraphics.some(isGraphicAttached)).toBe(true);
  expect(trackedGraphics.some(graphic => isGraphicAttached(graphic) && hasIntermediateFade(graphic))).toBe(true);

  ticker.tickAt(exitStart + MARKER_EXIT_DURATION + 50);

  expect(trackedGraphics.some(isGraphicAttached)).toBe(false);
};

const createDocBarDatum = (country: string, value: number, measure = 'share_global_co2') => ({
  country,
  __OriginalData__: {
    country,
    [measure]: value
  },
  [measure]: value,
  __MeaId__: measure,
  __MeaName__: measure,
  __MeaValue__: value,
  __Dim_Y__: country,
  __Dim_Color__: measure,
  __Dim_Detail__: measure,
  __Dim_ColorId__: measure
});

const createSameSeriesDocBarSpec = (values: Array<{ country: string; value: number }>) =>
  ({
    type: 'bar',
    direction: 'horizontal',
    width: 500,
    height: 300,
    yField: ['__Dim_Y__'],
    xField: '__MeaValue__',
    seriesField: '__Dim_ColorId__',
    padding: 0,
    region: [
      {
        clip: true
      }
    ],
    animation: true,
    animationAppear: {
      duration: APPEAR_DURATION,
      easing: 'linear'
    },
    animationUpdate: {
      duration: UPDATE_DURATION,
      easing: 'linear'
    },
    color: {
      type: 'ordinal',
      domain: ['share_global_co2'],
      range: ['#F0A868']
    },
    background: 'transparent',
    data: {
      id: 'barParallel',
      values: values.map(item => createDocBarDatum(item.country, item.value))
    },
    large: false,
    label: {
      visible: true,
      animationUpdate: {
        duration: UPDATE_DURATION,
        easing: 'linear'
      }
    },
    axes: [
      { orient: 'bottom', visible: false },
      { orient: 'left', visible: false }
    ]
  } as unknown as IBarChartSpec);

const createSeriesChangeDocBarSpec = (mode: 'grouped' | 'single') => {
  const countries = mode === 'grouped' ? ['United States', 'China', 'India'] : ['China', 'United States', 'India'];
  const values = countries.flatMap((country, countryIndex) => {
    const base = 30 - countryIndex * 5;

    if (mode === 'single') {
      return [createDocBarDatum(country, base, 'share_global_co2')];
    }

    return [
      createDocBarDatum(country, base, 'share_global_co2'),
      createDocBarDatum(country, base + 10, 'share_global_cumulative_co2')
    ];
  });

  return {
    ...createSameSeriesDocBarSpec([]),
    yField: mode === 'grouped' ? ['__Dim_Y__', '__Dim_Detail__'] : ['__Dim_Y__'],
    color: {
      type: 'ordinal',
      domain: ['share_global_co2', 'share_global_cumulative_co2'],
      range: ['#F0A868', '#7BAA9A']
    },
    data: {
      id: 'barParallel',
      values
    }
  } as unknown as IBarChartSpec;
};

const createPieLegendFilterSpec = (): IPieChartSpec =>
  ({
    type: 'pie',
    width: 500,
    height: 500,
    padding: 0,
    data: [
      {
        id: 'id0',
        values: [
          { group: '0', value: 455, labelValue: '455', dataIndex: 0, seriesIndex: 0, name: '满意' },
          { group: '0', value: 655, labelValue: '655', dataIndex: 1, seriesIndex: 0, name: '一般' },
          { group: '0', value: 160, labelValue: '160', dataIndex: 2, seriesIndex: 0, name: '差评' }
        ]
      }
    ],
    categoryField: 'dataIndex',
    valueField: 'value',
    startAngle: -90,
    endAngle: -90,
    animation: true,
    animationAppear: {
      duration: APPEAR_DURATION,
      easing: 'linear'
    },
    animationUpdate: false,
    animationEnter: false,
    animationExit: false,
    animationDisappear: false,
    legends: {
      orient: 'bottom',
      position: 'middle',
      visible: true,
      allowAllCanceled: false,
      item: {
        visible: true
      }
    },
    pie: {
      state: {
        hover: {
          outerRadius: 1.06
        }
      },
      style: {
        cursor: 'pointer',
        lineWidth: 2
      }
    }
  } as unknown as IPieChartSpec);

const createLineGrowthSpec = (values: Array<{ time: string; value: number }>) =>
  ({
    type: 'line',
    width: 500,
    height: 300,
    xField: 'time',
    yField: 'value',
    padding: 0,
    animation: true,
    animationAppear: {
      duration: APPEAR_DURATION,
      easing: 'linear'
    },
    animationUpdate: {
      duration: UPDATE_DURATION,
      easing: 'linear'
    },
    data: {
      values
    },
    point: {
      visible: false
    },
    axes: [
      { orient: 'left', visible: false },
      { orient: 'bottom', visible: false }
    ]
  } as ILineChartSpec);

const createStateFilteredLineGrowthSpec = (
  values: Array<{ time: string; value: number }>,
  strokeOpacity = 1,
  stroke = '#6690F2'
) =>
  ({
    ...createLineGrowthSpec(values),
    color: {
      type: 'ordinal',
      domain: ['value'],
      range: [stroke],
      specified: {
        value: stroke
      }
    },
    line: {
      style: {},
      state: {
        custom1: {
          level: 1,
          filter: () => true,
          style: {
            visible: true,
            curveType: 'linear',
            curveTension: 0,
            strokeOpacity,
            lineWidth: 3,
            lineDash: [0, 0]
          }
        }
      }
    }
  } as ILineChartSpec);

const cosmeticLineValues = [
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
];

const createCosmeticPercentLineSpec = () =>
  ({
    type: 'line',
    width: 500,
    height: 300,
    data: {
      values: cosmeticLineValues
    },
    percent: true,
    xField: 'type',
    yField: 'value',
    seriesField: 'country',
    animation: true,
    animationAppear: {
      duration: APPEAR_DURATION,
      easing: 'linear'
    },
    animationUpdate: {
      duration: UPDATE_DURATION,
      easing: 'linear'
    },
    legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
    axes: [
      {
        orient: 'left',
        label: {
          formatMethod: (val: string | string[]) => `${(+val * 100).toFixed(2)}%`
        }
      }
    ]
  } as ILineChartSpec);

const createStateSwitchSpec = (valueOffset = 0) =>
  ({
    type: 'bar',
    width: 400,
    height: 300,
    data: {
      values: [
        { date: '2019', value: 20 + valueOffset },
        { date: '2020', value: 24 + valueOffset },
        { date: '2021', value: 28 + valueOffset }
      ]
    },
    xField: 'date',
    yField: 'value',
    animation: true,
    animationAppear: {
      duration: APPEAR_DURATION,
      easing: 'linear'
    },
    animationUpdate: {
      duration: UPDATE_DURATION,
      easing: 'linear'
    },
    animationState: {
      duration: UPDATE_DURATION,
      easing: 'linear'
    },
    bar: {
      state: {
        custom1: {
          fillOpacity: 0.2
        }
      }
    },
    axes: [
      { orient: 'left', visible: false },
      { orient: 'bottom', visible: false }
    ]
  } as unknown as IBarChartSpec);

const createStateFilterSwitchSpec = (highlightDate = '2019', stateOpacity = 0.2) =>
  ({
    type: 'bar',
    direction: 'horizontal',
    width: 400,
    height: 300,
    yField: 'date',
    xField: 'value',
    animation: true,
    animationAppear: {
      duration: APPEAR_DURATION,
      easing: 'linear'
    },
    animationUpdate: {
      duration: UPDATE_DURATION,
      easing: 'linear'
    },
    animationState: {
      duration: UPDATE_DURATION,
      easing: 'linear'
    },
    data: {
      values: [
        { date: '2019', value: 20 },
        { date: '2020', value: 24 },
        { date: '2021', value: 28 },
        { date: '2022', value: 22 },
        { date: '2023', value: 26 }
      ]
    },
    bar: {
      style: {
        fillOpacity: 1
      },
      state: {
        custom1: {
          level: 1,
          filter: () => true,
          style: {
            fillOpacity: stateOpacity
          }
        },
        custom2: {
          level: 2,
          filter: (datum: any) => datum.date === highlightDate,
          style: {
            fillOpacity: 1
          }
        }
      }
    },
    axes: [
      { orient: 'left', visible: false },
      { orient: 'bottom', visible: false }
    ]
  } as unknown as IBarChartSpec);

const createMarkerLineData = () => [
  { year: '2019', value: 10 },
  { year: '2020', value: 18 },
  { year: '2021', value: 14 },
  { year: '2022', value: 22 }
];

const createMarkPointExitSpec = (visible = true) =>
  ({
    type: 'line',
    width: 500,
    height: 300,
    xField: 'year',
    yField: 'value',
    animation: true,
    data: {
      values: createMarkerLineData()
    },
    point: {
      visible: false
    },
    markPoint: visible
      ? [
          {
            animation: {
              type: 'callIn',
              duration: MARKER_DURATION,
              easing: 'linear'
            },
            animationExit: {
              type: 'fadeOut',
              duration: MARKER_EXIT_DURATION,
              easing: 'linear'
            },
            coordinate: {
              year: '2022',
              value: 22
            },
            itemContent: {
              type: 'text',
              text: {
                text: '2022',
                style: {
                  fill: '#E8346D'
                }
              },
              offsetY: 40
            },
            itemLine: {
              type: 'type-do',
              line: {
                style: {
                  stroke: '#E8346D'
                }
              }
            }
          }
        ]
      : []
  } as any);

const createDifferenceMarkLineSpec = (visible = true) =>
  ({
    type: 'bar',
    width: 500,
    height: 300,
    data: [
      {
        id: 'barData',
        values: [
          { type: 'Autocracies', year: '1930', value: 129 },
          { type: 'Autocracies', year: '2000', value: 89 },
          { type: 'Democracies', year: '1930', value: 22 },
          { type: 'Democracies', year: '2000', value: 87 }
        ]
      }
    ],
    xField: ['year', 'type'],
    yField: 'value',
    seriesField: 'type',
    animation: true,
    markLine: visible
      ? [
          {
            type: 'type-step',
            connectDirection: 'top',
            expandDistance: 30,
            coordinates: [
              { type: 'Autocracies', year: '1930', value: 129 },
              { type: 'Autocracies', year: '2000', value: 89 }
            ],
            coordinatesOffset: [
              { x: 0, y: 0 },
              { x: -5, y: 0 }
            ],
            line: {
              style: {
                lineDash: [0],
                lineWidth: 2,
                stroke: '#000',
                cornerRadius: 4
              }
            },
            label: {
              text: '-45%',
              position: 'middle',
              style: {
                fill: '#000'
              }
            },
            endSymbol: {
              size: 12,
              refX: -4
            },
            animation: {
              type: 'clipIn',
              duration: MARKER_DURATION,
              easing: 'linear'
            },
            animationExit: {
              type: 'fadeOut',
              duration: MARKER_EXIT_DURATION,
              easing: 'linear'
            }
          }
        ]
      : []
  } as any);

const createMarkAreaExitSpec = (visible = true) =>
  ({
    type: 'line',
    width: 500,
    height: 300,
    xField: 'date',
    yField: 'price',
    animation: true,
    data: {
      values: [
        { date: 'Jan-20', price: 0.134 },
        { date: 'Feb-20', price: 0.134 },
        { date: 'Mar-20', price: 0.136 },
        { date: 'Mar-23', price: 0.166 }
      ]
    },
    point: {
      visible: false
    },
    axes: [
      { orient: 'left', min: 0.12, max: 0.18, visible: false },
      { orient: 'bottom', visible: false }
    ],
    markArea: visible
      ? [
          {
            coordinates: [
              { date: 'Jan-20', price: 0.18 },
              { date: 'Mar-23', price: 0.18 },
              { date: 'Mar-23', price: 0.12 },
              { date: 'Jan-20', price: 0.12 }
            ],
            animation: {
              type: 'fadeIn',
              duration: MARKER_DURATION,
              easing: 'linear'
            },
            animationExit: {
              type: 'fadeOut',
              duration: MARKER_EXIT_DURATION,
              easing: 'linear'
            },
            label: {
              text: 'Electricite prices have surged since 2020',
              position: 'insideTop'
            }
          }
        ]
      : []
  } as any);

const createRegularMarkLineExitSpec = (visible = true) =>
  ({
    type: 'scatter',
    width: 500,
    height: 300,
    padding: [12, 20, 12, 12],
    xField: 'x',
    yField: 'y',
    sizeField: 'z',
    size: {
      type: 'linear',
      range: [20, 80]
    },
    animation: true,
    data: {
      id: 'data',
      values: [
        { x: 95, y: 95, z: 13.8, name: 'BE', country: 'Belgium' },
        { x: 65.5, y: 126.4, z: 35.3, name: 'US', country: 'United States' },
        { x: 63.4, y: 51.8, z: 15.4, name: 'PT', country: 'Portugal' }
      ]
    },
    axes: [
      { orient: 'bottom', type: 'linear', min: 60, max: 95, visible: false },
      { orient: 'left', type: 'linear', min: 0, max: 200, visible: false }
    ],
    markLine: visible
      ? [
          {
            x: 65,
            label: {
              visible: true,
              position: 'end',
              text: 'Safe fat intake 65g/day',
              labelBackground: {
                visible: false
              }
            },
            line: {
              style: {
                stroke: '#000',
                lineDash: [0]
              }
            },
            animation: {
              type: 'clipIn',
              duration: MARKER_DURATION,
              easing: 'linear'
            },
            animationExit: {
              type: 'fadeOut',
              duration: MARKER_EXIT_DURATION,
              easing: 'linear'
            }
          }
        ]
      : []
  } as any);

const createScatterMarkLineRemovalSpec = (visible = true) =>
  ({
    type: 'scatter',
    width: 500,
    height: 300,
    padding: [12, 20, 12, 12],
    xField: 'x',
    yField: 'y',
    sizeField: 'z',
    size: {
      type: 'linear',
      range: [20, 80]
    },
    animation: true,
    data: {
      id: 'data',
      values: [
        { x: 95, y: 95, z: 13.8, name: 'BE', country: 'Belgium' },
        { x: 65.5, y: 126.4, z: 35.3, name: 'US', country: 'United States' },
        { x: 63.4, y: 51.8, z: 15.4, name: 'PT', country: 'Portugal' },
        { x: 76.7, y: 116.4, z: 31.3, name: 'NO', country: 'Norway' },
        { x: 80.1, y: 93.6, z: 18.7, name: 'DE', country: 'Germany' },
        { x: 72.2, y: 84.5, z: 20.2, name: 'FR', country: 'France' },
        { x: 68.9, y: 110.2, z: 24.8, name: 'GB', country: 'United Kingdom' },
        { x: 83.4, y: 75.2, z: 14.5, name: 'NL', country: 'Netherlands' },
        { x: 88.6, y: 66.3, z: 17.9, name: 'SE', country: 'Sweden' },
        { x: 70.5, y: 140.1, z: 28.4, name: 'ES', country: 'Spain' },
        { x: 78.3, y: 99.9, z: 21.8, name: 'IT', country: 'Italy' },
        { x: 61.2, y: 58.7, z: 12.3, name: 'IE', country: 'Ireland' },
        { x: 90.3, y: 88.4, z: 16.7, name: 'DK', country: 'Denmark' },
        { x: 74.8, y: 122.6, z: 25.1, name: 'FI', country: 'Finland' },
        { x: 66.6, y: 101.5, z: 19.9, name: 'AT', country: 'Austria' }
      ]
    },
    label: {
      visible: true
    },
    axes: [
      { orient: 'bottom', type: 'linear', min: 60, max: 95, visible: false },
      { orient: 'left', type: 'linear', min: 0, max: 200, visible: false }
    ],
    markLine: visible
      ? [
          {
            x: 65,
            label: {
              visible: true,
              position: 'end',
              text: 'Safe fat intake 65g/day',
              labelBackground: {
                visible: false
              }
            },
            line: {
              style: {
                stroke: '#000',
                lineDash: [0]
              }
            },
            animation: {
              type: 'clipIn',
              duration: MARKER_DURATION,
              easing: 'linear'
            },
            animationExit: {
              type: 'fadeOut',
              duration: MARKER_EXIT_DURATION,
              easing: 'linear'
            }
          }
        ]
      : []
  } as any);

const createStackCornerLegendSpec = () =>
  ({
    type: 'bar',
    direction: 'vertical',
    width: 500,
    height: 300,
    xField: ['date', '__DimGroup__'],
    yField: '__MeaValue__',
    seriesField: '__DimGroupID__',
    padding: 0,
    region: [
      {
        clip: true
      }
    ],
    animation: true,
    animationAppear: {
      duration: APPEAR_DURATION,
      easing: 'linear'
    },
    animationUpdate: {
      duration: UPDATE_DURATION,
      easing: 'linear'
    },
    stackCornerRadius: [4, 4, 0, 0],
    color: {
      type: 'ordinal',
      domain: Object.keys(COLOR_BY_SERIES),
      range: Object.values(COLOR_BY_SERIES),
      specified: {}
    },
    data: {
      values: [
        {
          date: '2019',
          region: 'east',
          __OriginalData__: {
            date: '2019',
            region: 'east',
            profit: 10,
            sales: 20
          },
          profit: 10,
          __MeaId__: 'profit',
          __MeaName__: '利润',
          __MeaValue__: 10,
          __DimGroup__: 'east-利润',
          __DimGroupID__: 'east-利润profit'
        },
        {
          date: '2019',
          region: 'east',
          __OriginalData__: {
            date: '2019',
            region: 'east',
            profit: 10,
            sales: 20
          },
          sales: 20,
          __MeaId__: 'sales',
          __MeaName__: '销售量',
          __MeaValue__: 20,
          __DimGroup__: 'east-销售量',
          __DimGroupID__: 'east-销售量sales'
        },
        {
          date: '2019',
          region: 'north of east',
          __OriginalData__: {
            date: '2019',
            region: 'north of east',
            profit: 10,
            sales: 20
          },
          profit: 10,
          __MeaId__: 'profit',
          __MeaName__: '利润',
          __MeaValue__: 10,
          __DimGroup__: 'north of east-利润',
          __DimGroupID__: 'north of east-利润profit'
        },
        {
          date: '2019',
          region: 'north of east',
          __OriginalData__: {
            date: '2019',
            region: 'north of east',
            profit: 10,
            sales: 20
          },
          sales: 20,
          __MeaId__: 'sales',
          __MeaName__: '销售量',
          __MeaValue__: 20,
          __DimGroup__: 'north of east-销售量',
          __DimGroupID__: 'north of east-销售量sales'
        }
      ]
    },
    label: {
      visible: true,
      animationUpdate: {
        duration: UPDATE_DURATION,
        easing: 'linear'
      }
    },
    legends: {
      type: 'discrete',
      visible: true,
      maxCol: 1,
      maxRow: 1,
      autoPage: true,
      orient: 'right',
      position: 'start',
      item: {
        focus: true,
        background: {
          state: {
            selectedHover: {
              fill: '#646A73',
              fillOpacity: 0.05
            }
          }
        }
      }
    }
  } as unknown as IBarChartSpec);

const createMarkerToggleBarAnimationSpec = (withMarker: boolean): IBarChartSpec =>
  ({
    type: 'bar',
    direction: 'horizontal',
    width: 500,
    height: 300,
    padding: 0,
    animation: true,
    animationAppear: {
      duration: APPEAR_DURATION,
      easing: 'linear'
    },
    animationUpdate: {
      duration: UPDATE_DURATION,
      easing: 'linear'
    },
    dataKey: 'name',
    data: {
      id: 'bar',
      values: withMarker
        ? [
            { name: 'Downtown Connector', value: 56.333333333333336, series: 'peak_delay_min' },
            { name: 'Gate C Harmon', value: 69.5, series: 'peak_delay_min' }
          ]
        : [
            { name: 'Downtown Connector', value: 52.75, series: 'peak_delay_min' },
            { name: 'Gate C Harmon', value: 65.75, series: 'peak_delay_min' }
          ]
    },
    xField: 'value',
    yField: 'name',
    seriesField: 'series',
    axes: [
      {
        orient: 'bottom',
        type: 'linear',
        visible: false
      },
      {
        orient: 'left',
        type: 'band',
        visible: false
      }
    ],
    label: {
      visible: true,
      animationUpdate: {
        duration: UPDATE_DURATION,
        easing: 'linear'
      }
    },
    markPoint: withMarker
      ? [
          {
            coordinate: {
              name: 'Gate C Harmon',
              value: 69.5
            },
            itemLine: {
              visible: true,
              type: 'type-do'
            },
            itemContent: {
              text: {
                text: 'Gate C Harmon'
              },
              offsetY: -24
            },
            animation: {
              type: 'moveIn',
              duration: MARKER_DURATION,
              easing: 'linear'
            },
            animationExit: {
              type: 'fadeOut',
              duration: MARKER_EXIT_DURATION,
              easing: 'linear'
            }
          }
        ]
      : [],
    markLine: [],
    markArea: []
  } as unknown as IBarChartSpec);

const createMarkerPresenceOnlyBarAnimationSpec = (withMarker: boolean): IBarChartSpec =>
  ({
    ...createMarkerToggleBarAnimationSpec(withMarker),
    data: createMarkerToggleBarAnimationSpec(true).data
  } as unknown as IBarChartSpec);

const createWordCloudScaleInSpec = (): IWordCloudChartSpec =>
  ({
    type: 'wordCloud',
    width: 800,
    height: 600,
    nameField: 'name',
    valueField: 'value',
    animationAppear: {
      preset: 'scaleIn',
      duration: 1000,
      totalTime: 3000,
      easing: 'linear'
    },
    word: {
      style: {
        scaleX: 1,
        scaleY: 1
      }
    },
    data: [
      {
        name: 'wordCloud',
        values: [
          { name: '数据', value: 30 },
          { name: '可视化', value: 28 },
          { name: '配置', value: 25 },
          { name: '组件', value: 22 },
          { name: '编辑器', value: 20 },
          { name: '前端', value: 18 }
        ]
      }
    ],
    random: false
  } as IWordCloudChartSpec);

const hasRenderableBarGeometry = (graphic: AnimatedGraphic) => {
  const getAttr = (key: string) =>
    graphic.attribute?.[key] ?? graphic.baseAttributes?.[key] ?? getGraphicFinalAttribute(graphic)[key];

  return (
    isGraphicAttached(graphic as TraversableGraphic) &&
    graphic.attribute?.visible !== false &&
    Number.isFinite(getAttr('x')) &&
    Number.isFinite(getAttr('y')) &&
    (Number.isFinite(getAttr('width')) || Number.isFinite(getAttr('x1'))) &&
    (Number.isFinite(getAttr('height')) || Number.isFinite(getAttr('y1')))
  );
};

describe('manual ticker animation regressions', () => {
  it('keeps custom group final attributes after a prevented update animation', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createCustomGroupSpec(20), {
      dom,
      ticker,
      animation: true
    });

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      chart.updateSpecSync(createCustomGroupSpec(80));

      const group = getCustomGroupGraphic(chart);

      expectClose(group.attribute.x, 80);
      expectClose(group.baseAttributes?.x, 80);
      expectClose(getGraphicFinalAttribute(group).x, 80);
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('keeps pie arc angles stable after legend filtering and hover state changes', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createPieLegendFilterSpec(), {
      dom,
      ticker,
      animation: true
    });

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      chart.setLegendSelectedDataByIndex(0, [0, 1]);
      chart.renderSync();

      const updateStart = ticker.getTime();
      ticker.tickAt(updateStart + UPDATE_DURATION + 50);

      const secondPie = getPieGraphics(chart).find(graphic => graphic.context.data[0]?.dataIndex === 1);
      const expectedStartAngle = -Math.PI / 2 + (Math.PI * 2 * 455) / (455 + 655);
      const expectedEndAngle = -Math.PI / 2 + Math.PI * 2;

      expect(secondPie).toBeDefined();
      if (!secondPie) {
        throw new Error('Expected second pie graphic to exist');
      }

      expectClose(secondPie.attribute.startAngle, expectedStartAngle);
      expectClose(secondPie.attribute.endAngle, expectedEndAngle);
      expectClose(secondPie.baseAttributes?.startAngle, expectedStartAngle);
      expectClose(secondPie.baseAttributes?.endAngle, expectedEndAngle);
      expectClose(getGraphicFinalAttribute(secondPie).startAngle, expectedStartAngle);
      expectClose(getGraphicFinalAttribute(secondPie).endAngle, expectedEndAngle);

      secondPie.useStates(['hover']);
      expectClose(secondPie.attribute.startAngle, expectedStartAngle);
      expectClose(secondPie.attribute.endAngle, expectedEndAngle);

      ticker.tickAt(ticker.getTime() + UPDATE_DURATION + 50);

      expectClose(secondPie.attribute.startAngle, expectedStartAngle);
      expectClose(secondPie.attribute.endAngle, expectedEndAngle);
      expectClose(secondPie.baseAttributes?.startAngle, expectedStartAngle);
      expectClose(secondPie.baseAttributes?.endAngle, expectedEndAngle);
      expectClose(getGraphicFinalAttribute(secondPie).startAngle, expectedStartAngle);
      expectClose(getGraphicFinalAttribute(secondPie).endAngle, expectedEndAngle);
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('runs word cloud scaleIn appear from zero scale', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createWordCloudScaleInSpec(), {
      dom,
      ticker,
      animation: true
    });

    chart.renderSync();

    try {
      const firstWord = getWordGraphics(chart).find(graphic => graphic.context?.graphicIndex === 0);

      expect(firstWord).toBeDefined();
      if (!firstWord) {
        throw new Error('Expected the first word graphic to exist');
      }

      ticker.tickAt(500);

      expect(firstWord.attribute.scaleX).toBeGreaterThan(0);
      expect(firstWord.attribute.scaleX).toBeLessThan(1);
      expect(firstWord.attribute.scaleY).toBeGreaterThan(0);
      expect(firstWord.attribute.scaleY).toBeLessThan(1);

      ticker.tickAt(4000);

      expectClose(firstWord.attribute.scaleX ?? 1, 1);
      expectClose(firstWord.attribute.scaleY ?? 1, 1);
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('keeps default bar appear starts out of static truth', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(
      {
        type: 'bar',
        width: 400,
        height: 300,
        data: [
          {
            id: 'barData',
            values: [{ month: 'Monday', sales: 22 }]
          }
        ],
        xField: 'month',
        yField: 'sales',
        axes: [
          { orient: 'left', visible: false },
          { orient: 'bottom', visible: false }
        ],
        animationAppear: {
          duration: APPEAR_DURATION,
          easing: 'linear'
        }
      } as IBarChartSpec,
      {
        dom,
        ticker,
        animation: true
      }
    );

    chart.renderSync();

    try {
      const barGraphic = getBarGraphics(chart)[0];
      const expectedFinalLayout = {
        y: getGraphicFinalAttribute(barGraphic).y,
        y1: getGraphicFinalAttribute(barGraphic).y1
      };

      expect(expectedFinalLayout.y).not.toBe(expectedFinalLayout.y1);
      expect(barGraphic.baseAttributes?.y).toBe(expectedFinalLayout.y);
      expect(barGraphic.baseAttributes?.y1).toBe(expectedFinalLayout.y1);

      ticker.tickAt(APPEAR_DURATION / 2);

      expect(barGraphic.attribute.y).not.toBe(barGraphic.attribute.y1);
      expect(barGraphic.baseAttributes?.y).toBe(expectedFinalLayout.y);
      expect(barGraphic.baseAttributes?.y1).toBe(expectedFinalLayout.y1);
      expect(getGraphicFinalAttribute(barGraphic).y).toBe(expectedFinalLayout.y);
      expect(getGraphicFinalAttribute(barGraphic).y1).toBe(expectedFinalLayout.y1);

      ticker.tickAt(APPEAR_DURATION + 50);

      expectBarYLayout(barGraphic, expectedFinalLayout);
      expect(barGraphic.attribute.y).not.toBe(barGraphic.attribute.y1);
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('keeps horizontal bar sorted update final y at the reordered axis positions', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const createSpec = (values: Array<{ type: string; value: number }>) =>
      ({
        type: 'bar',
        direction: 'horizontal',
        width: 500,
        height: 300,
        padding: 0,
        data: [
          {
            values
          }
        ],
        yField: 'type',
        xField: 'value',
        tooltip: false,
        animation: true,
        animationAppear: {
          duration: APPEAR_DURATION,
          easing: 'linear'
        },
        animationUpdate: {
          duration: UPDATE_DURATION,
          easing: 'linear'
        }
      } as unknown as IBarChartSpec);
    const chart = new VChart(
      createSpec([
        { type: '1', value: 20 },
        { type: '2', value: 30 },
        { type: '3', value: 10 }
      ]),
      {
        dom,
        ticker,
        animation: true
      }
    );

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      const bar1Before = getBarGraphicByKey(chart, '1');
      const bar2Before = getBarGraphicByKey(chart, '2');
      const y1Before = getGraphicFinalAttribute(bar1Before).y;
      const y2Before = getGraphicFinalAttribute(bar2Before).y;

      chart.updateSpecSync(
        createSpec([
          { type: '2', value: 30 },
          { type: '1', value: 20 },
          { type: '3', value: 10 }
        ])
      );

      const updateStart = ticker.getTime();
      const bar1After = getBarGraphicByKey(chart, '1');
      const bar2After = getBarGraphicByKey(chart, '2');
      const y1After = getGraphicFinalAttribute(bar1After).y;
      const y2After = getGraphicFinalAttribute(bar2After).y;

      expectClose(y1After, y2Before);
      expectClose(y2After, y1Before);

      ticker.tickAt(updateStart + UPDATE_DURATION / 2);

      expect(bar1After.attribute.y).toBeGreaterThan(Math.min(y1Before, y1After));
      expect(bar1After.attribute.y).toBeLessThan(Math.max(y1Before, y1After));
      expect(bar2After.attribute.y).toBeGreaterThan(Math.min(y2Before, y2After));
      expect(bar2After.attribute.y).toBeLessThan(Math.max(y2Before, y2After));
      expectClose(getGraphicFinalAttribute(bar1After).y, y1After);
      expectClose(getGraphicFinalAttribute(bar2After).y, y2After);

      ticker.tickAt(updateStart + UPDATE_DURATION + 50);

      expectClose(bar1After.attribute.y, y1After);
      expectClose(bar2After.attribute.y, y2After);
      expectClose(bar1After.baseAttributes?.y, y1After);
      expectClose(bar2After.baseAttributes?.y, y2After);
      expectClose(getGraphicFinalAttribute(bar1After).y, y1After);
      expectClose(getGraphicFinalAttribute(bar2After).y, y2After);
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('keeps line resize update final points at the resized layout', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(
      {
        type: 'line',
        direction: 'vertical',
        width: 500,
        height: 300,
        xField: ['date'],
        yField: '__MeaValue__',
        padding: 0,
        animation: true,
        animationAppear: {
          duration: APPEAR_DURATION,
          easing: 'linear'
        },
        animationUpdate: {
          duration: UPDATE_DURATION,
          easing: 'linear'
        },
        background: 'transparent',
        data: {
          values: [
            {
              date: '2019',
              __MeaValue__: 10
            },
            {
              date: '2020',
              __MeaValue__: 12
            },
            {
              date: '2021',
              __MeaValue__: 14
            },
            {
              date: '2022',
              __MeaValue__: 16
            }
          ]
        }
      } as ILineChartSpec,
      {
        dom,
        ticker,
        animation: true
      }
    );

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      const lineGraphic = getLineGraphics(chart)[0];
      const beforeResizePoints = simplifyPoints(getGraphicFinalAttribute(lineGraphic).points);

      chart.resizeSync(700, 300);

      const updateStart = ticker.getTime();
      const resizedPoints = simplifyPoints(getGraphicFinalAttribute(lineGraphic).points);

      expect(resizedPoints.some((point, index) => point.x !== beforeResizePoints[index].x)).toBe(true);
      expectPointsLayout(getGraphicFinalAttribute(lineGraphic).points, resizedPoints);

      ticker.tickAt(updateStart + UPDATE_DURATION / 2);

      lineGraphic.attribute.points.forEach((point: any, index: number) => {
        expect(point.x).toBeGreaterThanOrEqual(Math.min(beforeResizePoints[index].x, resizedPoints[index].x));
        expect(point.x).toBeLessThanOrEqual(Math.max(beforeResizePoints[index].x, resizedPoints[index].x));
        expectClose(point.y, resizedPoints[index].y);
        expect(point.context).toBe(resizedPoints[index].context);
      });
      expectPointsLayout(getGraphicFinalAttribute(lineGraphic).points, resizedPoints);

      ticker.tickAt(updateStart + UPDATE_DURATION + 50);

      expectLinePointsLayout(lineGraphic, resizedPoints);
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('keeps data label update final x at the filtered bar position', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(
      {
        type: 'bar',
        direction: 'vertical',
        width: 500,
        height: 300,
        xField: ['date', '__DimGroup__'],
        yField: '__MeaValue__',
        seriesField: '__DimGroupID__',
        padding: 0,
        region: [
          {
            clip: true
          }
        ],
        animation: true,
        animationAppear: {
          duration: APPEAR_DURATION,
          easing: 'linear'
        },
        animationUpdate: {
          duration: UPDATE_DURATION,
          easing: 'linear'
        },
        stackCornerRadius: [4, 4, 0, 0],
        color: {
          type: 'ordinal',
          domain: Object.keys(COLOR_BY_SERIES),
          range: Object.values(COLOR_BY_SERIES),
          specified: {}
        },
        data: {
          values: [
            {
              date: '2019',
              region: 'east',
              __OriginalData__: {
                date: '2019',
                region: 'east',
                profit: 10,
                sales: 20
              },
              profit: 10,
              __MeaId__: 'profit',
              __MeaName__: '利润',
              __MeaValue__: 10,
              __DimGroup__: 'east-利润',
              __DimGroupID__: 'east-利润profit'
            },
            {
              date: '2019',
              region: 'east',
              __OriginalData__: {
                date: '2019',
                region: 'east',
                profit: 10,
                sales: 20
              },
              sales: 20,
              __MeaId__: 'sales',
              __MeaName__: '销售量',
              __MeaValue__: 20,
              __DimGroup__: 'east-销售量',
              __DimGroupID__: 'east-销售量sales'
            },
            {
              date: '2019',
              region: 'north of east',
              __OriginalData__: {
                date: '2019',
                region: 'north of east',
                profit: 10,
                sales: 20
              },
              profit: 10,
              __MeaId__: 'profit',
              __MeaName__: '利润',
              __MeaValue__: 10,
              __DimGroup__: 'north of east-利润',
              __DimGroupID__: 'north of east-利润profit'
            },
            {
              date: '2019',
              region: 'north of east',
              __OriginalData__: {
                date: '2019',
                region: 'north of east',
                profit: 10,
                sales: 20
              },
              sales: 20,
              __MeaId__: 'sales',
              __MeaName__: '销售量',
              __MeaValue__: 20,
              __DimGroup__: 'north of east-销售量',
              __DimGroupID__: 'north of east-销售量sales'
            }
          ]
        },
        label: {
          visible: true,
          animationUpdate: {
            duration: UPDATE_DURATION,
            easing: 'linear'
          }
        },
        legends: {
          type: 'discrete',
          visible: true,
          maxCol: 1,
          maxRow: 1,
          autoPage: true,
          orient: 'right',
          position: 'start',
          item: {
            focus: true,
            background: {
              state: {
                selectedHover: {
                  fill: '#646A73',
                  fillOpacity: 0.05
                }
              }
            }
          }
        }
      } as unknown as IBarChartSpec,
      {
        dom,
        ticker,
        animation: true
      }
    );

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      const retainedSeries = Object.keys(COLOR_BY_SERIES).slice(0, 3);
      const initialXBySeries = retainedSeries.reduce<Record<string, number>>((result, seriesName) => {
        result[seriesName] = getLabelTextByFill(chart, COLOR_BY_SERIES[seriesName]).attribute.x;
        return result;
      }, {});

      chart.setLegendSelectedDataByIndex(0, retainedSeries);
      chart.renderSync();

      const updateStart = ticker.getTime();
      const expectedXBySeries = retainedSeries.reduce<Record<string, number>>((result, seriesName) => {
        result[seriesName] = getBarCenterX(getVisibleBarByFill(chart, COLOR_BY_SERIES[seriesName]));
        return result;
      }, {});

      expect(retainedSeries.some(seriesName => initialXBySeries[seriesName] !== expectedXBySeries[seriesName])).toBe(
        true
      );

      retainedSeries.forEach(seriesName => {
        expectStaticXLayout(getLabelTextByFill(chart, COLOR_BY_SERIES[seriesName]), expectedXBySeries[seriesName]);
      });

      ticker.tickAt(updateStart + UPDATE_DURATION / 2);

      retainedSeries.forEach(seriesName => {
        const label = getLabelTextByFill(chart, COLOR_BY_SERIES[seriesName]);
        const startX = initialXBySeries[seriesName];
        const finalX = expectedXBySeries[seriesName];

        if (startX !== finalX) {
          expect(label.attribute.x).toBeGreaterThanOrEqual(Math.min(startX, finalX));
          expect(label.attribute.x).toBeLessThanOrEqual(Math.max(startX, finalX));
        }
        expectStaticXLayout(label, finalX);
      });

      ticker.tickAt(updateStart + UPDATE_DURATION + 50);

      retainedSeries.forEach(seriesName => {
        const label = getLabelTextByFill(chart, COLOR_BY_SERIES[seriesName]);
        const finalX = expectedXBySeries[seriesName];

        expectClose(label.attribute.x, finalX);
        expectStaticXLayout(label, finalX);
      });
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('keeps stack corner clip paths aligned after interrupted legend update animations', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createStackCornerLegendSpec(), {
      dom,
      ticker,
      animation: true
    });

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      const allSeries = Object.keys(COLOR_BY_SERIES);
      const retainedSeries = allSeries.slice(0, 3);

      chart.setLegendSelectedDataByIndex(0, retainedSeries);
      chart.renderSync();

      const firstUpdate = ticker.getTime();

      ticker.tickAt(firstUpdate + UPDATE_DURATION / 2);

      chart.setLegendSelectedDataByIndex(0, allSeries);
      chart.renderSync();

      const secondUpdate = ticker.getTime();

      ticker.tickAt(secondUpdate + UPDATE_DURATION / 2);

      chart.setLegendSelectedDataByIndex(0, retainedSeries);
      chart.renderSync();

      const thirdUpdate = ticker.getTime();
      const expectedRects = retainedSeries.map(seriesName => {
        const graphic = getVisibleBarByFill(chart, COLOR_BY_SERIES[seriesName]);
        const finalAttribute = getGraphicFinalAttribute(graphic);

        return {
          x: finalAttribute.x,
          width: finalAttribute.width,
          y: finalAttribute.y,
          y1: finalAttribute.y1
        };
      });
      const clipPathRects = getBarClipPathRects(chart);

      expect(clipPathRects.length).toBe(retainedSeries.length);
      clipPathRects.forEach((clipPathRect, index) => {
        expectClose(clipPathRect.x, expectedRects[index].x);
        expectClose(clipPathRect.width, expectedRects[index].width);
        expectClose(clipPathRect.y, expectedRects[index].y);
        expectClose(clipPathRect.y1, expectedRects[index].y1);
      });

      ticker.tickAt(thirdUpdate + UPDATE_DURATION + 50);

      const finalClipPathRects = getBarClipPathRects(chart);

      expect(finalClipPathRects.length).toBe(retainedSeries.length);
      retainedSeries.forEach((seriesName, index) => {
        expectStaticRectLayout(getVisibleBarByFill(chart, COLOR_BY_SERIES[seriesName]), expectedRects[index]);
        expectClose(finalClipPathRects[index].x, expectedRects[index].x);
        expectClose(finalClipPathRects[index].width, expectedRects[index].width);
        expectClose(finalClipPathRects[index].y, expectedRects[index].y);
        expectClose(finalClipPathRects[index].y1, expectedRects[index].y1);
      });
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('keeps stack corner clip paths synced during quick legend reselect update animations', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createStackCornerLegendSpec(), {
      dom,
      ticker,
      animation: true
    });

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      const allSeries = Object.keys(COLOR_BY_SERIES);
      const retainedSeries = allSeries.slice(0, 3);

      clickLegendItem(chart, 3);
      chart.renderSync();

      const hideUpdate = ticker.getTime();

      ticker.tickAt(hideUpdate + UPDATE_DURATION / 10);

      clickLegendItem(chart, 3);
      chart.renderSync();

      const showUpdate = ticker.getTime();

      ticker.tickAt(showUpdate + UPDATE_DURATION / 15);

      const clipPaths = getBarClipPathGraphics(chart);
      const isAnimatingBackToAll = retainedSeries.some(seriesName => {
        const graphic = getVisibleBarByFill(chart, COLOR_BY_SERIES[seriesName]);
        const finalAttribute = getGraphicFinalAttribute(graphic);

        return graphic.attribute.x !== finalAttribute.x || graphic.attribute.width !== finalAttribute.width;
      });

      expect(clipPaths.length).toBe(allSeries.length);
      expect(isAnimatingBackToAll).toBe(true);

      retainedSeries.forEach((seriesName, index) => {
        const graphic = getVisibleBarByFill(chart, COLOR_BY_SERIES[seriesName]);
        const clipPath = clipPaths[index];

        expectClose(clipPath.attribute.x, graphic.attribute.x);
        expectClose(clipPath.attribute.width, graphic.attribute.width);
        expectClose(clipPath.attribute.y, graphic.attribute.y);
        expectClose(clipPath.attribute.y1, graphic.attribute.y1);
      });
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('keeps same-series horizontal bar updates animating with label enabled', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(
      createSameSeriesDocBarSpec([
        { country: 'United States', value: 12.911 },
        { country: 'China', value: 31.953 },
        { country: 'India', value: 8.04 },
        { country: 'Russia', value: 4.55 }
      ]),
      {
        dom,
        ticker,
        animation: true
      }
    );

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      const chinaBefore = getBarGraphicByDatum(chart, datum => datum?.__Dim_Y__ === 'China');
      const yBefore = getGraphicFinalAttribute(chinaBefore).y;

      chart.updateSpecSync(
        createSameSeriesDocBarSpec([
          { country: 'China', value: 31.953 },
          { country: 'United States', value: 12.911 },
          { country: 'India', value: 8.04 },
          { country: 'Russia', value: 4.55 },
          { country: 'Brazil', value: 1.271 }
        ])
      );

      const updateStart = ticker.getTime();
      const chinaAfter = getBarGraphicByDatum(chart, datum => datum?.__Dim_Y__ === 'China');
      const yAfter = getGraphicFinalAttribute(chinaAfter).y;

      expect(yAfter).not.toBe(yBefore);
      expectClose(getGraphicFinalAttribute(chinaAfter).y, yAfter);

      ticker.tickAt(updateStart + UPDATE_DURATION / 2);

      expect(chinaAfter.attribute.y).toBeGreaterThan(Math.min(yBefore, yAfter));
      expect(chinaAfter.attribute.y).toBeLessThan(Math.max(yBefore, yAfter));
      expectClose(getGraphicFinalAttribute(chinaAfter).y, yAfter);

      ticker.tickAt(updateStart + UPDATE_DURATION + 50);

      expectClose(chinaAfter.attribute.y, yAfter);
      expectClose(chinaAfter.baseAttributes?.y, yAfter);
      expectClose(getGraphicFinalAttribute(chinaAfter).y, yAfter);
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('grows new line data points through update animation instead of placing them directly at final points', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(
      createLineGrowthSpec([
        { time: '2019', value: 10 },
        { time: '2020', value: 12 },
        { time: '2021', value: 14 }
      ]),
      {
        dom,
        ticker,
        animation: true
      }
    );

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      const lineGraphic = getLineGraphics(chart)[0];
      const beforePoints = simplifyPoints(getGraphicFinalAttribute(lineGraphic).points);
      const beforeTail = beforePoints[beforePoints.length - 1];

      chart.updateSpecSync(
        createLineGrowthSpec([
          { time: '2019', value: 10 },
          { time: '2020', value: 12 },
          { time: '2021', value: 14 },
          { time: '2022', value: 16 },
          { time: '2023', value: 18 }
        ])
      );

      const updateStart = ticker.getTime();
      const finalPoints = simplifyPoints(getGraphicFinalAttribute(lineGraphic).points);

      expect(finalPoints.length).toBe(5);

      ticker.tickAt(updateStart + UPDATE_DURATION / 2);

      const midPoints = simplifyPoints(lineGraphic.attribute.points);
      const newMidPoints = midPoints.slice(beforePoints.length);
      const newFinalPoints = finalPoints.slice(beforePoints.length);

      expect(newMidPoints.length).toBe(newFinalPoints.length);
      expect(
        newMidPoints.some((point, index) => point.x !== newFinalPoints[index].x || point.y !== newFinalPoints[index].y)
      ).toBe(true);
      newMidPoints.forEach((point, index) => {
        const finalPoint = newFinalPoints[index];

        expect(point.x).toBeGreaterThanOrEqual(Math.min(beforeTail.x, finalPoint.x));
        expect(point.x).toBeLessThanOrEqual(Math.max(beforeTail.x, finalPoint.x));
        expect(point.y).toBeGreaterThanOrEqual(Math.min(beforeTail.y, finalPoint.y));
        expect(point.y).toBeLessThanOrEqual(Math.max(beforeTail.y, finalPoint.y));
      });

      ticker.tickAt(updateStart + UPDATE_DURATION + 50);

      expectLinePointsLayout(lineGraphic, finalPoints);
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('keeps reselected percent line graphics visible after interrupted legend toggles', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createCosmeticPercentLineSpec(), {
      dom,
      ticker,
      animation: true
    });

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      const allSeries = ['Africa', 'EU', 'China', 'USA'];
      const retainedSeries = allSeries.filter(value => value !== 'USA');
      const selectLegendData = (selectedData: string[]) => {
        chart.setLegendSelectedDataByIndex(0, selectedData);
        chart.renderSync();
      };
      const getLineGraphicByCountry = (country: string) => {
        const lineGraphic = getLineGraphics(chart).find((graphic: AnimatedGraphic) => {
          const datum = getGraphicDatum(graphic);

          return datum?.country === country;
        });

        expect(lineGraphic).toBeDefined();
        if (!lineGraphic) {
          throw new Error(`Expected line graphic for ${country}`);
        }
        return lineGraphic;
      };
      const getPointGraphicByDatum = (country: string, type: string) => {
        const pointGraphic = getPointGraphics(chart).find((graphic: AnimatedGraphic) => {
          const datum = getGraphicDatum(graphic);

          return datum?.country === country && datum?.type === type;
        });

        expect(pointGraphic).toBeDefined();
        if (!pointGraphic) {
          throw new Error(`Expected point graphic for ${country}/${type}`);
        }
        return pointGraphic;
      };

      selectLegendData(retainedSeries);
      ticker.tickAt(ticker.getTime() + UPDATE_DURATION / 4);

      selectLegendData(allSeries);
      ticker.tickAt(ticker.getTime() + UPDATE_DURATION / 4);

      selectLegendData(retainedSeries);
      ticker.tickAt(ticker.getTime() + UPDATE_DURATION / 4);

      const chinaPointBeforeReselect = getPointGraphicByDatum('China', 'Nail polish');
      const chinaYBeforeReselect = chinaPointBeforeReselect.attribute.y;

      selectLegendData(allSeries);

      const reselectStart = ticker.getTime();
      const chinaPointAfterReselect = getPointGraphicByDatum('China', 'Nail polish');
      const chinaFinalY = getGraphicFinalAttribute(chinaPointAfterReselect).y;
      const usaLine = getLineGraphicByCountry('USA');
      const usaPoint = getPointGraphicByDatum('USA', 'Nail polish');

      expectClose(chinaPointAfterReselect.attribute.y, chinaYBeforeReselect);
      expect(chinaFinalY).not.toBe(chinaYBeforeReselect);
      expect(getGraphicFinalAttribute(usaLine).points.length).toBe(9);
      expect(getGraphicFinalAttribute(usaPoint).x).toBeDefined();
      expect(getGraphicFinalAttribute(usaPoint).y).toBeDefined();

      ticker.tickAt(reselectStart + UPDATE_DURATION / 4);

      expect(usaLine.attribute.opacity).toBeGreaterThan(0);
      expect(usaLine.attribute.opacity).toBeLessThan(1);

      ticker.tickAt(reselectStart + UPDATE_DURATION + 50);

      const finalUsaLine = getLineGraphicByCountry('USA');
      const finalUsaPoint = getPointGraphicByDatum('USA', 'Nail polish');

      expect(getGraphicFinalAttribute(finalUsaLine).points.length).toBe(9);
      expect(finalUsaLine.attribute.points.length).toBe(9);
      expect(finalUsaPoint.attribute.x).toBeDefined();
      expect(finalUsaPoint.attribute.y).toBeDefined();
      expectClose(chinaPointAfterReselect.attribute.y, chinaFinalY);
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('keeps retained bars moving when grouped series changes to single-series layout', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createSeriesChangeDocBarSpec('grouped'), {
      dom,
      ticker,
      animation: true
    });

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      const retainedBefore = getBarGraphicByDatum(
        chart,
        datum => datum?.__Dim_Y__ === 'China' && datum?.__Dim_ColorId__ === 'share_global_co2'
      );
      const yBefore = getGraphicFinalAttribute(retainedBefore).y;

      chart.updateSpecSync(createSeriesChangeDocBarSpec('single'));

      const updateStart = ticker.getTime();
      const retainedAfter = getBarGraphicByDatum(
        chart,
        datum => datum?.__Dim_Y__ === 'China' && datum?.__Dim_ColorId__ === 'share_global_co2'
      );
      const yAfter = getGraphicFinalAttribute(retainedAfter).y;

      expect(retainedAfter).toBe(retainedBefore);
      expect(yAfter).not.toBe(yBefore);

      ticker.tickAt(updateStart + UPDATE_DURATION / 2);

      expect(retainedAfter.attribute.y).toBeGreaterThan(Math.min(yBefore, yAfter));
      expect(retainedAfter.attribute.y).toBeLessThan(Math.max(yBefore, yAfter));
      expectClose(getGraphicFinalAttribute(retainedAfter).y, yAfter);

      ticker.tickAt(updateStart + UPDATE_DURATION + 50);

      expectClose(retainedAfter.attribute.y, yAfter);
      expectClose(retainedAfter.baseAttributes?.y, yAfter);
      expectClose(getGraphicFinalAttribute(retainedAfter).y, yAfter);
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('keeps line update animation when a persistent state filter is active', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(
      createStateFilteredLineGrowthSpec([
        { time: '2019', value: 10 },
        { time: '2020', value: 12 },
        { time: '2021', value: 14 }
      ]),
      {
        dom,
        ticker,
        animation: true
      }
    );

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      const lineGraphic = getLineGraphics(chart)[0];
      const beforePoints = simplifyPoints(getGraphicFinalAttribute(lineGraphic).points);
      const beforeTail = beforePoints[beforePoints.length - 1];

      expect(lineGraphic.currentStates).toEqual(['custom1']);

      const chartModel = chart.getChart() as IChart & {
        updateDataSpec: () => void;
        reDataFlow: () => void;
      };
      const updateDataSpec = jest.spyOn(chartModel, 'updateDataSpec');
      const reDataFlow = jest.spyOn(chartModel, 'reDataFlow');

      chart.updateSpecSync(
        createStateFilteredLineGrowthSpec(
          [
            { time: '2019', value: 10 },
            { time: '2020', value: 12 },
            { time: '2021', value: 14 },
            { time: '2022', value: 16 },
            { time: '2023', value: 18 }
          ],
          0.9
        )
      );

      const updateStart = ticker.getTime();
      const lineGraphicAfterUpdate = getLineGraphics(chart)[0];
      const finalPoints = simplifyPoints(getGraphicFinalAttribute(lineGraphicAfterUpdate).points);

      expect(updateDataSpec).toHaveBeenCalledTimes(1);
      expect(reDataFlow).toHaveBeenCalledTimes(1);
      expect(lineGraphicAfterUpdate).toBe(lineGraphic);
      expect(lineGraphic.currentStates).toEqual(['custom1']);
      expect(lineGraphicAfterUpdate.context.data.length).toBe(5);
      expect(lineGraphicAfterUpdate.context.finalAttrs.points.length).toBe(5);
      expect(finalPoints.length).toBe(5);

      ticker.tickAt(updateStart + UPDATE_DURATION / 2);

      const midPoints = simplifyPoints(lineGraphic.attribute.points);
      const newMidPoints = midPoints.slice(beforePoints.length);
      const newFinalPoints = finalPoints.slice(beforePoints.length);

      expect(newMidPoints.length).toBe(newFinalPoints.length);
      expect(
        newMidPoints.some((point, index) => point.x !== newFinalPoints[index].x || point.y !== newFinalPoints[index].y)
      ).toBe(true);
      newMidPoints.forEach((point, index) => {
        const finalPoint = newFinalPoints[index];

        expect(point.x).toBeGreaterThanOrEqual(Math.min(beforeTail.x, finalPoint.x));
        expect(point.x).toBeLessThanOrEqual(Math.max(beforeTail.x, finalPoint.x));
        expect(point.y).toBeGreaterThanOrEqual(Math.min(beforeTail.y, finalPoint.y));
        expect(point.y).toBeLessThanOrEqual(Math.max(beforeTail.y, finalPoint.y));
      });

      ticker.tickAt(updateStart + UPDATE_DURATION + 50);
      expectLinePointsLayout(lineGraphic, finalPoints);

      chart.updateSpecSync(
        createStateFilteredLineGrowthSpec([
          { time: '2019', value: 11 },
          { time: '2020', value: 14 },
          { time: '2021', value: 13 },
          { time: '2022', value: 17 },
          { time: '2023', value: 20 }
        ])
      );

      const secondUpdateStart = ticker.getTime();
      const secondFinalPoints = simplifyPoints(getGraphicFinalAttribute(lineGraphic).points);

      expect(lineGraphic.currentStates).toEqual(['custom1']);
      expect(secondFinalPoints.length).toBe(finalPoints.length);

      ticker.tickAt(secondUpdateStart + UPDATE_DURATION / 2);

      const secondMidPoints = simplifyPoints(lineGraphic.attribute.points);

      expect(
        secondMidPoints.some(
          (point, index) => point.x !== secondFinalPoints[index].x || point.y !== secondFinalPoints[index].y
        )
      ).toBe(true);
      secondMidPoints.forEach((point, index) => {
        const beforePoint = finalPoints[index];
        const finalPoint = secondFinalPoints[index];

        expect(point.x).toBeGreaterThanOrEqual(Math.min(beforePoint.x, finalPoint.x));
        expect(point.x).toBeLessThanOrEqual(Math.max(beforePoint.x, finalPoint.x));
        expect(point.y).toBeGreaterThanOrEqual(Math.min(beforePoint.y, finalPoint.y));
        expect(point.y).toBeLessThanOrEqual(Math.max(beforePoint.y, finalPoint.y));
      });
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('animates line color updates while a persistent state filter is active', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(
      createStateFilteredLineGrowthSpec(
        [
          { time: '2019', value: 10 },
          { time: '2020', value: 12 },
          { time: '2021', value: 14 }
        ],
        1,
        '#F0A868'
      ),
      {
        dom,
        ticker,
        animation: true
      }
    );

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      const lineGraphic = getLineGraphics(chart)[0];

      expect(lineGraphic.currentStates).toEqual(['custom1']);
      expect(lineGraphic.attribute.stroke).toBe('#F0A868');

      chart.updateSpecSync(
        createStateFilteredLineGrowthSpec(
          [
            { time: '2019', value: 10 },
            { time: '2020', value: 12 },
            { time: '2021', value: 14 },
            { time: '2022', value: 16 }
          ],
          0.9,
          '#4A5568'
        )
      );

      const updateStart = ticker.getTime();
      const lineGraphicAfterUpdate = getLineGraphics(chart)[0];

      expect(lineGraphicAfterUpdate).toBe(lineGraphic);
      expect(lineGraphicAfterUpdate.currentStates).toEqual(['custom1']);
      expect(lineGraphicAfterUpdate.context.diffAttrs?.stroke).toBe('#4A5568');
      expect(lineGraphicAfterUpdate.attribute.stroke).not.toBe('#4A5568');

      ticker.tickAt(updateStart + UPDATE_DURATION / 2);

      expect(lineGraphicAfterUpdate.attribute.stroke).not.toBe('#F0A868');
      expect(lineGraphicAfterUpdate.attribute.stroke).not.toBe('#4A5568');

      ticker.tickAt(updateStart + UPDATE_DURATION + 50);

      expect(lineGraphicAfterUpdate.attribute.stroke).toBe('#4A5568');
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('keeps unchanged custom highlight opacity through updateSpec and state refresh', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createStateSwitchSpec(), {
      dom,
      ticker,
      animation: true
    });

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      chart.updateState({
        custom1: {
          filter: (datum: any) => getStateDatum(datum)?.date === '2021'
        }
      });

      const firstStateStart = ticker.getTime();

      ticker.tickAt(firstStateStart + UPDATE_DURATION + 50);

      const highlightedBefore = getBarGraphicByDatum(chart, datum => datum?.date === '2021');

      expect(highlightedBefore.currentStates).toContain('custom1');
      expect(highlightedBefore.resolvedStatePatch?.fillOpacity).toBe(0.2);
      expectClose(highlightedBefore.attribute.fillOpacity, 0.2);

      chart.updateSpecSync(createStateSwitchSpec(5));
      chart.updateState({
        custom1: {
          filter: (datum: any) => getStateDatum(datum)?.date === '2021'
        }
      });

      const highlightedAfter = getBarGraphicByDatum(chart, datum => datum?.date === '2021');
      const secondStateStart = ticker.getTime();

      expect(highlightedAfter.currentStates).toContain('custom1');
      expect(highlightedAfter.resolvedStatePatch?.fillOpacity).toBe(0.2);
      expectClose(highlightedAfter.attribute.fillOpacity, 0.2);

      ticker.tickAt(secondStateStart + UPDATE_DURATION / 2);

      expectClose(highlightedAfter.attribute.fillOpacity, 0.2);

      ticker.tickAt(secondStateStart + UPDATE_DURATION + 50);

      expectClose(highlightedAfter.attribute.fillOpacity, 0.2);
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('keeps same state opacity stable when updateSpec changes another state filter', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createStateFilterSwitchSpec('2019'), {
      dom,
      ticker,
      animation: true
    });

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      const stableBefore = getBarGraphicByDatum(chart, datum => datum?.date === '2020');

      expect(stableBefore.currentStates).toEqual(['custom1']);
      expect(stableBefore.resolvedStatePatch?.fillOpacity).toBe(0.2);
      expectClose(stableBefore.attribute.fillOpacity, 0.2);

      chart.updateSpecSync(createStateFilterSwitchSpec('2023'));

      const stableAfter = getBarGraphicByDatum(chart, datum => datum?.date === '2020');
      const updateStart = ticker.getTime();

      expect(stableAfter.currentStates).toEqual(['custom1']);
      expect(stableAfter.resolvedStatePatch?.fillOpacity).toBe(0.2);
      expectClose(stableAfter.attribute.fillOpacity, 0.2);

      ticker.tickAt(updateStart + 1);

      expectClose(stableAfter.attribute.fillOpacity, 0.2);

      ticker.tickAt(updateStart + UPDATE_DURATION / 2);

      expectClose(stableAfter.attribute.fillOpacity, 0.2);
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('animates same state opacity when updateSpec changes the state patch', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createStateFilterSwitchSpec('2019', 0.2), {
      dom,
      ticker,
      animation: true
    });

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      const stableBefore = getBarGraphicByDatum(chart, datum => datum?.date === '2020');

      expect(stableBefore.currentStates).toEqual(['custom1']);
      expect(stableBefore.resolvedStatePatch?.fillOpacity).toBe(0.2);
      expectClose(stableBefore.attribute.fillOpacity, 0.2);

      chart.updateSpecSync(createStateFilterSwitchSpec('2019', 0.5));

      const stableAfter = getBarGraphicByDatum(chart, datum => datum?.date === '2020');
      const updateStart = ticker.getTime();

      expect(stableAfter).toBe(stableBefore);
      expect(stableAfter.currentStates).toEqual(['custom1']);
      expect(stableAfter.resolvedStatePatch?.fillOpacity).toBe(0.5);
      expectClose(stableAfter.attribute.fillOpacity, 0.2);

      ticker.tickAt(updateStart + UPDATE_DURATION / 2);

      expect(stableAfter.attribute.fillOpacity).toBeGreaterThan(0.2);
      expect(stableAfter.attribute.fillOpacity).toBeLessThan(0.5);

      ticker.tickAt(updateStart + UPDATE_DURATION + 50);

      expectClose(stableAfter.attribute.fillOpacity, 0.5);
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('uses clipIn on difference markLine so the arrow line is geometrically revealed', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createDifferenceMarkLineSpec(), {
      dom,
      ticker,
      animation: true
    });

    chart.renderSync();

    try {
      const markerGraphic = getMarkerGraphic(chart, 'markLine');

      ticker.tickAt(MARKER_DURATION / 2);

      const clipRangeGraphics = collectGraphics(markerGraphic).filter(
        graphic => typeof graphic.attribute?.clipRange === 'number'
      );

      expect(clipRangeGraphics.length).toBeGreaterThan(0);
      expect(
        clipRangeGraphics.some(graphic => graphic.attribute.clipRange > 0 && graphic.attribute.clipRange < 1)
      ).toBe(true);

      ticker.tickAt(MARKER_DURATION + 50);

      clipRangeGraphics.forEach(graphic => {
        expectClose(graphic.attribute.clipRange, 1);
        expectClose(graphic.baseAttributes?.clipRange, 1);
        expectClose(getGraphicFinalAttribute(graphic).clipRange, 1);
      });
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('does not replay scatter data label text animation when only marker line is removed', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createScatterMarkLineRemovalSpec(true), {
      dom,
      ticker,
      animation: true
    });
    const renderSync = jest.spyOn(chart as any, '_renderSync');

    chart.renderSync();
    renderSync.mockClear();

    try {
      ticker.tickAt(MARKER_DURATION + 1000);

      const labelsBefore = getScatterDataLabels(chart);

      expect(labelsBefore.length).toBeGreaterThan(0);

      const labelTextsBefore = new Map(labelsBefore.map(label => [label, label.attribute.text]));

      chart.updateSpecSync(createScatterMarkLineRemovalSpec(false));

      expect(renderSync).not.toHaveBeenCalled();

      const updateStart = ticker.getTime();

      ticker.tickAt(updateStart + UPDATE_DURATION / 2);

      labelsBefore.forEach(label => {
        expect(label.attribute.text).toBe(labelTextsBefore.get(label));
      });
    } finally {
      renderSync.mockRestore();
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('keeps bars visible when toggling a markPoint with data updates', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createMarkerToggleBarAnimationSpec(false), {
      dom,
      ticker,
      animation: true
    });

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + 50);

      const chartModel = chart.getChart();

      chart.updateSpecSync(createMarkerToggleBarAnimationSpec(true));

      expect(chart.getChart()).toBe(chartModel);
      expect(getMarkerGraphic(chart, 'markPoint')).toBeDefined();

      const firstUpdateStart = ticker.getTime();
      ticker.tickAt(firstUpdateStart + MARKER_DURATION + 50);

      chart.updateSpecSync(createMarkerToggleBarAnimationSpec(false));

      expect(chart.getChart()).toBe(chartModel);

      const secondUpdateStart = ticker.getTime();

      expect(getBarGraphics(chart)).toHaveLength(2);
      expect(getBarGraphics(chart).every(hasRenderableBarGeometry)).toBe(true);

      ticker.tickAt(secondUpdateStart + UPDATE_DURATION / 2);

      expect(getBarGraphics(chart)).toHaveLength(2);
      expect(getBarGraphics(chart).every(hasRenderableBarGeometry)).toBe(true);

      ticker.tickAt(secondUpdateStart + MARKER_EXIT_DURATION + 50);

      expect(getBarGraphics(chart)).toHaveLength(2);
      expect(getBarGraphics(chart).every(hasRenderableBarGeometry)).toBe(true);
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('lays out a recreated markPoint when only marker presence changes', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createMarkerPresenceOnlyBarAnimationSpec(true), {
      dom,
      ticker,
      animation: true
    });

    chart.renderSync();

    try {
      ticker.tickAt(APPEAR_DURATION + MARKER_DURATION + 50);

      const chartModel = chart.getChart();

      chart.updateSpecSync(createMarkerPresenceOnlyBarAnimationSpec(false));

      expect(chart.getChart()).toBe(chartModel);

      const removeStart = ticker.getTime();
      ticker.tickAt(removeStart + MARKER_EXIT_DURATION + 50);

      chart.updateSpecSync(createMarkerPresenceOnlyBarAnimationSpec(true));

      expect(chart.getChart()).toBe(chartModel);
      expect(getMarkerGraphic(chart, 'markPoint')).toBeDefined();
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('does not rerun removed marker layout from stale marker data listeners', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createRegularMarkLineExitSpec(true), {
      dom,
      ticker,
      animation: true
    });

    chart.renderSync();

    try {
      ticker.tickAt(MARKER_DURATION + 50);

      const markerComponent = (chart.getChart() as any)?.getComponentsByKey('markLine')?.[0];
      const markerData = markerComponent?.getMarkerData();
      const markerDataTarget = markerData?.target;

      expect(markerData).toBeDefined();
      expect(markerDataTarget).toBeDefined();

      chart.updateSpecSync(createRegularMarkLineExitSpec(false));

      expect(() => {
        markerDataTarget?.emit('change', { latestData: [] });
      }).not.toThrow();
      expect(() => {
        chart.updateDataSync('data', [
          { x: 95, y: 96, z: 13.8, name: 'BE', country: 'Belgium' },
          { x: 65.5, y: 126.4, z: 35.3, name: 'US', country: 'United States' },
          { x: 63.4, y: 51.8, z: 15.4, name: 'PT', country: 'Portugal' }
        ]);
      }).not.toThrow();
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it('detaches removed coordinate marker intermediate data from source data updates', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createDifferenceMarkLineSpec(true), {
      dom,
      ticker,
      animation: true
    });

    chart.renderSync();

    try {
      ticker.tickAt(MARKER_DURATION + 50);

      const markerComponent = (chart.getChart() as any)?.getComponentsByKey('markLine')?.[0];
      const markerData = markerComponent?.getMarkerData();
      const processData = markerData?.rawData?.[0];

      expect(processData).toBeDefined();

      chart.updateSpecSync(createDifferenceMarkLineSpec(false));
      expect(processData?.target).toBeNull();
      expect(() => {
        chart.updateDataSync('barData', [
          { type: 'Autocracies', year: '1930', value: 130 },
          { type: 'Autocracies', year: '2000', value: 90 },
          { type: 'Democracies', year: '1930', value: 22 },
          { type: 'Democracies', year: '2000', value: 87 }
        ]);
      }).not.toThrow();
    } finally {
      chart.release();
      ticker.release();
      removeDom(container);
    }
  });

  it.each([
    ['markPoint', createMarkPointExitSpec, 'markPoint'],
    ['difference markLine', createDifferenceMarkLineSpec, 'markLine'],
    ['markArea', createMarkAreaExitSpec, 'markArea'],
    ['regular markLine', createRegularMarkLineExitSpec, 'markLine']
  ] as const)(
    'runs %s exit fade-out instead of removing the marker immediately',
    (_name, createSpec, componentType) => {
      const { container, dom } = createChartContainer();
      const ticker = createManualTicker();
      const chart = new VChart(createSpec(true), {
        dom,
        ticker,
        animation: true
      });

      chart.renderSync();

      try {
        ticker.tickAt(MARKER_DURATION + 50);

        expectMarkerExitFade(chart, ticker, getMarkerGraphic(chart, componentType), () => createSpec(false));
      } finally {
        chart.release();
        ticker.release();
        removeDom(container);
      }
    }
  );

  it('forces pending marker exit cleanup when the chart releases', () => {
    const { container, dom } = createChartContainer();
    const ticker = createManualTicker();
    const chart = new VChart(createRegularMarkLineExitSpec(true), {
      dom,
      ticker,
      animation: true
    });
    let released = false;

    chart.renderSync();

    try {
      ticker.tickAt(MARKER_DURATION + 50);

      const markerGraphic = getMarkerGraphic(chart, 'markLine');
      const trackedGraphics = collectGraphics(markerGraphic).filter(graphic => graphic !== markerGraphic);

      chart.updateSpecSync(createRegularMarkLineExitSpec(false));

      const exitStart = ticker.getTime();
      ticker.tickAt(exitStart + MARKER_EXIT_DURATION / 2);

      expect(trackedGraphics.some(isGraphicAttached)).toBe(true);

      chart.release();
      released = true;

      expect(trackedGraphics.some(isGraphicAttached)).toBe(false);
    } finally {
      if (!released) {
        chart.release();
      }
      ticker.release();
      removeDom(container);
    }
  });
});
