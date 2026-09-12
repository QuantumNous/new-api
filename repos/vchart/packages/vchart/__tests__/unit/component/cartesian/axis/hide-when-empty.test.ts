import { default as VChartConstructor } from '../../../../../src';
import { createCanvas, removeDom } from '../../../../util/dom';

describe('cartesian axis hideWhenEmpty', () => {
  let canvasDom: HTMLCanvasElement;
  let vchart: any;

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
    vchart?.release();
  });

  const getAxis = (orient: string) =>
    vchart.getComponents().find((com: any) => com.layout?.layoutOrient === orient) as any;

  test('should hide axis on initial render when bound series has no collected data', () => {
    vchart = new VChartConstructor(
      {
        type: 'line',
        width: 400,
        height: 300,
        data: [{ id: 'lineData', values: [] }],
        axes: [
          { id: 'axis-left', orient: 'left', hideWhenEmpty: true },
          { id: 'axis-bottom', orient: 'bottom', type: 'band' }
        ],
        series: [{ type: 'line', dataId: 'lineData', xField: 'x', yField: 'y' }]
      } as any,
      {
        renderCanvas: canvasDom,
        animation: false
      }
    );

    vchart.renderSync();

    const leftAxis = getAxis('left');
    expect(leftAxis.getVisible()).toBe(false);
    expect(leftAxis.getLayoutRect().width).toBe(0);
  });

  test('should keep default behavior when hideWhenEmpty is not enabled', () => {
    vchart = new VChartConstructor(
      {
        type: 'line',
        width: 400,
        height: 300,
        data: [{ id: 'lineData', values: [] }],
        axes: [
          { id: 'axis-left', orient: 'left' },
          { id: 'axis-bottom', orient: 'bottom', type: 'band' }
        ],
        series: [{ type: 'line', dataId: 'lineData', xField: 'x', yField: 'y' }]
      } as any,
      {
        renderCanvas: canvasDom,
        animation: false
      }
    );

    vchart.renderSync();

    const leftAxis = getAxis('left');
    expect(leftAxis.getVisible()).toBe(true);
  });

  test('should only hide empty bound axes and show them again after data updates', async () => {
    vchart = new VChartConstructor(
      {
        type: 'common',
        width: 400,
        height: 300,
        data: [
          { id: 'emptyLine', values: [] },
          {
            id: 'activeLine',
            values: [
              { x: 'Mon', y: 10 },
              { x: 'Tue', y: 20 }
            ]
          }
        ],
        axes: [
          { id: 'axis-left', orient: 'left', seriesIndex: [0], hideWhenEmpty: true },
          { id: 'axis-right', orient: 'right', seriesIndex: [1], hideWhenEmpty: true },
          { id: 'axis-bottom', orient: 'bottom', type: 'band' }
        ],
        series: [
          { type: 'line', dataId: 'emptyLine', xField: 'x', yField: 'y' },
          { type: 'line', dataId: 'activeLine', xField: 'x', yField: 'y' }
        ]
      } as any,
      {
        renderCanvas: canvasDom,
        animation: false
      }
    );

    vchart.renderSync();

    const leftAxis = getAxis('left');
    const rightAxis = getAxis('right');
    expect(leftAxis.getVisible()).toBe(false);
    expect(rightAxis.getVisible()).toBe(true);

    await vchart.updateData('emptyLine', [
      { x: 'Mon', y: 5 },
      { x: 'Tue', y: 15 }
    ]);

    expect(leftAxis.getVisible()).toBe(true);
    expect(leftAxis.getLayoutRect().width).toBeGreaterThan(0);
  });
});
