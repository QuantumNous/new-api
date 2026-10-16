import type { IMarkRaw } from '@visactor/vchart/esm/mark/interface/common';
import type { IPoint } from '@visactor/vchart/esm/typings/coordinate';
import type { IArcMarkSpec, IPolygonMarkSpec, IRectMarkSpec } from '@visactor/vchart/esm/typings/visual';

// 3d rect，支持length表示长宽高中的长属性（深度属性）
export interface IRect3dMarkSpec extends IRectMarkSpec {
  /**
   * 3d柱子的深度
   */
  length?: number;
}

// 3d arc，有高度配置
export interface IArc3dMarkSpec extends IArcMarkSpec {
  /**
   * 3d圆弧的高度
   */
  height?: number;
}

export interface IPyramid3dMarkSpec extends IPolygonMarkSpec {
  /**
   * 3d金字塔顶点坐标，注意只能有4个顶点
   */
  points?: IPoint[];
}

export type IArc3dMark = IMarkRaw<IArc3dMarkSpec>;

export type IPyramid3dMark = IMarkRaw<IPyramid3dMarkSpec>;

export type IRect3dMark = IMarkRaw<IRect3dMarkSpec>;
