import VChart, {
  type BaseEventParams,
  type IBarChartSpec,
  type IChart,
  type ILineChartSpec,
  type ICommonChartSpec,
  type IMark,
  type IMarkGraphic,
  type ISeries
} from '../../../src';
import { DiffState } from '../../../src/mark/interface/enum';
import type { IUpdateSpecResult } from '../../../src/model/interface';
import { createDiv, removeDom } from '../../util/dom';

type StateGraphic = IMarkGraphic & {
  attribute: Record<string, unknown>;
  resolvedStatePatch?: Record<string, unknown>;
};

type SharedStateDefinitions = Record<
  string,
  {
    patch?: Record<string, unknown>;
    resolver?: (context: { graphic: IMarkGraphic }) => Record<string, unknown> | undefined;
  }
>;

const getSharedStateDefinitions = (mark: IMark) =>
  (mark.getProduct() as unknown as { sharedStateDefinitions?: SharedStateDefinitions }).sharedStateDefinitions;

type VChartWithUpdateSpec = {
  _updateSpec: (spec: ILineChartSpec, forceMerge: boolean) => IUpdateSpecResult;
};

type StageEventListener = {
  fn: (event: unknown) => void;
  context?: unknown;
};

type CrosshairStateForTest = {
  _stateByField?: {
    xField?: {
      currentValue?: Map<unknown, unknown>;
    };
  };
};

