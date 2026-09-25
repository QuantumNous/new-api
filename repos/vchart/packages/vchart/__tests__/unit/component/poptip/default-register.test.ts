import type { IGraphic } from '@visactor/vrender-core';
import { default as VChartConstructor } from '../../../../src';
import { createCanvas, removeDom } from '../../../util/dom';

type TraversableGraphic = {
  type?: string;
  name?: string;
  attribute?: Record<string, unknown>;
  forEachChildren?: (cb: (child: TraversableGraphic) => void | boolean) => void;
  cliped?: boolean;
};
type PoptipTextGraphic = IGraphic & { cliped?: boolean; _showPoptip?: number };
type PoptipForTextPlugin = { poptip: (event: { target: PoptipTextGraphic }) => void };

const walkGraphics = (root: TraversableGraphic, visitor: (graphic: TraversableGraphic) => void) => {
  visitor(root);
  root.forEachChildren?.((child: TraversableGraphic) => {
    walkGraphics(child, visitor);
  });
};

describe('poptip default register', () => {
  let canvasDom: HTMLCanvasElement;
  let vchart: InstanceType<typeof VChartConstructor> | undefined;

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

  test('should install poptipForText for clipped text in full entry', () => {
    const titleText =
      '发圣诞节付款时间饭卡手机打饭卡发圣诞节付款时间饭卡手机打饭卡发圣诞节付款时间饭卡手机打饭卡发圣诞节付款时间饭卡手机打饭卡发圣诞节付款时间饭卡手机打饭卡发圣诞节付款时间饭卡手机打饭卡发圣诞节付款时间饭卡手机打饭卡';

    vchart = new VChartConstructor(
      {
        type: 'area',
        data: {
          values: [
            { type: 'Nail polish', country: 'Africa', value: 4229 },
            { type: 'Nail polish', country: 'EU', value: 4376 },
            { type: 'Nail polish', country: 'China', value: 3054 },
            { type: 'Nail polish', country: 'USA', value: 12814 },
            { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
            { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
            { type: 'Eyebrow pencil', country: 'China', value: 5067 },
            { type: 'Eyebrow pencil', country: 'USA', value: 13012 }
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
              text: titleText
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
    vchart.renderSync();

    const stage = vchart.getStage();
    const poptipForTextPlugins = stage.pluginService.findPluginsByName('poptipForText');
    expect(poptipForTextPlugins.length).toBe(1);

    let clippedTitleText: PoptipTextGraphic | undefined;
    walkGraphics(stage as TraversableGraphic, graphic => {
      if (graphic.type === 'text' && String(graphic.attribute?.text).includes('发圣诞节付款时间')) {
        clippedTitleText = graphic as unknown as PoptipTextGraphic;
      }
    });

    expect(clippedTitleText).toBeDefined();
    expect(clippedTitleText.cliped).toBe(true);

    const bounds = clippedTitleText.globalAABBBounds;
    const picked = stage.pick((bounds.x1 + bounds.x2) / 2, (bounds.y1 + bounds.y2) / 2);
    expect(picked && picked.graphic).toBe(clippedTitleText);

    (poptipForTextPlugins[0] as unknown as PoptipForTextPlugin).poptip({ target: clippedTitleText });
    expect(clippedTitleText._showPoptip).toBe(1);
  });
});
