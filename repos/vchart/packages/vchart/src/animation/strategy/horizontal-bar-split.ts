import type { IMarkGraphic } from '../../mark/interface';
import type { BaseMark } from '../../mark';
import type { IAnimationSplitStrategy } from '../interface';

/**
 * 水平柱状图拆分策略
 * 针对水平柱状图，先更新y和height，再更新x和width
 */
export class HorizontalBarSplitStrategy implements IAnimationSplitStrategy {
  name = 'horizontalBarSplit';

  shouldApply(mark: BaseMark<any>, graphic: IMarkGraphic): boolean {
    // 检查是否是柱状图且方向是水平的
    const isRectMark = mark.type === 'rect';
    const isHorizontal = (mark.model as any)?.direction === 'horizontal';

    // 检查是否同时存在维度和值的变化
    const diffAttrs = graphic.context?.diffAttrs || {};
    const hasDimensionChanges = 'y' in diffAttrs || 'height' in diffAttrs || 'y1' in diffAttrs;
    const hasValueChanges = 'x' in diffAttrs || 'width' in diffAttrs || 'x1' in diffAttrs;

    return isRectMark && isHorizontal && hasDimensionChanges && hasValueChanges;
  }

  split(mark: BaseMark<any>, graphic: IMarkGraphic): Array<{ attrs: Record<string, any>; order: number }> {
    const diffAttrs = graphic.context?.diffAttrs || {};
    const dimensionAttrs: Record<string, any> = {};
    const valueAttrs: Record<string, any> = {};

    // 分配属性到对应的组
    Object.entries(diffAttrs).forEach(([key, value]) => {
      if (key === 'y' || key === 'height' || key === 'y1') {
        dimensionAttrs[key] = value;
      } else if (key === 'x' || key === 'width' || key === 'x1') {
        valueAttrs[key] = value;
      } else {
        // 其他属性（如颜色、透明度等）与维度一起更新
        dimensionAttrs[key] = value;
      }
    });

    // 检查是从堆积变为分组还是从分组变为堆积
    // 如果fieldY长度增加，说明是从堆积变为分组，先执行y/height
    // 如果fieldY长度减少，说明是从分组变为堆积，先执行x/width
    const context = graphic.context as any;
    const fieldY = context.fieldY;
    const originalFieldY = context.originalFieldY;

    // 检查fieldY是否是数组（表示多维度）
    const isGrouped = Array.isArray(fieldY) && fieldY.length > 1;
    const wasStacked = originalFieldY ? !(Array.isArray(originalFieldY) && originalFieldY.length > 1) : !isGrouped;
    const group2stack = !wasStacked && !isGrouped;

    return [
      { attrs: dimensionAttrs, order: group2stack ? 2 : 1 }, // 先更新维度（y和height）
      { attrs: valueAttrs, order: group2stack ? 1 : 2 } // 再更新值（x和width）
    ];
  }
}
