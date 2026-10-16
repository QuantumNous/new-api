import VChart from '../../../src';
import { createDiv, removeDom } from '../../util/dom';

const createPieTextureSpec = () => {
  const data = [
    { type: 'oxygen', value: '46.60', texture: 'circle' },
    { type: 'silicon', value: '27.72', texture: 'horizontal-line' },
    { type: 'aluminum', value: '8.13', texture: 'vertical-line' },
    { type: 'iron', value: '5', texture: 'rect' },
    { type: 'calcium', value: '3.63', texture: 'grid' },
    { type: 'sodium', value: '2.83', texture: 'bias-rl' },
    { type: 'potassium', value: '2.59', texture: 'diamond' },
    { type: 'others', value: '3.5', texture: 'bias-lr' }
  ];

  return {
    type: 'pie',
    data: [
      {
        id: 'id0',
        values: data
      }
    ],
    outerRadius: 0.8,
    innerRadius: 0.5,
    padAngle: 0.6,
    valueField: 'value',
    categoryField: 'type',
    pie: {
      style: {
        cornerRadius: 10,
        texture: (datum: { texture: string }) => datum.texture
      }
    },
    legends: {
      visible: true,
      orient: 'left',
      item: {
        shape: {
          style: {
            symbolType: 'circle',
            texture: (datum: { texture: string }) => datum.texture
          }
        }
      }
    },
    animation: false
  };
};

const createPieLegendShapeTextureSpec = () => {
  const data = [
    { type: 'oxygen', value: '46.60', texture: 'circle' },
    { type: 'other', value: '53.40' }
  ];

  return {
    type: 'pie',
    data: [
      {
        id: 'id0',
        values: data
      }
    ],
    valueField: 'value',
    categoryField: 'type',
    legends: {
      visible: true,
      orient: 'top',
      select: false,
      item: {
        shape: {
          style: {
            symbolType: 'circle',
            texture: (datum: { texture: string }) => datum.texture
          }
        }
      }
    },
    animation: false
  };
};

describe('pie chart test', () => {
  let container: HTMLElement;
  let dom: HTMLElement;

  beforeEach(() => {
    container = createDiv();
    dom = createDiv(container);
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterEach(() => {
    removeDom(container);
  });

  test('should render arc builtin textures without treating them as image resources', () => {
    const chart = new VChart(createPieTextureSpec() as any, {
      dom,
      animation: false
    });

    try {
      expect(() => chart.renderSync()).not.toThrow();

      const legendModel = chart.getComponents().find(component => component.type === 'discreteLegend') as any;
      const legendComponent = legendModel?.getVRenderComponents?.()[0];
      const firstItem = legendComponent?.attribute?.items?.[0];
      const shapeStyle = legendComponent?.attribute?.item?.shape?.style;

      expect(firstItem?.datum?.texture).toBe('circle');
      expect(shapeStyle(firstItem, true, 0, legendComponent.attribute.items).texture).toBe('circle');
    } finally {
      chart.release();
    }
  });

  test('should render legend shape texture callback with default pattern size', () => {
    const chart = new VChart(createPieLegendShapeTextureSpec() as any, {
      dom,
      animation: false
    });

    try {
      expect(() => chart.renderSync()).not.toThrow();

      const legendModel = chart.getComponents().find(component => component.type === 'discreteLegend') as any;
      const legendComponent = legendModel?.getVRenderComponents?.()[0];
      const items = legendComponent.attribute.items;
      const shapeStyle = legendComponent.attribute.item.shape.style;

      expect(shapeStyle(items[0], true, 0, items)).toEqual(
        expect.objectContaining({
          texture: 'circle',
          texturePadding: 1,
          textureSize: 4
        })
      );
    } finally {
      chart.release();
    }
  });
});
