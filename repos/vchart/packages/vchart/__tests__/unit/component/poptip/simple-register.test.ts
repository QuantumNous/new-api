import { default as VChartConstructor } from '../../../../src/vchart-simple';
import { default as FullVChartConstructor } from '../../../../src';
import { createCanvas, removeDom } from '../../../util/dom';

describe('poptip simple register', () => {
  let canvasDom: HTMLCanvasElement;
  let fullEntryCanvasDom: HTMLCanvasElement | undefined;
  let vchart: InstanceType<typeof VChartConstructor> | undefined;
  let fullEntryVChart: InstanceType<typeof FullVChartConstructor> | undefined;

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
    if (fullEntryCanvasDom) {
      removeDom(fullEntryCanvasDom);
    }
    fullEntryVChart?.release();
    fullEntryCanvasDom = undefined;
    fullEntryVChart = undefined;
  });

  const createSimpleChart = () =>
    new VChartConstructor(
      {
        type: 'area',
        data: {
          values: [
            { type: 'Nail polish', country: 'Africa', value: 4229 },
            { type: 'Nail polish', country: 'EU', value: 4376 },
            { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
            { type: 'Eyebrow pencil', country: 'EU', value: 3987 }
          ]
        },
        xField: 'type',
        yField: 'value',
        seriesField: 'country',
        legends: [{ visible: false, position: 'middle', orient: 'bottom' }],
        axes: [
          {
            type: 'band',
            orient: 'bottom',
            title: {
              visible: true,
              text: '发圣诞节付款时间饭卡手机打饭卡发圣诞节付款时间饭卡手机打饭卡发圣诞节付款时间饭卡手机打饭卡'
            }
          },
          { type: 'linear', orient: 'left', title: { visible: true } }
        ]
      } as ConstructorParameters<typeof VChartConstructor>[0],
      {
        renderCanvas: canvasDom,
        animation: false
      }
    );

  const createFullEntryChart = () => {
    fullEntryCanvasDom = createCanvas();
    fullEntryCanvasDom.style.position = 'relative';
    fullEntryCanvasDom.style.width = '500px';
    fullEntryCanvasDom.style.height = '500px';
    fullEntryCanvasDom.width = 500;
    fullEntryCanvasDom.height = 500;

    return new FullVChartConstructor(
      {
        type: 'bar',
        data: { values: [{ x: 'A', y: 1 }] },
        xField: 'x',
        yField: 'y',
        animation: false
      },
      {
        renderCanvas: fullEntryCanvasDom,
        animation: false
      }
    );
  };

  test('should not install poptipForText by default in simple entry', () => {
    vchart = createSimpleChart();
    vchart.renderSync();

    expect(vchart.getStage().pluginService.findPluginsByName('poptipForText').length).toBe(0);
  });

  test('should not install poptipForText in simple entry after a full entry chart stays active', () => {
    fullEntryVChart = createFullEntryChart();
    fullEntryVChart.renderSync();

    vchart = createSimpleChart();
    vchart.renderSync();

    expect(vchart.getStage().pluginService.findPluginsByName('poptipForText').length).toBe(0);
  });
});
