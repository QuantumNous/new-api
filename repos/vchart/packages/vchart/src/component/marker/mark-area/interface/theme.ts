import type { IMarkAreaLabelPosition, IMarkCommonArcLabelPosition } from '@visactor/vrender-components';
import type { IArcMarkSpec, IPolygonMarkSpec } from '../../../../typings';
import type { IMarkerLabelWithoutRefSpec, IMarkerState } from '../../interface';

export type IMarkAreaLabel = {
  /**
   * label整体 - 相对line的位置
   */
  position?: keyof typeof IMarkAreaLabelPosition | IMarkCommonArcLabelPosition;
} & IMarkerLabelWithoutRefSpec;

export interface IMarkAreaTheme {
  /**
   * 标记区域的样式
   */
  area?: Partial<IMarkerState<IPolygonMarkSpec | IArcMarkSpec>>;
  /**
   * 标记区域的标签样式配置。
   * 自 1.13.9 版本开始，支持创建多个标签
   */
  label?: IMarkAreaLabel | IMarkAreaLabel[];
}
