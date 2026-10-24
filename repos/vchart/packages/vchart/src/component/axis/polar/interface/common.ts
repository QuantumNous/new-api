import type { IBaseScale } from '@visactor/vscale';
import type { IPoint, IPolarOrientType, IPolarPoint } from '../../../../typings';
import type { IAxis, IGrid } from '../../interface';
import type { ICompilableData } from '../../../../compile/data/interface';

export type IPolarGrid = IGrid & {
  /**
   * smooth 为 true 时，为圆形 grid，为 false 则为多边形 grid
   * @default false
   */
  smooth?: boolean;
};
export interface IPolarAxisHelper {
  // axis is continuous
  isContinuous: boolean;

  dataToPosition: (values: any, cfg?: any) => number;
  coordToPoint: (point: IPolarPoint) => IPoint;
  pointToCoord: (point: IPoint) => IPolarPoint;
  center: () => IPoint;
  layoutRadius: () => number;

  getScale: (depth?: number) => IBaseScale;
  getBandwidth?: (depth?: number) => number; // band轴特有
  getAxisId: () => number;
  // 用户其他模块扩充轴scale的区间
  setExtendDomain?: (key: string, value: number | undefined) => void;
}

export interface IPolarAxis extends IAxis {
  startAngle: number;
  endAngle: number;

  // 为了与直角坐标系轴对齐，这里也通过 orient 来区别 angle/radius 轴
  getOrient: () => IPolarOrientType;
  getScale: () => IBaseScale;
  // tickValues: () => number[];
  getCenter: () => IPoint;
  getOuterRadius: () => number;
  getInnerRadius: () => number;
  dataToPosition: (values: any[]) => number;
  positionToData: (position: IPoint) => any;
  getTickData: () => ICompilableData;
  // 将半径和角度转换为笛卡尔坐标点
  coordToPoint: (point: IPolarPoint) => IPoint;
  pointToCoord: (point: IPoint) => IPolarPoint;
}
