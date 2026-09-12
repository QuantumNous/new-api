import type { IGraphic } from '@visactor/vchart';
import type { IPadding, IOrientType, StringOrNumber } from '@visactor/vchart';
import type { IPathMarkSpec, IRectMarkSpec, ISymbolMarkSpec, ITextMarkSpec } from '@visactor/vchart';

export type LabelPosition = IOrientType | 'outer';

export interface IMapLabelSpec extends IMapLabelStyleSpec {
  /** 关联的系列 id */
  seriesId: StringOrNumber;
  /** 名称文本的数据字段 */
  nameField?: string;
  /** 数值文本的数据字段 */
  valueField?: string;
  /**
   * 交互触发类型
   * @default 'none'
   */
  trigger?: 'hover' | 'click' | 'none';
}

export type IMapLabelNodes = 'nameLabel' | 'valueLabel' | 'icon' | 'labelBackground' | 'container';

export type MapLabelSceneNodeMap = Partial<Record<IMapLabelNodes, IGraphic>>;

export interface IMapLabelStyleSpec {
  /**
   * 是否显示
   * @default false
   */
  visible?: boolean;
  /**
   * 标签非 outer 位置下与标记点的间距
   * @default 12
   */
  offset?: number;
  /**
   * icon 和 label之间的距离
   * @default 10
   */
  space?: number;
  /**
   * 标签位置。支持 'left' | 'top' | 'right' | 'bottom' | 'outer'
   * @default 'top'
   */
  position?: LabelPosition;
  /** 名称文本样式设置 */
  nameLabel?: {
    visible?: boolean;
    style?: ITextMarkSpec;
  };
  /** 数值文本样式设置 */
  valueLabel?: {
    visible?: boolean;
    style?: ITextMarkSpec;
  };
  /** 图标样式设置 */
  icon?: {
    visible?: boolean;
    style?: ISymbolMarkSpec;
  };
  /** 背景样式设置 */
  background?: {
    /** @default true */
    visible?: boolean;
    /** 背景框边距 */
    padding?: IPadding;
    style?: IRectMarkSpec;
  };
  /** 引导线样式设置 */
  leader?: {
    visible?: boolean;
    style?: IPathMarkSpec;
  };
}
