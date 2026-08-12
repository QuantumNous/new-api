export type TooltipPositionCallback<T> = (event: MouseEvent) => T;

export type TooltipPositionValue = number | TooltipPositionCallback<number>;

export interface ITooltipPositionFixedValue {
  /** 固定方位 */
  orient: TooltipFixedPosition;
  /** 固定模式 */
  mode: TooltipPositionMode;
  /** 偏移量（像素值） */
  offset?: number;
}

export type TooltipPositionPatternItem = TooltipPositionValue | ITooltipPositionFixedValue;

/** tooltip显示在鼠标所在图形的固定位置，只对 mark tooltip 有效 */
export type TooltipFixedPosition =
  /** tooltip 显示在上侧 */
  | 'top'
  /** tooltip 显示在下侧 */
  | 'bottom'
  /** tooltip 显示在左侧 */
  | 'left'
  /** tooltip 显示在右侧 */
  | 'right'
  /**
   * tooltip 显示在左上角
   * @since 1.4.0
   */
  | 'tl'
  /**
   * tooltip 显示在左上角（容错）
   * @since 1.4.0
   */
  | 'lt'
  /**
   * tooltip 显示在右上角
   * @since 1.4.0
   */
  | 'tr'
  /**
   * tooltip 显示在右上角（容错）
   * @since 1.4.0
   */
  | 'rt'
  /**
   * tooltip 显示在左下角
   * @since 1.4.0
   */
  | 'bl'
  /**
   * tooltip 显示在左下角（容错）
   * @since 1.4.0
   */
  | 'lb'
  /**
   * tooltip 显示在右下角
   * @since 1.4.0
   */
  | 'br'
  /**
   * tooltip 显示在右下角（容错）
   * @since 1.4.0
   */
  | 'rb'
  /**
   * tooltip 显示在鼠标所在图形中心位置
   * @since 1.10.0
   */
  | 'center'
  /**
   * tooltip 显示在鼠标所在图形中心位置的上侧
   * @since 1.10.0
   */
  | 'centerTop'
  /**
   * tooltip 显示在鼠标所在图形中心位置的下侧
   * @since 1.10.0
   */
  | 'centerBottom'
  /**
   * tooltip 显示在鼠标所在图形中心位置的左侧
   * @since 1.10.0
   */
  | 'centerLeft'
  /**
   * tooltip 显示在鼠标所在图形中心位置的右侧
   * @since 1.10.0
   */
  | 'centerRight'
  /** tooltip 显示在鼠标所在图形中心位置（旧版兼容，建议用 `'center'`） */
  | 'inside'
  /**
   * tooltip 显示在鼠标所在图形的内侧顶部
   * @since 1.13.10
   */
  | 'insideTop'
  /**
   * tooltip 显示在鼠标所在图形的内侧底部
   * @since 1.13.10
   */
  | 'insideBottom'
  /**
   * tooltip 显示在鼠标所在图形的内侧左侧
   * @since 1.13.10
   */
  | 'insideLeft'
  /**
   * tooltip 显示在鼠标所在图形的内侧右侧
   * @since 1.13.10
   */
  | 'insideRight'
  /**
   * tooltip 显示在鼠标所在图形的内侧左上角
   * @since 1.13.10
   */
  | 'insideTopLeft'
  /**
   * tooltip 显示在鼠标所在图形的内侧右上角
   * @since 1.13.10
   */
  | 'insideTopRight'
  /**
   * tooltip 显示在鼠标所在图形的内侧左下角
   * @since 1.13.10
   */
  | 'insideBottomLeft'
  /**
   * tooltip 显示在鼠标所在图形的内侧右下角
   * @since 1.13.10
   */
  | 'insideBottomRight';

export type TooltipPositionMode =
  /** tooltip 固定在鼠标指针附近 */
  | 'pointer'
  /** tooltip 固定在图元附近 */
  | 'mark'
  /** tooltip 固定在 crosshair 附近 */
  | 'crosshair';

/** 相对于全局布局的 tooltip position，只支持像素值或者像素值的回调 */
export interface IGlobalTooltipPositionPattern {
  left?: TooltipPositionValue;
  right?: TooltipPositionValue;
  top?: TooltipPositionValue;
  bottom?: TooltipPositionValue;
}

/** 相对于某个图表元素的 tooltip position，支持像素值或者固定方位（x、y 可分别配置） */
export interface IFixedTooltipPositionPattern {
  x: TooltipPositionPatternItem;
  y: TooltipPositionPatternItem;
}

export type TooltipPosition = IGlobalTooltipPositionPattern | IFixedTooltipPositionPattern | TooltipFixedPosition;

export interface ITooltipPositionActual {
  x: number;
  y: number;
}

export type TooltipPositionKeys = 'top' | 'left' | 'right' | 'bottom';
