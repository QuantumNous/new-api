import { minInArray } from '@visactor/vutils';
import { DiffState } from '../../../mark/interface/enum';
import type { IMarkGraphic } from '../../../mark/interface/common';

/**
 * 计算角度对于起点的比例
 */
export const computeRatio = (angle: number, range: [number, number]) => {
  /**
   * 计算当前处理的角度, 与range的距离
   * 若ratio为负, 则代表需要向起点靠拢
   * 若ratio为正, 则代表需要向终点靠拢
   */
  const ratio = (angle - range[0]) / (range[1] - range[0] || 1);

  /**
   * ratio若为负值, 则取0, 代表起点.
   * ratio若为正值, 则取1, 代表终点.
   * Tips: 仅代表一个比例, 具体的值是多少, 需要在外部计算.
   */
  return Math.max(0, Math.min(1, ratio));
};

/**
 * 得到最内层的Elements
 */
export const getInnerMostElements = (graphics: IMarkGraphic[]) => {
  // 所有待更新的marks
  const updateElements = graphics.filter(g => g.context.diffState === DiffState.update);
  // 得到最内层级
  const minDepth = minInArray(updateElements.map(g => g?.context?.data?.[0].depth));
  // 内层的Marks
  return updateElements.filter(g => g?.context?.data?.[0].depth === minDepth);
};
