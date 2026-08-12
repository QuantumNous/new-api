export interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type IOrientType = 'left' | 'top' | 'right' | 'bottom' | 'z';

export type IPolarOrientType = 'radius' | 'angle';

/**
 * 内边距配置
 */
export interface IPadding {
  /**
   * 顶部边距
   */
  top?: number;
  /**
   * 底部边距
   */
  bottom?: number;
  /**
   * 左侧边距
   */
  left?: number;
  /**
   * 右侧边距
   */
  right?: number;
}

export const enum Direction {
  vertical = 'vertical',
  horizontal = 'horizontal'
}

export type DirectionType = keyof typeof Direction;
