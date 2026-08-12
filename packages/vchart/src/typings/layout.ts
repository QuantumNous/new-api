/**
 * 布局特定方向的大小配置，支持四种格式：
 * * 数值类型
 * * 以%结束的百分比字符串
 * * 返回类型为数值的函数
 * * 格式为{percent: number, offset: number}的对象
 */
export type ILayoutNumber = number | IPercent | ((layoutRect: ILayoutRect) => number) | IPercentOffset;

export interface ILayoutPoint {
  x: number;
  y: number;
}

export interface ILayoutRect {
  width: number;
  height: number;
}

export type IPercent = `${number}%`;

export type IPercentOffset = {
  /**
   * 百分比值，取值范围为0-1
   */
  percent?: number;
  /**
   * 偏移量，偏移的像素值
   */
  offset?: number;
};

export type ILayoutPercent = IPercent | number;

/**
 * 相对布局和绝对布局
 * 在相对布局结束后进行二次的绝对布局
 * 绝对布局会只根据 chart 进行相对处理
 */

export type ILayoutType =
  | 'region-relative' // 独立占位，不重合
  | 'region-relative-overlap' // 允许重合放置
  | 'region'
  | 'normal'
  | 'absolute'
  | 'normal-inline';

/**
 * 布局各个方向的padding配置
 */
export type ILayoutOrientPadding = {
  /**
   * 左侧边距配置
   */
  left?: ILayoutNumber;
  /**
   * 右侧边距配置
   */
  right?: ILayoutNumber;
  /**
   * 顶部边距配置
   */
  top?: ILayoutNumber;
  /**
   * 底部边距配置
   */
  bottom?: ILayoutNumber;
};

/** 布局 padding的配置 */
export type ILayoutPaddingSpec = ILayoutOrientPadding | ILayoutNumber | ILayoutNumber[];

export type ILayoutAlignSelf = 'start' | 'end' | 'middle';
