import { mergeSpec } from '@visactor/vutils-extension';
import { TooltipSpecTransformer } from '../../../src/component/tooltip/tooltip-transformer';
import { ComponentTypeEnum } from '../../../src/component/interface/type';
import { tooltip as builtInTooltipTheme } from '../../../src/theme/builtin/common/component/tooltip';

describe('tooltip theme transformer', () => {
  const createTransformer = (tooltipTheme: Record<string, any>) =>
    new TooltipSpecTransformer({
      type: ComponentTypeEnum.tooltip,
      mode: 'node',
      getTheme: (...keys: string[]) => {
        if (keys[0] === 'component' && keys[1] === ComponentTypeEnum.tooltip) {
          return mergeSpec({}, builtInTooltipTheme, tooltipTheme);
        }
        return undefined;
      }
    });

  it('supports tooltip theme fields declared under component.tooltip.style', () => {
    const transformer = createTransformer({
      style: {
        panel: {
          backgroundColor: '#123456'
        },
        titleLabel: {
          fill: '#abcdef',
          fontSize: 18
        },
        keyLabel: {
          fill: '#ff0000'
        }
      }
    });

    const { spec } = transformer.transformSpec({}, {});

    expect(spec.style.panel.backgroundColor).toBe('#123456');
    expect(spec.style.titleLabel.fill).toBe('#abcdef');
    expect(spec.style.titleLabel.fontSize).toBe(18);
    expect(spec.style.keyLabel.fill).toBe('#ff0000');
    expect(spec.style.style).toBeUndefined();
  });

  it('keeps root tooltip theme fields at root instead of leaking them into style', () => {
    const transformer = createTransformer({
      offset: {
        x: 24,
        y: 16
      },
      trigger: 'click',
      transitionDuration: 0,
      panel: {
        backgroundColor: '#654321'
      }
    });

    const { spec } = transformer.transformSpec({}, {});

    expect(spec.offset).toEqual({ x: 24, y: 16 });
    expect(spec.trigger).toBe('click');
    expect(spec.transitionDuration).toBe(0);
    expect(spec.style.panel.backgroundColor).toBe('#654321');
    expect(spec.style.offset).toBeUndefined();
    expect(spec.style.trigger).toBeUndefined();
    expect(spec.style.transitionDuration).toBeUndefined();
  });

  it('supports active-type visibility declared in tooltip theme', () => {
    const transformer = createTransformer({
      mark: {
        visible: false
      },
      dimension: {
        visible: true
      }
    });

    const { spec } = transformer.transformSpec({}, {});

    expect(spec.mark.visible).toBe(false);
    expect(spec.dimension.visible).toBe(true);
    expect(spec.activeType).not.toContain('mark');
    expect(spec.activeType).toContain('dimension');
  });
});
