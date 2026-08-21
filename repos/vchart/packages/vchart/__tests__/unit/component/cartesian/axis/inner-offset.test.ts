import type { ILineChartSpec } from '../../../../../src';
import { default as VChart } from '../../../../../src';
import { createCanvas, removeDom } from '../../../../util/dom';

describe('VChart', () => {
  describe('get mark position with innerOffset', () => {
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
    it('convertDatumToPosition', async () => {
      const spec: ILineChartSpec = {
        type: 'line',
        width: 400,
        height: 400,
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
        axes: [
          {
            orient: 'bottom',
            visible: false,
            tick: {
              visible: false
            },
            domainLine: {
              visible: false
            },
            bandPadding: 0,
            innerOffset: {
              left: 20,
              right: 20
            }
          },
          {
            orient: 'left',
            visible: false,
            grid: {
              visible: false
            },
            tick: {
              visible: false,
              tickCount: 3
            },
            domainLine: {
              visible: false
            },
            innerOffset: {
              top: 20
            }
          }
        ]
      };
      vchart = new VChart(spec, {
        renderCanvas: canvasDom,
        autoFit: true,
        animation: false
      });

      await vchart.renderAsync();
      const pos0 = vchart.convertDatumToPosition({
        x: 'Mon',
        y: 100,
        type: '销售额'
      });
      const pos1 = vchart.convertDatumToPosition({
        x: 'Sat',
        y: 72,
        type: '利润'
      });
      expect(pos0?.x).toBeCloseTo(31.42, 0);
      expect(pos0?.y).toBeCloseTo(20, 0);
      expect(pos1?.x).toBeCloseTo(282.85, 0);
      expect(pos1?.y).toBeCloseTo(115.2, 0);
    });
  });
});