describe('vchart event test', () => {
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
    const spec: IBarChartSpec = {
      type: 'bar',
      data: [
        {
          id: 'bar',
          values: data
        }
      ],
      // xField: ['city', 'type'],
      xField: ['city'],
      yField: 'value',
      seriesField: 'type',
      axes: [
        {
          orient: 'left',
          id: 'axis-left'
        },
        {
          orient: 'bottom',
          id: 'axis-bottom'
        }
      ],
      legends: {
        id: 'legend',
        orient: 'right',
        position: 'start',
        padding: {
          left: 12
        },
        item: {
          focus: true
        },
        defaultSelected: ['特产零食', '米面'],
        allowAllCanceled: true
      },
      label: {
        visible: true,
        interactive: true
      },
      totalLabel: {
        visible: true,
        interactive: true
      }
    };
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

  it('should fire pointerdown event', () => {
    const axisEventSpy = jest.fn();
    vchart.on('pointerdown', { type: 'axis', level: 'model' }, axisEventSpy);
    vchart.on('pointerdown', { id: 'axis-bottom', level: 'model' }, axisEventSpy);

    const axis = vchart.getComponents().find(com => com.type === 'cartesianAxis-band');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    axis?.event.emit('pointerdown', { model: axis });
    expect(axisEventSpy).toBeCalledTimes(2);

    const legendEventSpy = jest.fn();
    vchart.on('pointerdown', { type: 'legend', level: 'model' }, legendEventSpy);
    vchart.on('pointerdown', { id: 'legend' }, legendEventSpy);

    const legend = vchart.getComponents().find(com => com.type === 'discreteLegend');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    legend?.event.emit('pointerdown', { model: legend });
    expect(legendEventSpy).toBeCalledTimes(2);
  });

  it('should fire legendItemClick event only once', () => {
    const legendItemClickSpy = jest.fn();
    vchart.on('legendItemClick', legendItemClickSpy);
    vchart.on('legendItemClick', { level: 'model' }, legendItemClickSpy);

    const legend = vchart.getComponents().find(com => com.type === 'discreteLegend');
    legend?.getVRenderComponents()[0]._dispatchEvent('legendItemClick', {});
    expect(legendItemClickSpy).toBeCalledTimes(2);
  });

  it('should fire label event', () => {
    const labelEventSpy = jest.fn();
    vchart.on('click', { level: 'model', type: 'label' }, labelEventSpy);

    const labelModel = vchart.getComponents().find(com => com.type === 'label');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    labelModel?.event.emit('click', { model: labelModel });

    expect(labelEventSpy).toBeCalledTimes(1);
  });

  it('should fire totalLabel event', () => {
    const labelEventSpy = jest.fn();
    vchart.on('click', { level: 'model', type: 'totalLabel' }, labelEventSpy);

    const labelModel = vchart.getComponents().find(com => com.type === 'totalLabel');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    labelModel?.event.emit('click', { model: labelModel });

    expect(labelEventSpy).toBeCalledTimes(1);
  });

  it('should fire pointerdown event once after updateSpecSync()', () => {
    const pointDowmSpy = jest.fn();
    const stage = vchart.getStage();
    const getPointerdownListeners = (): StageEventListener[] => {
      const listeners = (stage as any)._events?.pointerdown;
      if (!listeners) {
        return [];
      }
      return 'fn' in listeners ? [listeners] : listeners;
    };
    const emitPointerdown = () => {
      const event = {
        type: 'pointerdown',
        target: stage,
        defaultPrevented: false,
        stopPropagation: jest.fn(),
        preventDefault: jest.fn()
      };
      getPointerdownListeners().forEach(listener => listener.fn.call(listener.context, event));
    };

    vchart.on('pointerdown', pointDowmSpy);
    expect(getPointerdownListeners()).toHaveLength(1);

    emitPointerdown();

    expect(pointDowmSpy).toBeCalledTimes(1);

    vchart.updateSpecSync({
      ...vchart.getSpec(),
      stack: 'percent'
    });

    expect(getPointerdownListeners()).toHaveLength(1);
    emitPointerdown();
    expect(pointDowmSpy).toBeCalledTimes(2);
  });

  it('should keep tooltip and crosshair triggerable after line mark and marker update without remake', () => {
    const lineContainer = createDiv();
    const lineDom = createDiv(lineContainer);
    lineDom.id = 'line-interaction-container';
    lineContainer.style.position = 'fixed';
    lineContainer.style.width = '500px';
    lineContainer.style.height = '500px';
    lineContainer.style.top = '0px';
    lineContainer.style.left = '0px';

    const createSpec = (overrides: Partial<ILineChartSpec> = {}): ILineChartSpec => ({
      type: 'line',
      data: {
        id: 'line',
        values: [
          { x: 'A', y: 10, series: 's1' },
          { x: 'B', y: 16, series: 's1' },
          { x: 'C', y: 12, series: 's1' }
        ]
      },
      xField: 'x',
      yField: 'y',
      seriesField: 'series',
      point: {
        style: {},
        state: {
          dimension_hover: {
            scaleX: 1.4,
            scaleY: 1.4
          }
        }
      },
      line: {
        style: {},
        state: {
          custom1: {
            style: {
              strokeOpacity: 0.25
            }
          }
        }
      },
      markArea: [
        {
          coordinates: [
            { x: 'A', y: 0 },
            { x: 'B', y: 18 }
          ]
        }
      ],
      markPoint: [],
      crosshair: {
        xField: {
          visible: true,
          line: {
            type: 'line'
          },
          label: {
            visible: true
          }
        }
      },
      tooltip: {
        visible: true,
        throttleInterval: 0
      },
      ...overrides
    });

    const nextSpec = createSpec({
      data: {
        id: 'line',
        values: [
          { x: 'A', y: 11, series: 's1' },
          { x: 'B', y: 18, series: 's1' },
          { x: 'C', y: 13, series: 's1' },
          { x: 'D', y: 15, series: 's1' }
        ]
      },
      point: {
        visible: false
      },
      line: {
        style: {}
      },
      markArea: [],
      markPoint: [
        {
          coordinate: { x: 'B', y: 18 },
          itemContent: {
            text: {
              text: 'B'
            }
          }
        }
      ]
    });

    const lineChart = new VChart(createSpec(), {
      dom: lineDom,
      animation: false
    });
    lineChart.renderSync();

    const emitPointerMove = (chart: VChart, datum: Record<string, unknown>) => {
      const point = chart.convertDatumToPosition(datum) as { x: number; y: number };

      chart
        .getChart()
        ?.getEvent()
        .emit('pointermove', {
          chart: chart.getChart(),
          event: {
            type: 'pointermove',
            viewX: point.x,
            viewY: point.y
          },
          source: 'chart'
        } as unknown as BaseEventParams);
    };

    const tooltipShowSpy = jest.fn();
    lineChart.on('tooltipShow', tooltipShowSpy);
    emitPointerMove(lineChart, { x: 'B', y: 16, series: 's1' });

    expect(tooltipShowSpy).toBeCalledTimes(1);

    const updateResult = (lineChart as unknown as VChartWithUpdateSpec)._updateSpec(nextSpec, false);

    expect(updateResult.reMake).toBe(false);
    lineChart.updateCustomConfigAndRerender(updateResult, true, {
      transformSpec: updateResult.reTransformSpec,
      actionSource: 'updateSpec'
    });

    emitPointerMove(lineChart, { x: 'B', y: 18, series: 's1' });

    expect(tooltipShowSpy).toBeCalledTimes(2);

    const crosshair = lineChart.getComponents().find(component => component.type === 'cartesianCrosshair') as
      | CrosshairStateForTest
      | undefined;
    expect(crosshair?._stateByField?.xField?.currentValue?.size).toBeGreaterThan(0);

    lineChart.release();
    removeDom(lineContainer);
  });

  it('should fire tooltipRelease before release chart', () => {
    const handleTooltipRelease = jest.fn();
    vchart.on('tooltipRelease', handleTooltipRelease);

    vchart.release();

    expect(handleTooltipRelease).toBeCalledTimes(1);
  });

  it('should keep series element-active triggers isolated in common chart', () => {
    const commonContainer = createDiv();
    const commonDom = createDiv(commonContainer);
    commonDom.id = 'common-container';
    commonContainer.style.position = 'fixed';
    commonContainer.style.width = '500px';
    commonContainer.style.height = '500px';
    commonContainer.style.top = '0px';
    commonContainer.style.left = '0px';

    const commonChart = new VChart(
      {
        type: 'common',
        data: [
          {
            id: 'barData',
            values: [
              { x: 'Mon', y: 10 },
              { x: 'Tue', y: 12 }
            ]
          },
          {
            id: 'lineData',
            values: [
              { x: 'Mon', y: 8 },
              { x: 'Tue', y: 15 }
            ]
          }
        ],
        series: [
          {
            type: 'line',
            dataId: 'lineData',
            xField: 'x',
            yField: 'y',
            line: {
              state: {
                active: {
                  lineWidth: 4
                }
              }
            },
            interactions: [
              {
                type: 'element-active',
                trigger: 'click'
              }
            ]
          },
          {
            type: 'bar',
            dataId: 'barData',
            xField: 'x',
            yField: 'y',
            bar: {
              state: {
                active: {
                  stroke: '#000',
                  lineWidth: 2
                }
              }
            },
            interactions: [
              {
                type: 'element-active',
                trigger: 'pointerover'
              }
            ]
          }
        ],
        axes: [{ orient: 'left' }, { orient: 'bottom', type: 'band' }]
      } as ICommonChartSpec,
      {
        dom: commonDom,
        animation: false
      }
    );

    commonChart.renderSync();

    try {
      const chart = commonChart.getChart() as IChart;
      const barSeries = chart.getAllSeries().find((series: ISeries) => series.type === 'bar');
      expect(barSeries).toBeDefined();
      if (!barSeries) {
        throw new Error('Expected bar series to exist');
      }

      const barMark = barSeries.getMarks().find((mark: IMark) => mark.name === 'bar');
      expect(barMark).toBeDefined();
      if (!barMark) {
        throw new Error('Expected bar mark to exist');
      }

      const barGraphic = barMark.getGraphics()[0] as IMarkGraphic;

      chart.getEvent().emit('pointerover', { item: barGraphic } as unknown as BaseEventParams);
      expect(barGraphic.hasState('active')).toBe(true);

      chart.getEvent().emit('pointerout', { item: barGraphic } as unknown as BaseEventParams);
      expect(barGraphic.hasState('active')).toBe(false);

      chart.getEvent().emit('click', { item: barGraphic } as unknown as BaseEventParams);
      expect(barGraphic.hasState('active')).toBe(false);
    } finally {
      commonChart.release();
      removeDom(commonContainer);
    }
  });

  it('should apply interaction state style through vrender state patch', () => {
    const stateContainer = createDiv();
    const stateDom = createDiv(stateContainer);

    const chartWithState = new VChart(
      {
        type: 'bar',
        width: 400,
        height: 300,
        data: [
          {
            id: 'data',
            values: [
              { x: 'Mon', y: 10 },
              { x: 'Tue', y: 12 }
            ]
          }
        ],
        xField: 'x',
        yField: 'y',
        hover: { enable: true, trigger: 'pointerover', triggerOff: 'pointerout' },
        select: { enable: true, trigger: 'click', mode: 'single' },
        bar: {
          state: {
            hover: {
              fillOpacity: 0.31
            },
            selected: {
              stroke: '#111827',
              lineWidth: 4
            }
          }
        }
      } as IBarChartSpec,
      {
        dom: stateDom,
        animation: false
      }
    );

    chartWithState.renderSync();

    try {
      const chart = chartWithState.getChart() as IChart;
      const barSeries = chart.getAllSeries()[0];
      const barMark = barSeries.getMarks().find((mark: IMark) => mark.name === 'bar');
      expect(barMark).toBeDefined();
      if (!barMark) {
        throw new Error('Expected bar mark to exist');
      }

      const barGraphic = barMark.getGraphics()[0] as StateGraphic;
      expect(barGraphic).toBeDefined();
      const sharedStateDefinitions = getSharedStateDefinitions(barMark);
      expect(sharedStateDefinitions?.hover?.patch).toEqual({ fillOpacity: 0.31 });
      expect(sharedStateDefinitions?.hover?.resolver).toBeUndefined();
      expect(sharedStateDefinitions?.selected?.patch).toEqual({ stroke: '#111827', lineWidth: 4 });
      expect(sharedStateDefinitions?.selected?.resolver).toBeUndefined();

      chart.getEvent().emit('pointerover', { item: barGraphic } as unknown as BaseEventParams);

      expect(barGraphic.hasState('hover')).toBe(true);
      expect(barGraphic.resolvedStatePatch?.fillOpacity).toBe(0.31);
      expect(barGraphic.attribute.fillOpacity).toBe(0.31);

      chart.getEvent().emit('pointerout', { item: barGraphic } as unknown as BaseEventParams);

      expect(barGraphic.hasState('hover')).toBe(false);
      expect(barGraphic.resolvedStatePatch).toBeUndefined();
      expect(barGraphic.attribute.fillOpacity).not.toBe(0.31);

      chart.getEvent().emit('click', { item: barGraphic } as unknown as BaseEventParams);

      expect(barGraphic.hasState('selected')).toBe(true);
      expect(barGraphic.resolvedStatePatch?.stroke).toBe('#111827');
      expect(barGraphic.resolvedStatePatch?.lineWidth).toBe(4);
      expect(barGraphic.attribute.stroke).toBe('#111827');
      expect(barGraphic.attribute.lineWidth).toBe(4);

      chartWithState.updateSpecSync({
        ...(chartWithState.getSpec() as IBarChartSpec),
        data: [
          {
            id: 'data',
            values: [
              { x: 'Mon', y: 14 },
              { x: 'Tue', y: 16 }
            ]
          }
        ]
      });

      barGraphic.useStates([]);

      expect(barGraphic.resolvedStatePatch).toBeUndefined();
      expect(barGraphic.attribute.stroke).not.toBe('#111827');
      expect(barGraphic.attribute.lineWidth).not.toBe(4);
    } finally {
      chartWithState.release();
      removeDom(stateContainer);
    }
  });

  it('should not sync vrender states for graphics without state styles during update', () => {
    const stateContainer = createDiv();
    const stateDom = createDiv(stateContainer);

    const chartWithoutState = new VChart(
      {
        type: 'bar',
        width: 400,
        height: 300,
        data: [
          {
            id: 'data',
            values: [
              { x: 'Mon', y: 10 },
              { x: 'Tue', y: 12 }
            ]
          }
        ],
        xField: 'x',
        yField: 'y'
      } as IBarChartSpec,
      {
        dom: stateDom,
        animation: false
      }
    );

    chartWithoutState.renderSync();

    try {
      const chart = chartWithoutState.getChart() as IChart;
      const barSeries = chart.getAllSeries()[0];
      const barMark = barSeries.getMarks().find((mark: IMark) => mark.name === 'bar');
      expect(barMark).toBeDefined();
      if (!barMark) {
        throw new Error('Expected bar mark to exist');
      }

      const barGraphic = barMark.getGraphics()[0] as StateGraphic;
      const clearStates = jest.spyOn(barGraphic, 'clearStates');
      const useStates = jest.spyOn(barGraphic, 'useStates');
      const setStates = jest.spyOn(barGraphic, 'setStates');

      barGraphic.context.diffState = DiffState.update;
      barGraphic.context.states = [];
      (barMark as any)._setStateOfGraphic(barGraphic, false);

      expect(clearStates).not.toHaveBeenCalled();
      expect(useStates).not.toHaveBeenCalled();
      expect(setStates).not.toHaveBeenCalled();
      expect(getSharedStateDefinitions(barMark)).toBeUndefined();
    } finally {
      chartWithoutState.release();
      removeDom(stateContainer);
    }
  });

  it('should keep shared vrender state definitions stable across data updates', () => {
    const stateContainer = createDiv();
    const stateDom = createDiv(stateContainer);

    const chartWithState = new VChart(
      {
        type: 'bar',
        width: 400,
        height: 300,
        data: [
          {
            id: 'data',
            values: [
              { x: 'Mon', y: 10 },
              { x: 'Tue', y: 12 }
            ]
          }
        ],
        xField: 'x',
        yField: 'y',
        bar: {
          state: {
            hover: {
              fillOpacity: 0.31
            }
          }
        }
      } as IBarChartSpec,
      {
        dom: stateDom,
        animation: false
      }
    );

    chartWithState.renderSync();

    try {
      const chart = chartWithState.getChart() as IChart;
      const barSeries = chart.getAllSeries()[0];
      const barMark = barSeries.getMarks().find((mark: IMark) => mark.name === 'bar');
      expect(barMark).toBeDefined();
      if (!barMark) {
        throw new Error('Expected bar mark to exist');
      }

      const firstDefinitions = getSharedStateDefinitions(barMark);
      expect(firstDefinitions).toBeDefined();
      expect(firstDefinitions?.hover?.patch).toEqual({ fillOpacity: 0.31 });
      expect(firstDefinitions?.hover?.resolver).toBeUndefined();

      chartWithState.updateSpecSync({
        ...(chartWithState.getSpec() as IBarChartSpec),
        data: [
          {
            id: 'data',
            values: [
              { x: 'Mon', y: 14 },
              { x: 'Tue', y: 16 }
            ]
          }
        ]
      });

      expect(getSharedStateDefinitions(barMark)).toBe(firstDefinitions);

      const barGraphic = barMark.getGraphics()[0] as StateGraphic;
      barGraphic.useStates(['hover']);
      barGraphic.context.diffState = DiffState.update;
      barGraphic.context.states = ['hover'];

      const invalidateResolver = jest.spyOn(barGraphic, 'invalidateResolver');
      const setStates = jest.spyOn(barGraphic, 'setStates');

      (barMark as any)._setStateOfGraphic(barGraphic, false);

      expect(invalidateResolver).not.toHaveBeenCalled();
      expect(setStates).toHaveBeenCalledWith(['hover'], {
        animate: false,
        animateSameStatePatchChange: true
      });
    } finally {
      chartWithState.release();
      removeDom(stateContainer);
    }
  });

  it('should invalidate same-state vrender resolver only for dynamic state styles', () => {
    const stateContainer = createDiv();
    const stateDom = createDiv(stateContainer);

    const chartWithDynamicState = new VChart(
      {
        type: 'bar',
        width: 400,
        height: 300,
        data: [
          {
            id: 'data',
            values: [{ x: 'Mon', y: 10 }]
          }
        ],
        xField: 'x',
        yField: 'y',
        bar: {
          state: {
            hover: {
              fillOpacity: ((datum: { y: number }) => (datum?.y > 5 ? 0.31 : 0.21)) as any
            }
          }
        }
      } as IBarChartSpec,
      {
        dom: stateDom,
        animation: false
      }
    );

    chartWithDynamicState.renderSync();

    try {
      const chart = chartWithDynamicState.getChart() as IChart;
      const barSeries = chart.getAllSeries()[0];
      const barMark = barSeries.getMarks().find((mark: IMark) => mark.name === 'bar');
      expect(barMark).toBeDefined();
      if (!barMark) {
        throw new Error('Expected bar mark to exist');
      }

      const sharedStateDefinitions = getSharedStateDefinitions(barMark);
      expect(sharedStateDefinitions?.hover?.patch).toBeUndefined();
      expect(typeof sharedStateDefinitions?.hover?.resolver).toBe('function');

      const barGraphic = barMark.getGraphics()[0] as StateGraphic;
      barGraphic.useStates(['hover']);
      barGraphic.context.diffState = DiffState.update;
      barGraphic.context.states = ['hover'];

      const invalidateResolver = jest.spyOn(barGraphic, 'invalidateResolver');
      const setStates = jest.spyOn(barGraphic, 'setStates');

      (barMark as any)._setStateOfGraphic(barGraphic, false);

      expect(invalidateResolver).not.toHaveBeenCalled();
      expect(setStates).toHaveBeenCalledWith(['hover'], {
        animate: false,
        animateSameStatePatchChange: true
      });
    } finally {
      chartWithDynamicState.release();
      removeDom(stateContainer);
    }
  });

  it('should apply line interaction state style through shared vrender state definitions', () => {
    const stateContainer = createDiv();
    const stateDom = createDiv(stateContainer);

    const chartWithState = new VChart(
      {
        type: 'line',
        width: 400,
        height: 300,
        data: [
          {
            id: 'data',
            values: [
              { x: 'Mon', y: 10 },
              { x: 'Tue', y: 12 }
            ]
          }
        ],
        xField: 'x',
        yField: 'y',
        hover: { enable: true, trigger: 'pointerover', triggerOff: 'pointerout' },
        select: { enable: true, trigger: 'click', mode: 'single' },
        line: {
          state: {
            hover: {
              stroke: '#ea580c'
            },
            selected: {
              lineWidth: 5
            }
          }
        }
      } as ILineChartSpec,
      {
        dom: stateDom,
        animation: false
      }
    );

    chartWithState.renderSync();

    try {
      const chart = chartWithState.getChart() as IChart;
      const lineSeries = chart.getAllSeries()[0];
      const lineMark = lineSeries.getMarks().find((mark: IMark) => mark.name === 'line');
      expect(lineMark).toBeDefined();
      if (!lineMark) {
        throw new Error('Expected line mark to exist');
      }

      const lineGraphic = lineMark.getGraphics()[0] as StateGraphic;
      const sharedStateDefinitions = getSharedStateDefinitions(lineMark);
      expect(sharedStateDefinitions?.hover?.patch?.stroke).toBe('#ea580c');
      expect(sharedStateDefinitions?.hover?.resolver).toBeUndefined();
      expect(sharedStateDefinitions?.selected?.patch?.lineWidth).toBe(5);
      expect(sharedStateDefinitions?.selected?.resolver).toBeUndefined();

      chart.getEvent().emit('pointerover', { item: lineGraphic } as unknown as BaseEventParams);
      expect(lineGraphic.hasState('hover')).toBe(true);
      expect(lineGraphic.resolvedStatePatch?.stroke).toBe('#ea580c');
      expect(lineGraphic.attribute.stroke).toBe('#ea580c');

      chart.getEvent().emit('pointerout', { item: lineGraphic } as unknown as BaseEventParams);
      expect(lineGraphic.hasState('hover')).toBe(false);
      expect(lineGraphic.resolvedStatePatch).toBeUndefined();
      expect(lineGraphic.attribute.stroke).not.toBe('#ea580c');

      chart.getEvent().emit('click', { item: lineGraphic } as unknown as BaseEventParams);
      expect(lineGraphic.hasState('selected')).toBe(true);
      expect(lineGraphic.resolvedStatePatch?.lineWidth).toBe(5);
      expect(lineGraphic.attribute.lineWidth).toBe(5);

      lineGraphic.useStates([]);
      expect(lineGraphic.resolvedStatePatch).toBeUndefined();
    } finally {
      chartWithState.release();
      removeDom(stateContainer);
    }
  });

  it('should apply text custom-mark interaction state style through shared vrender state definitions', () => {
    const stateContainer = createDiv();
    const stateDom = createDiv(stateContainer);

    const chartWithState = new VChart(
      {
        type: 'bar',
        width: 400,
        height: 300,
        data: [
          {
            id: 'data',
            values: [{ x: 'Mon', y: 10 }]
          }
        ],
        xField: 'x',
        yField: 'y',
        hover: { enable: true, trigger: 'pointerover', triggerOff: 'pointerout' },
        select: { enable: true, trigger: 'click', mode: 'single' },
        customMark: [
          {
            type: 'text',
            name: 'stateText',
            style: {
              x: 40,
              y: 40,
              text: 'state',
              fill: '#334155',
              fontSize: 14
            },
            state: {
              hover: {
                fill: '#dc2626'
              },
              selected: {
                fontSize: 24
              }
            }
          }
        ]
      } as IBarChartSpec,
      {
        dom: stateDom,
        animation: false
      }
    );

    chartWithState.renderSync();

    try {
      const chart = chartWithState.getChart() as IChart;
      const textMark = chart.getAllMarks().find((mark: IMark) => mark.name === 'stateText');
      expect(textMark).toBeDefined();
      if (!textMark) {
        throw new Error('Expected text custom mark to exist');
      }

      const textGraphic = textMark.getGraphics()[0] as StateGraphic;
      const sharedStateDefinitions = getSharedStateDefinitions(textMark);
      expect(sharedStateDefinitions?.hover?.patch?.fill).toBe('#dc2626');
      expect(sharedStateDefinitions?.hover?.resolver).toBeUndefined();
      expect(sharedStateDefinitions?.selected?.patch?.fontSize).toBe(24);
      expect(sharedStateDefinitions?.selected?.resolver).toBeUndefined();

      textGraphic.useStates(['hover']);
      expect(textGraphic.hasState('hover')).toBe(true);
      expect(textGraphic.resolvedStatePatch?.fill).toBe('#dc2626');
      expect(textGraphic.attribute.fill).toBe('#dc2626');

      textGraphic.useStates([]);
      expect(textGraphic.hasState('hover')).toBe(false);
      expect(textGraphic.resolvedStatePatch).toBeUndefined();
      expect(textGraphic.attribute.fill).not.toBe('#dc2626');

      textGraphic.useStates(['selected']);
      expect(textGraphic.hasState('selected')).toBe(true);
      expect(textGraphic.resolvedStatePatch?.fontSize).toBe(24);
      expect(textGraphic.attribute.fontSize).toBe(24);

      textGraphic.useStates([]);
      expect(textGraphic.resolvedStatePatch).toBeUndefined();
    } finally {
      chartWithState.release();
      removeDom(stateContainer);
    }
  });

  it('should merge only identical interaction triggers in common chart', () => {
    const commonContainer = createDiv();
    const commonDom = createDiv(commonContainer);

    const createSpec = (
      lineTrigger: 'click' | 'pointerover',
      barTrigger: 'click' | 'pointerover'
    ): ICommonChartSpec => ({
      type: 'common',
      data: [
        {
          id: 'barData',
          values: [
            { x: 'Mon', y: 10 },
            { x: 'Tue', y: 12 }
          ]
        },
        {
          id: 'lineData',
          values: [
            { x: 'Mon', y: 8 },
            { x: 'Tue', y: 15 }
          ]
        }
      ],
      series: [
        {
          type: 'line',
          dataId: 'lineData',
          xField: 'x',
          yField: 'y',
          line: {
            state: {
              active: {
                lineWidth: 4
              }
            }
          },
          interactions: [
            {
              type: 'element-active',
              trigger: lineTrigger
            }
          ]
        },
        {
          type: 'bar',
          dataId: 'barData',
          xField: 'x',
          yField: 'y',
          bar: {
            state: {
              active: {
                stroke: '#000',
                lineWidth: 2
              }
            }
          },
          interactions: [
            {
              type: 'element-active',
              trigger: barTrigger
            }
          ]
        }
      ],
      axes: [{ orient: 'left' }, { orient: 'bottom', type: 'band' }]
    });

    const getActiveTriggerCount = (spec: ICommonChartSpec) => {
      const chart = new VChart(spec, {
        dom: commonDom,
        animation: false
      });

      chart.renderSync();

      try {
        const activeTriggers = ((
          chart.getChart() as unknown as {
            _interaction: { _triggerMapByState: Map<string, unknown[]> };
          }
        )._interaction._triggerMapByState.get('active') ?? []) as unknown[];

        return activeTriggers.length;
      } finally {
        chart.release();
      }
    };

    try {
      expect(getActiveTriggerCount(createSpec('pointerover', 'pointerover'))).toBe(1);
      expect(getActiveTriggerCount(createSpec('click', 'pointerover'))).toBe(2);
    } finally {
      removeDom(commonContainer);
    }
  });
});

