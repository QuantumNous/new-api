import { getLegendAttributes } from '../../../../src/component/legend/discrete/util';

describe('Discrete legend getLegendAttributes maxRow/maxCol', () => {
  const rect = { width: 200, height: 80 };

  test('should evaluate function `maxRow` against the layout rect', () => {
    const attrs = getLegendAttributes(
      {
        type: 'discrete',
        orient: 'bottom',
        id: 'l1',
        maxRow: (ctx: any) => Math.floor(ctx.rect.height / 20)
      } as any,
      rect as any
    );

    expect(attrs.maxRow).toBe(4);
  });

  test('should evaluate function `maxCol` and pass rect / orient / id in the context', () => {
    let received: any;
    const attrs = getLegendAttributes(
      {
        type: 'discrete',
        orient: 'right',
        id: 'l2',
        maxCol: (ctx: any) => {
          received = ctx;
          return 3;
        }
      } as any,
      rect as any
    );

    expect(attrs.maxCol).toBe(3);
    expect(received.rect).toBe(rect);
    expect(received.orient).toBe('right');
    expect(received.id).toBe('l2');
  });

  test('should keep numeric `maxRow` / `maxCol` unchanged', () => {
    const attrs = getLegendAttributes({ type: 'discrete', maxRow: 2, maxCol: 1 } as any, rect as any);

    expect(attrs.maxRow).toBe(2);
    expect(attrs.maxCol).toBe(1);
  });

  test('should pass the resolved `left` orient to the callback when `spec.orient` is unset', () => {
    let received: any;
    getLegendAttributes(
      {
        type: 'discrete',
        maxCol: (ctx: any) => {
          received = ctx;
          return 1;
        }
      } as any,
      rect as any
    );

    expect(received.orient).toBe('left');
  });

  test('should prefer the layout-resolved orient over `spec.orient`', () => {
    let received: any;
    getLegendAttributes(
      {
        type: 'discrete',
        orient: 'left',
        maxRow: (ctx: any) => {
          received = ctx;
          return 1;
        }
      } as any,
      rect as any,
      'bottom'
    );

    expect(received.orient).toBe('bottom');
  });
});
