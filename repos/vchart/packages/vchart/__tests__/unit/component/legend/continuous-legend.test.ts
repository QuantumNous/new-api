import { getContinuousLegendAttributes } from '../../../../src/component/legend/continuous/util';

describe('Continuous legend handlerText', () => {
  test('should transform static handlerText style', () => {
    const attrs = getContinuousLegendAttributes({
      type: 'size',
      handlerText: {
        style: {
          angle: 90,
          dx: 8
        }
      }
    } as any);

    expect(attrs.handlerText.style.dx).toBe(8);
    expect(attrs.handlerText.style.angle).toBe(Math.PI / 2);
  });

  test('should preserve callback-based handlerText style', () => {
    const attrs = getContinuousLegendAttributes({
      type: 'size',
      handlerText: {
        style: (value: number, position: 'start' | 'end') => ({
          angle: 180,
          dx: value + (position === 'start' ? 1 : 2)
        })
      }
    } as any);

    const style = attrs.handlerText.style(2, 'start', {});

    expect(typeof attrs.handlerText.style).toBe('function');
    expect(style.dx).toBe(3);
    expect(style.angle).toBe(Math.PI);
  });
});