describe('discrete legend with custom data after updateSpec', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let vchart: VChart;

  const data1 = [
    { x: '周一', type: '早餐', y: 15 },
    { x: '周一', type: '午餐', y: 25 },
    { x: '周二', type: '早餐', y: 12 },
    { x: '周二', type: '午餐', y: 30 }
  ];

  const data2 = [
    { x: '周一', type: '早餐2', y: 15 },
    { x: '周一', type: '午餐2', y: 25 },
    { x: '周二', type: '早餐2', y: 12 },
    { x: '周二', type: '午餐2', y: 30 },
    { x: '周一', type: '饮料2', y: 22 },
    { x: '周二', type: '饮料2', y: 43 }
  ];

  beforeEach(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.id = 'container';
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';

    const spec = {
      type: 'common',
      animation: false,
      data: [
        {
          id: 'id0',
          values: data1
        }
      ],
      seriesField: 'type',
      legends: [
        {
          orient: 'right',
          visible: true,
          data: (items: any[]) => items
        }
      ],
      series: [
        {
          type: 'line',
          id: 'line',
          dataIndex: 0,
          xField: ['x'],
          yField: 'y'
        }
      ],
      axes: [
        { orient: 'left', seriesIndex: [0] },
        { orient: 'bottom', label: { visible: true }, type: 'band' }
      ]
    } as any;

    vchart = new VChart(spec, {
      dom,
      animation: false
    });
    vchart.renderSync();
  });

  afterEach(() => {
    vchart.release();
    removeDom(container);
  });

  it('should keep legend filtering working after updateSpecSync without remake', () => {
    const nextSpec = {
      ...vchart.getSpec(),
      data: [
        {
          id: 'id0',
          values: data2
        }
      ],
      legends: [
        {
          orient: 'right',
          visible: true,
          data: (items: any[]) => items
        }
      ]
    };

    vchart.updateSpecSync(nextSpec, false, undefined, {
      change: false,
      reMake: false
    });

    const legend = vchart.getComponents().find(com => com.type === 'discreteLegend') as any;
    const legendComponent = legend.getVRenderComponents()[0] as any;
    const legendItem = legendComponent._itemsContainer.getChildren()[0];
    const series = vchart.getChart()?.getAllSeries()[0];
    const vrenderLegendClickSpy = jest.fn();

    legendComponent.addEventListener('legendItemClick', vrenderLegendClickSpy);

    expect(legend.getLegendDefaultData()).toEqual(['早餐2', '午餐2', '饮料2']);
    expect(series?.getViewData()?.latestData.map((datum: any) => datum.type)).toEqual([
      '早餐2',
      '午餐2',
      '早餐2',
      '午餐2',
      '饮料2',
      '饮料2'
    ]);

    legendComponent._onClick({ target: legendItem });

    expect(vrenderLegendClickSpy).toHaveBeenCalledTimes(1);
    expect(vrenderLegendClickSpy.mock.calls[0]?.[0]?.detail?.currentSelected).toEqual(['午餐2', '饮料2']);
    expect(legend.getSelectedData()).toEqual(['午餐2', '饮料2']);
    expect(series?.getViewData()?.latestData.map((datum: any) => datum.type)).toEqual([
      '午餐2',
      '午餐2',
      '饮料2',
      '饮料2'
    ]);
  });
});
