import { Stage, type Group, type IApp, type IArc, type Text } from '@visactor/vrender-core';
import { createBrowserVRenderApp, getSharedVRenderApp, releaseSharedVRenderApp } from '@visactor/vrender';
import type { IBarChartSpec } from '../../../src';
import { default as VChart } from '../../../src';
import { registerBrowserEnv } from '../../../src/env';
import { createDiv, createCanvas, removeDom } from '../../util/dom';
import type { ICommonChartSpec } from '../../../src/chart/common';
import type { IAreaSeriesSpec } from '../../../src/series/area/interface';
import type { IPoint } from '../../../src/typings';
import { polarToCartesian } from '@visactor/vutils';
import type { IMarkGraphic } from '../../../src/mark/interface';
import type { BaseEventParams } from '../../../src/event/interface';
import type { IChartSpec } from '../../../src/typings/spec/common';

describe('VChart', () => {
  describe('render and update', () => {
    let canvasDom: HTMLCanvasElement;
    let vchart: VChart;
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
      vchart.release();
    });
    it('render', async () => {
      const spec: IBarChartSpec = {
        type: 'bar',
        width: 200,
        height: 150,
        background: 'red',
        data: [
          {
            name: 'data',
            values: [
              {
                x: 'Mon',
                y: 100,
                type: '销售额'
              },
              {
                x: 'Tues',
                y: 66,
                type: '销售额'
              },
              {
                x: 'Wed',
                y: 95,
                type: '销售额'
              },
              {
                x: 'Thus',
                y: 52,
                type: '销售额'
              },
              {
                x: 'Fri',
                y: 68,
                type: '销售额'
              },
              {
                x: 'Sat',
                y: 52,
                type: '销售额'
              },
              {
                x: 'sun',
                y: 48,
                type: '销售额'
              },
              {
                x: 'Mon',
                y: 43,
                type: '利润'
              },
              {
                x: 'Tues',
                y: 80,
                type: '利润'
              },
              {
                x: 'Wed',
                y: 68,
                type: '利润'
              },
              {
                x: 'Thus',
                y: 40,
                type: '利润'
              },
              {
                x: 'Fri',
                y: 53,
                type: '利润'
              },
              {
                x: 'Sat',
                y: 72,
                type: '利润'
              },
              {
                x: 'sun',
                y: 71,
                type: '利润'
              }
            ]
          }
        ],
        xField: ['x', 'type'],
        yField: 'y',
        seriesField: 'type',
        bar: {
          style: {
            cornerRadiusTopLeft: 10,
            cornerRadiusTopRight: 10,
            cornerRadiusBottomRight: 10,
            cornerRadiusBottomLeft: 10,
            stroke: '#fff',
            strokeWidth: 3
          },
          state: {
            selected: {
              stroke: '#000',
              strokeWidth: 1
            }
          }
        },
        // color: {
        //   range: ['#4CC9E4', '#4954E6']
        // },
        axes: [
          {
            orient: 'bottom',
            tick: {
              visible: false
            },
            domainLine: {
              visible: false
            },
            bandPadding: 0
            // paddingInner: 0.5,
          },
          {
            orient: 'left',
            grid: {
              visible: false
            },
            tick: {
              visible: false,
              tickCount: 3
            },
            domainLine: {
              visible: false
            }
          }
        ],
        dataZoom: {
          visible: true
        }
      };
      vchart = new VChart(spec, {
        renderCanvas: canvasDom,
        background: 'yellow',
        autoFit: true,
        animation: false
      });

      expect((vchart as any)._currentSize).toEqual({
        width: 200,
        height: 150
      });

      await vchart.renderAsync();

      expect(vchart.getStage()).toBeDefined();
      expect(vchart.getStage().background).toBe('red');
      expect(vchart.getChart()?.getComponentsByKey('dataZoom').length).toBe(1);
    });

    it('updateData', () => {
      const spec: ICommonChartSpec = {
        type: 'common',
        series: [
          {
            type: 'area',
            data: {
              id: 'areaData'
            },
            xField: 'x',
            yField: 'y',
            seriesField: 'type'
          } as IAreaSeriesSpec
        ],
        axes: [
          { orient: 'left', range: { min: 0 } },
          { orient: 'bottom', label: { visible: true }, type: 'band' }
        ]
      };
      const data = [
        { x: '0', type: 'A', y: '800' },
        { x: '1', type: 'A', y: '707' },
        { x: '2', type: 'A', y: '832' },
        { x: '3', type: 'A', y: '726' },
        { x: '4', type: 'A', y: '756' },
        { x: '5', type: 'A', y: '777' },
        { x: '6', type: 'A', y: '689' },
        { x: '7', type: 'A', y: '795' },
        { x: '8', type: 'A', y: '889' },
        { x: '9', type: 'A', y: '757' },
        { x: '0', type: 'B', y: '773' },
        { x: '1', type: 'B', y: '785' },
        { x: '2', type: 'B', y: '635' },
        { x: '3', type: 'B', y: '813' },
        { x: '4', type: 'B', y: '678' },
        { x: '5', type: 'B', y: '796' },
        { x: '6', type: 'B', y: '652' },
        { x: '7', type: 'B', y: '623' },
        { x: '8', type: 'B', y: '649' },
        { x: '9', type: 'B', y: '630' }
      ];
      vchart = new VChart(spec, {
        renderCanvas: canvasDom,
        background: 'yellow',
        animation: false
      });
      vchart.updateData('areaData', data);
      vchart.renderSync();
      expect(vchart.getChart()?.getAllSeries()[0].getRawData()?.latestData.length).toBe(data.length);
    });

    it('does not duplicate user event registered before updateSpec initializes chart', () => {
      const spec: IBarChartSpec = {
        type: 'bar',
        direction: 'horizontal',
        data: [
          {
            id: 'barData',
            values: [
              { cat: '类目一', value: 80 },
              { cat: '类目二', value: 52 }
            ]
          }
        ],
        yField: 'cat',
        xField: 'value'
      };
      const eventSpy = jest.fn();
      const emptySpec: IChartSpec = { type: '' };
      const eventParams: BaseEventParams = {
        source: 'chart',
        model: { type: 'bar' } as unknown as BaseEventParams['model'],
        event: {
          stopPropagation: jest.fn(),
          preventDefault: jest.fn()
        } as unknown as BaseEventParams['event'],
        item: null as unknown as BaseEventParams['item'],
        datum: null as unknown as BaseEventParams['datum']
      };

      vchart = new VChart(emptySpec, {
        renderCanvas: canvasDom,
        animation: false
      });
      vchart.on('click', { source: 'chart', level: 'model' }, eventSpy);
      vchart.updateSpecSync(spec);
      vchart.event.emit('click', eventParams, 'model');

      expect(eventSpy).toBeCalledTimes(1);
    });

    it('updateViewBox', async () => {
      const spec: ICommonChartSpec = {
        type: 'common',
        series: [
          {
            type: 'area',
            data: {
              id: 'areaData'
            },
            xField: 'x',
            yField: 'y',
            seriesField: 'type'
          } as IAreaSeriesSpec
        ],
        axes: [
          { orient: 'left', range: { min: 0 } },
          { orient: 'bottom', label: { visible: true }, type: 'band' }
        ]
      };
      const data = [
        { x: '0', type: 'A', y: '800' },
        { x: '1', type: 'A', y: '707' },
        { x: '2', type: 'A', y: '832' },
        { x: '3', type: 'A', y: '726' },
        { x: '4', type: 'A', y: '756' },
        { x: '5', type: 'A', y: '777' },
        { x: '6', type: 'A', y: '689' },
        { x: '7', type: 'A', y: '795' },
        { x: '8', type: 'A', y: '889' },
        { x: '9', type: 'A', y: '757' },
        { x: '0', type: 'B', y: '773' },
        { x: '1', type: 'B', y: '785' },
        { x: '2', type: 'B', y: '635' },
        { x: '3', type: 'B', y: '813' },
        { x: '4', type: 'B', y: '678' },
        { x: '5', type: 'B', y: '796' },
        { x: '6', type: 'B', y: '652' },
        { x: '7', type: 'B', y: '623' },
        { x: '8', type: 'B', y: '649' },
        { x: '9', type: 'B', y: '630' }
      ];
      vchart = new VChart(spec, {
        renderCanvas: canvasDom,
        background: 'yellow',
        animation: false
      });
      vchart.renderSync();

      await vchart.updateData('areaData', data);
      vchart.updateViewBox({ x1: 10, y1: 10, x2: 200, y2: 150 });

      const rootGroup = vchart.getStage().defaultLayer.find(node => node.name === 'root', false) as unknown as Group;

      const leftAxisLabelGroup = rootGroup.children.find(child =>
        child.name?.includes('axis-left')
      ) as unknown as Group;
      const labels = leftAxisLabelGroup.find(
        node => node.name === 'axis-label-container-layer-0',
        true
      ) as unknown as Group;
      expect(labels.childrenCount).toBe(5);

      expect((labels.children[1] as Text).attribute.fillOpacity).toBe(1);
      expect((labels.children[1] as Text).attribute.text).toBe(400);
      expect((labels.children[2] as Text).attribute.fillOpacity).toBe(1);
      expect((labels.children[2] as Text).attribute.text).toBe(800);
      expect((labels.children[3] as Text).attribute.fillOpacity).toBe(1);
      expect((labels.children[3] as Text).attribute.text).toBe(1200);
    });

    it('reLayout', () => {
      const spec: IBarChartSpec = {
        type: 'bar',
        width: 200,
        height: 150,
        data: [
          {
            id: 'data',
            values: [
              { x: 'Mon', y: 100 },
              { x: 'Tue', y: 66 }
            ]
          }
        ],
        xField: 'x',
        yField: 'y',
        axes: [{ orient: 'bottom', type: 'band' }, { orient: 'left' }]
      };

      vchart = new VChart(spec, {
        renderCanvas: canvasDom,
        animation: false
      });
      vchart.renderSync();

      const chart = vchart.getChart();
      const compiler = vchart.getCompiler();
      const resetLayoutItemTagSpy = jest.spyOn(chart, 'resetLayoutItemTag');
      const setLayoutTagSpy = jest.spyOn(chart, 'setLayoutTag');
      const renderSpy = jest.spyOn(compiler, 'render');
      const onEvaluateEndSpy = jest.spyOn(chart, 'onEvaluateEnd');

      vchart.reLayout();

      expect(resetLayoutItemTagSpy).toHaveBeenCalledTimes(1);
      expect(setLayoutTagSpy).toHaveBeenCalledWith(true, null, false);
      expect(renderSpy).toHaveBeenCalledTimes(1);
      expect(onEvaluateEndSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('convertDatumToPosition and convertValueToPosition', () => {
    let canvasDom: HTMLCanvasElement;
    let vchart: VChart;
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
      vchart.release();
    });

    it('should convert correctly in bar chart', () => {
      vchart = new VChart(
        {
          type: 'bar',
          data: [
            {
              id: 'barData',
              values: [
                {
                  State: 'WY',
                  年龄段: '小于5岁',
                  人口数量: 25635
                },
                {
                  State: 'WY',
                  年龄段: '5至13岁',
                  人口数量: 1890
                },
                {
                  State: 'WY',
                  年龄段: '14至17岁',
                  人口数量: 9314
                },
                {
                  State: 'DC',
                  年龄段: '小于5岁',
                  人口数量: 30352
                },
                {
                  State: 'DC',
                  年龄段: '5至13岁',
                  人口数量: 20439
                },
                {
                  State: 'DC',
                  年龄段: '14至17岁',
                  人口数量: 10225
                },
                {
                  State: 'VT',
                  年龄段: '小于5岁',
                  人口数量: 38253
                },
                {
                  State: 'VT',
                  年龄段: '5至13岁',
                  人口数量: 42538
                },
                {
                  State: 'VT',
                  年龄段: '14至17岁',
                  人口数量: 15757
                },
                {
                  State: 'ND',
                  年龄段: '小于5岁',
                  人口数量: 51896
                },
                {
                  State: 'ND',
                  年龄段: '5至13岁',
                  人口数量: 67358
                },
                {
                  State: 'ND',
                  年龄段: '14至17岁',
                  人口数量: 18794
                },
                {
                  State: 'AK',
                  年龄段: '小于5岁',
                  人口数量: 72083
                },
                {
                  State: 'AK',
                  年龄段: '5至13岁',
                  人口数量: 85640
                },
                {
                  State: 'AK',
                  年龄段: '14至17岁',
                  人口数量: 22153
                }
              ]
            }
          ],
          xField: 'State',
          yField: '人口数量',
          seriesField: '年龄段',
          stack: true,
          legends: {
            visible: true
          },
          bar: {
            // 配置柱图 hover 时的样式
            state: {
              hover: {
                stroke: '#000',
                lineWidth: 1
              }
            }
          },
          axes: [
            {
              orient: 'bottom',
              id: 'bottom'
            },
            {
              orient: 'left',
              id: 'left'
            }
          ]
        },
        {
          renderCanvas: canvasDom,
          animation: false
        }
      ) as VChart;
      vchart.renderSync();
      const mark = vchart.getChart()!.getStage().getElementsByType('rect')[0] as IMarkGraphic;
      const point = vchart.convertDatumToPosition({
        State: 'WY',
        年龄段: '小于5岁',
        人口数量: 25635
      }) as IPoint;
      expect(point.x).toBe(mark.attribute.x);
      expect(point.y).toBe(mark.attribute.y);

      const point2 = vchart.convertDatumToPosition(
        {
          State: 'WY',
          年龄段: '小于5岁',
          人口数量: 25635
        },
        {
          seriesIndex: 0
        },
        true
      ) as IPoint;
      expect(point2.x).toBe(
        mark.attribute.x + vchart.getChart()?.getAllSeries()[0].getRegion().getLayoutStartPoint().x
      );
      expect(point2.y).toBe(
        mark.attribute.y + vchart.getChart()?.getAllSeries()[0].getRegion().getLayoutStartPoint().y
      );

      const value1 = vchart.convertValueToPosition('WY', { axisId: 'bottom' });
      expect(value1).toBe(mark.attribute.x);

      const value2 = vchart.convertValueToPosition(0, { axisId: 'left' });
      expect(value2).toBe(vchart.getChart()!.getAllSeries()[0].getRegion().getLayoutRect().height);
    });

    it('should convert correctly in funnel chart', () => {
      vchart = new VChart(
        {
          type: 'common',
          data: [
            {
              id: 'funnel',
              values: [
                {
                  value: 100,
                  name: 'Step1'
                },
                {
                  value: 80,
                  name: 'Step2'
                },
                {
                  value: 60,
                  name: 'Step3'
                },
                {
                  value: 40,
                  name: 'Step4'
                },
                {
                  value: 20,
                  name: 'Step5'
                }
              ]
            }
          ],
          series: [
            {
              id: 'funnel',
              type: 'funnel',
              categoryField: 'name',
              valueField: 'value',
              label: {
                visible: true
              }
            }
          ]
        },
        {
          renderCanvas: canvasDom,
          animation: false
        }
      ) as VChart;
      vchart.renderSync();

      const mark = vchart.getChart()!.getStage().getElementsByType('polygon')[1];
      // @ts-ignore
      const centerX = (mark.attribute.points[0].x + mark.attribute.points[1].x) / 2;
      // @ts-ignore
      const centerY = (mark.attribute.points[0].y + mark.attribute.points[2].y) / 2;

      const point = vchart.convertDatumToPosition(
        {
          value: 80,
          name: 'Step2'
        },
        { seriesId: 'funnel' }
      ) as IPoint;

      expect(point.x).toBe(centerX);
      expect(point.y).toBe(centerY);

      expect(vchart.convertValueToPosition(['Step2', 80], { seriesId: 'funnel' })).toEqual({ x: centerX, y: centerY });
    });

    it('should convert correctly in pie chart', () => {
      vchart = new VChart(
        {
          type: 'pie',
          data: [
            {
              id: 'id0',
              values: [
                { type: 'oxygen', value: '46.60' },
                { type: 'silicon', value: '27.72' },
                { type: 'aluminum', value: '8.13' },
                { type: 'iron', value: '5' },
                { type: 'calcium', value: '3.63' },
                { type: 'sodium', value: '2.83' },
                { type: 'potassium', value: '2.59' },
                { type: 'others', value: '3.5' }
              ]
            }
          ],
          valueField: 'value',
          categoryField: 'type'
        },
        {
          renderCanvas: canvasDom,
          animation: false
        }
      ) as VChart;
      vchart.renderSync();

      const point = vchart.convertDatumToPosition(
        {
          value: 80,
          name: 'Step2'
        },
        { seriesId: 'funnel' }
      ) as IPoint;
      expect(point).toBeNull();
      const point1 = vchart.convertDatumToPosition({ type: 'sodium', value: '2.83' }) as IPoint;
      const mark = vchart
        .getChart()!
        .getStage()
        .getElementsByType('arc')
        .filter(ele => (ele as IMarkGraphic).context.groupKey === 'sodium')[0] as IArc;

      const markCoord = polarToCartesian(
        { x: mark.attribute.x as number, y: mark.attribute.y as number },
        mark.attribute.outerRadius as number,
        ((mark.attribute.startAngle as number) + (mark.attribute.endAngle as number)) / 2
      );

      expect(point1.x).toBe(markCoord.x);
      expect(point1.y).toBe(markCoord.y);
    });
  });

  describe('updateModelSpec', () => {
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

      const spec = {
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
              { x: '周六', type: '午餐', y: 10 },
              { x: '周日', type: '早餐', y: 20 },
              { x: '周日', type: '午餐', y: 19 }
            ]
          },
          {
            id: 'id1',
            values: [
              { x: '周一', type: '饮料', y: -52 },
              { x: '周二', type: '饮料', y: -43 },
              { x: '周三', type: '饮料', y: -33 },
              { x: '周四', type: '饮料', y: -22 },
              { x: '周五', type: '饮料', y: -10 },
              { x: '周六', type: '饮料', y: -30 },
              { x: '周日', type: '饮料', y: -50 }
            ]
          }
        ],
        series: [
          {
            type: 'bar',
            id: 'bar',
            dataIndex: 0,
            stack: false,
            label: { visible: true },
            seriesField: 'type',
            xField: ['x', 'type'],
            yField: 'y'
          },
          {
            type: 'line',
            id: 'line',
            dataIndex: 1,
            label: { visible: true },
            seriesField: 'type',
            xField: 'x',
            yField: 'y',
            stack: false
          }
        ],
        axes: [
          { orient: 'left', seriesIndex: [0], id: 'axisLeft', nice: false, zero: false },
          {
            orient: 'right',
            id: 'axisRight',
            seriesId: ['line'],
            grid: { visible: false },
            nice: false,
            zero: false,
            label: { autoLimit: false },
            maxWidth: '50%'
          },
          {
            orient: 'bottom',
            label: { visible: true },
            type: 'band',
            domain: ['周一', '周二', '周三']
          }
        ]
      };
      vchart = new VChart(spec as any, {
        dom,
        animation: false
      });
      vchart.renderSync();
    });

    afterEach(() => {
      removeDom(container);
      vchart.release();
    });

    it('axis domain change', async () => {
      await vchart.updateModelSpec('axisLeft', { min: -100, max: 100 } as any, true);

      let axis = vchart.getComponents().find(com => com.layout?.layoutOrient === 'left') as any;

      expect(axis.getScale().domain()).toEqual([-100, 100]);

      await vchart.updateModelSpec(
        'axisRight',
        {
          seriesId: ['bar', 'line']
        } as any,
        true
      );
      axis = vchart.getComponents().find(com => com.layout?.layoutOrient === 'right') as any;

      expect(axis.getScale().domain()).toEqual([-52, 30]);
    });
  });

  describe('external stage ownership', () => {
    let canvasDom: HTMLCanvasElement;
    let charts: VChart[];
    let externalStage: Stage | undefined;
    let rawExternalStageRelease: (() => void) | undefined;
    let externalApp: IApp | undefined;
    let rawExternalAppRelease: (() => void) | undefined;

    const spec = (valueOffset: number = 0): IBarChartSpec => ({
      type: 'bar',
      width: 200,
      height: 150,
      data: [
        {
          id: 'data',
          values: [
            { x: 'A', y: 12 + valueOffset },
            { x: 'B', y: 18 + valueOffset }
          ]
        }
      ],
      xField: 'x',
      yField: 'y',
      animation: false
    });

    const createExternalStage = () => {
      registerBrowserEnv();
      externalStage = new Stage({
        width: 200,
        height: 150,
        canvas: canvasDom,
        autoRender: true,
        disableDirtyBounds: true
      });
      rawExternalStageRelease = externalStage.release.bind(externalStage);
      return externalStage;
    };

    const createExternalApp = () => {
      externalApp = createBrowserVRenderApp();
      rawExternalAppRelease = externalApp.release.bind(externalApp);
      return externalApp;
    };

    beforeEach(() => {
      releaseSharedVRenderApp('browser');
      canvasDom = createCanvas();
      canvasDom.width = 200;
      canvasDom.height = 150;
      charts = [];
    });

    afterEach(() => {
      charts.forEach(chart => {
        if (!(chart as any)._isReleased) {
          chart.release();
        }
      });
      if (externalStage && (externalStage as any).releaseStatus !== 'released') {
        rawExternalStageRelease?.();
      }
      if (externalApp && !externalApp.released) {
        rawExternalAppRelease?.();
      }
      releaseSharedVRenderApp('browser');
      removeDom(canvasDom);
      externalStage = undefined;
      rawExternalStageRelease = undefined;
      externalApp = undefined;
      rawExternalAppRelease = undefined;
    });

    it('should not release an externally owned stage and should remove chart-owned root group', () => {
      const stage = createExternalStage();
      const releaseStage = jest.fn(() => rawExternalStageRelease?.());
      stage.release = releaseStage as any;

      const chart = new VChart(spec(), {
        stage: stage as any,
        animation: false
      });
      charts.push(chart);
      chart.renderSync();

      const rootGroup = stage.defaultLayer.find(node => node.name === 'root', false);
      expect(rootGroup).toBeDefined();
      const barMark = (chart.getChart() as any).getAllSeries()[0].getMarks()[0];
      const barProduct = barMark.getProduct();
      const removeBarProduct = jest.spyOn(barProduct.parent, 'removeChild');
      const removeRootGroup = jest.spyOn(stage.defaultLayer, 'removeChild');

      chart.release();

      expect(removeBarProduct).toHaveBeenCalledWith(barProduct, true);
      expect(removeRootGroup).toHaveBeenCalledWith(rootGroup, true);
      expect(releaseStage).not.toHaveBeenCalled();
      expect(stage.window).toBeDefined();
      expect(stage.defaultLayer).toBeDefined();
      expect(stage.defaultLayer.find(node => node === rootGroup, false)).toBeFalsy();
    });

    it('should allow a second VChart instance to reuse the same external stage', () => {
      const stage = createExternalStage();
      const releaseStage = jest.fn(() => rawExternalStageRelease?.());
      stage.release = releaseStage as any;

      const first = new VChart(spec(), {
        stage: stage as any,
        animation: false
      });
      charts.push(first);
      first.renderSync();
      first.updateSpecSync(spec(3));
      first.release();

      expect(releaseStage).not.toHaveBeenCalled();

      const second = new VChart(spec(6), {
        stage: stage as any,
        animation: false
      });
      charts.push(second);
      second.renderSync();
      second.release();

      expect(releaseStage).not.toHaveBeenCalled();
    });

    it('should still release an internally created stage', () => {
      const chart = new VChart(spec(), {
        renderCanvas: canvasDom,
        animation: false
      });
      charts.push(chart);
      chart.renderSync();

      const stage = chart.getStage() as unknown as Stage;
      const rawRelease = stage.release.bind(stage);
      const releaseStage = jest.fn(() => rawRelease());
      stage.release = releaseStage as any;

      chart.release();

      expect(releaseStage).toHaveBeenCalledTimes(1);
    });

    it('should use an external app to create an internally owned stage without releasing the app', () => {
      const app = createExternalApp();
      const createStage = jest.spyOn(app, 'createStage');
      const releaseApp = jest.fn(() => rawExternalAppRelease?.());
      app.release = releaseApp as any;

      const chart = new VChart(spec(), {
        app,
        renderCanvas: canvasDom,
        animation: false
      } as any);
      charts.push(chart);
      chart.renderSync();

      expect(createStage).toHaveBeenCalledTimes(1);

      const stage = chart.getStage() as unknown as Stage;
      const rawRelease = stage.release.bind(stage);
      const releaseStage = jest.fn(() => rawRelease());
      stage.release = releaseStage as any;

      chart.release();

      expect(releaseStage).toHaveBeenCalledTimes(1);
      expect(releaseApp).not.toHaveBeenCalled();
    });

    it('should reuse the default VRender shared app while keeping internally created stages isolated', () => {
      const secondCanvasDom = createCanvas();
      secondCanvasDom.width = 200;
      secondCanvasDom.height = 150;

      const first = new VChart(spec(), {
        renderCanvas: canvasDom,
        animation: false
      });
      charts.push(first);
      first.renderSync();

      const fallbackApp = getSharedVRenderApp('browser');
      expect(fallbackApp).toBeDefined();
      const createStage = jest.spyOn(fallbackApp!, 'createStage');

      const second = new VChart(spec(6), {
        renderCanvas: secondCanvasDom,
        animation: false
      });
      charts.push(second);
      second.renderSync();

      const firstStage = first.getStage() as unknown as Stage;
      const secondStage = second.getStage() as unknown as Stage;
      const rawSecondStageRelease = secondStage.release.bind(secondStage);
      const releaseSecondStage = jest.fn(() => rawSecondStageRelease());
      secondStage.release = releaseSecondStage as any;

      expect(getSharedVRenderApp('browser')).toBe(fallbackApp);
      expect(createStage).toHaveBeenCalledTimes(1);
      expect(firstStage).not.toBe(secondStage);

      first.release();

      expect(releaseSecondStage).not.toHaveBeenCalled();
      expect(getSharedVRenderApp('browser')).toBe(fallbackApp);
      expect(secondStage.window).toBeDefined();
      expect(secondStage.defaultLayer).toBeDefined();

      second.release();

      expect(releaseSecondStage).toHaveBeenCalledTimes(1);
      expect(getSharedVRenderApp('browser')).toBeNull();
      removeDom(secondCanvasDom);
    });

    it('should let VRender release the default shared app after the last internally owned stage is released', () => {
      const secondCanvasDom = createCanvas();
      secondCanvasDom.width = 200;
      secondCanvasDom.height = 150;

      const first = new VChart(spec(), {
        renderCanvas: canvasDom,
        animation: false
      });
      charts.push(first);
      first.renderSync();

      const fallbackApp = getSharedVRenderApp('browser');
      expect(fallbackApp).toBeDefined();

      const second = new VChart(spec(6), {
        renderCanvas: secondCanvasDom,
        animation: false
      });
      charts.push(second);
      second.renderSync();

      first.release();

      expect(getSharedVRenderApp('browser')).toBe(fallbackApp);
      expect(fallbackApp?.released).toBe(false);

      second.release();

      expect(getSharedVRenderApp('browser')).toBeNull();
      expect(fallbackApp?.released).toBe(true);
      removeDom(secondCanvasDom);
    });

    it('should keep the default dom render path working with fallback app stage creation', () => {
      const dom = createDiv();
      const chart = new VChart(spec(), {
        dom,
        animation: false
      });
      charts.push(chart);

      chart.renderSync();
      chart.updateSpecSync(spec(9));

      expect(chart.getStage()).toBeDefined();

      chart.release();
      removeDom(dom);
    });
  });
});
