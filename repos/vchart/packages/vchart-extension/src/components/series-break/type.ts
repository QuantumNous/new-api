import type { IGroupGraphicAttribute, ILineGraphicAttribute, Point } from '@visactor/vchart';

export type SeriesBreakData = {
  /**
   * 起始点
   */
  start: Point;
  /**
   * 结束点
   */
  end: Point;
  /**
   * 锯齿的大小
   * @default 4
   */
  size?: number;
  /**
   * 两条平行的锯齿的间距
   * @default 5
   */
  gap?: number;
  /**
   * 截断样式
   */
  style?: ILineGraphicAttribute;
  /**
   * 轴截断关联的坐标轴 id
   */
  axisId: string;
  /**
   * 当前轴截断的数据范围
   */
  data: [number, number];
};

export interface SeriesBreakAttrs extends IGroupGraphicAttribute {
  data: SeriesBreakData[];
}
