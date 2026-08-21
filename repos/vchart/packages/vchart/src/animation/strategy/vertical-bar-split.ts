import type { IMarkGraphic } from '../../mark/interface';
import type { BaseMark } from '../../mark';
import type { IAnimationSplitStrategy } from '../interface';

/**
 * 垂直柱状图拆分策略
 * 针对垂直柱状图，先更新x和width，再更新y和height
 */
export class VerticalBarSplitStrategy implements IAnimationSplitStrategy {
  name = 'verticalBarSplit';

  shouldApply(mark: BaseMark<any>, graphic: IMarkGraphic): boolean {
    // 检查是否是柱状图且方向是垂直的
    const isRectMark = mark.type === 'rect';
    const isVertical = (mark.model as any)?.direction === 'vertical';

    // 检查是否同时存在维度和值的变化
    const diffAttrs = graphic.context?.diffAttrs || {};
    const hasDimensionChanges = 'x' in diffAttrs || 'width' in diffAttrs || 'x1' in diffAttrs;
    const hasValueChanges = 'y' in diffAttrs || 'height' in diffAttrs || 'y1' in diffAttrs;

    return isRectMark && isVertical && hasDimensionChanges && hasValueChanges;
  }

  split(mark: BaseMark<any>, graphic: IMarkGraphic): Array<{ attrs: Record<string, any>; order: number }> {
    const diffAttrs = graphic.context?.diffAttrs || {};
    const dimensionAttrs: Record<string, any> = {};
    const valueAttrs: Record<string, any> = {};

    // 分配属性到对应的组
    Object.entries(diffAttrs).forEach(([key, value]) => {
      if (key === 'x' || key === 'width' || key === 'x1') {
        dimensionAttrs[key] = value;
      } else if (key === 'y' || key === 'height' || key === 'y1') {
        valueAttrs[key] = value;
      } else {
        // 其他属性（如颜色、透明度等）与维度一起更新
        dimensionAttrs[key] = value;
      }
    });

    // 检查是从堆积变为分组还是从分组变为堆积
    // 如果fieldX长度增加，说明是从堆积变为分组，先执行x/width
    // 如果fieldX长度减少，说明是从分组变为堆积，先执行y/height
    const context = graphic.context as any;
    const fieldX = context.fieldX;
    const originalFieldX = context.originalFieldX;

    // 检查fieldX是否是数组（表示多维度）
    const isGrouped = Array.isArray(fieldX) && fieldX.length > 1;
    const wasStacked = originalFieldX ? !(Array.isArray(originalFieldX) && originalFieldX.length > 1) : !isGrouped;

    const stack2group = wasStacked && isGrouped;
    // 默认情况：先执行x/width，再执行y/height
    return [
      { attrs: dimensionAttrs, order: stack2group ? 1 : 2 }, // 先更新维度（x和width）
      { attrs: valueAttrs, order: stack2group ? 2 : 1 } // 再更新值（y和height）
    ];
  }
}
