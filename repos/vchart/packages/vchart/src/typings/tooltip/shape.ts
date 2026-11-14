import type { ShapeType } from '../shape';
import type { TooltipContentProperty } from './common';

export interface ITooltipShapePattern {
  /** 该 pattern 属于哪个系列id（用户不需要设置） */
  seriesId?: number;
  /**
   * 是否显示形状图形
   */
  hasShape?: boolean;
  /**
   * 形状图形的类型
   */
  shapeType?: TooltipContentProperty<ShapeType | string>;
  /**
   * 形状填充颜色
   * @since 1.4.0
   */
  shapeFill?: TooltipContentProperty<string>;
  /**
   * 形状描边颜色
   * @since 1.4.0
   */
  shapeStroke?: TooltipContentProperty<string>;
  /**
   * 形状描边宽度
   * @since 1.4.0
   */
  shapeLineWidth?: TooltipContentProperty<number>;
  /**
   * 形状的大小
   */
  shapeSize?: TooltipContentProperty<number>;
  /**
   * 形状是否空心
   */
  shapeHollow?: TooltipContentProperty<boolean>;

  /**
   * 规范命名，用户 spec 中建议用 shapeFill 代替，内部默认值可以维持使用 shapeColor
   * @deprecated
   */
  shapeColor?: TooltipContentProperty<string>;
}

export interface ITooltipShapeActual {
  /**
   * 是否显示图形
   */
  hasShape?: boolean;
  /**
   * 图形的类型
   */
  shapeType?: ShapeType | string;
  /**
   * 形状填充颜色
   * @since 1.4.0
   */
  shapeFill?: string;
  /**
   * 形状描边颜色
   * @since 1.4.0
   */
  shapeStroke?: string;
  /**
   * 形状描边宽度
   * @since 1.4.0
   */
  shapeLineWidth?: number;
  /**
   * 图形的大小
   */
  shapeSize?: number;
  /**
   * 形状是否空心
   */
  shapeHollow?: boolean;
}
