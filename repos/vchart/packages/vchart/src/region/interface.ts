import type { IMark, IGroupMark } from '../mark/interface';
import type { ILayoutModel, IModelConstructor, IModelOption, IModelSpecInfo } from '../model/interface';
import type { ISeries, SeriesType } from '../series/interface';
import type { CoordinateType } from '../typings/coordinate';
import type { IProjectionSpec } from '../component/geo/interface';
import type { ConvertToMarkStyleSpec, IRectMarkSpec } from '../typings/visual';
import type { StringOrNumber } from '../typings';
import type { ILayoutItemSpec } from '../layout/interface';

export interface IRegion extends ILayoutModel {
  //stack
  getStackInverse: () => boolean;
  getStackSort: () => boolean;

  getMaxWidth: () => number | undefined;
  setMaxWidth: (value: number) => void;
  getMaxHeight: () => number | undefined;
  setMaxHeight: (value: number) => void;

  // 系列
  addSeries: (series: ISeries) => void;
  removeSeries: (series: ISeries) => void;

  getSeries: (opt?: ISeriesFilter) => ISeries[];
  getSeriesInName: (name: string) => ISeries;
  getSeriesInUserId: (userId: string) => ISeries;
  getSeriesInId: (id: number) => ISeries;
  getSeriesInType: (type: SeriesType) => ISeries[];
  getSeriesInCoordinateType: (type: CoordinateType) => ISeries[];
  getSeriesInDataName: (dataName: string) => ISeries[];

  getMarks: () => IMark[];
  getGroupMark: () => IGroupMark;
  getInteractionMark: () => IGroupMark;

  getSpecInfo: () => IRegionSpecInfo;
}

export type ISeriesFilter = {
  name?: string;
  userId?: StringOrNumber | StringOrNumber[];
  specIndex?: number | number[];
  id?: number;
  type?: string;
  coordinateType?: CoordinateType;
  dataName?: string;
};

export interface IRegionConstructor extends IModelConstructor {
  new (spec: IRegionSpec, ctx: IModelOption): IRegion;
}

export interface IRegionSpec extends ILayoutItemSpec {
  id?: StringOrNumber;
  coordinate?: CoordinateType;
  style?: ConvertToMarkStyleSpec<IRectMarkSpec>;
  /**
   * 堆积时是否逆序
   * @default false
   * @since 1.4.0
   */
  stackInverse?: boolean;
  /**
   * 堆积时是否排序
   * @default false
   * @since 1.10.4
   */
  stackSort?: boolean;
}

export interface IGeoRegionSpec extends IRegionSpec {
  coordinate?: 'geo';
  /**
   * 是否可以拖拽
   * @default false
   * @since 1.12.8 支持 blank 配置，在 region 空白区域也能触发拖拽
   * @since 2.0.5 支持 zoom 、drag 配置，单独开启 zoom 或 drag 功能
   * roam为对象时，默认为 { zoom: true, drag: true, blank: false }
   */
  roam?: boolean | { zoom?: boolean; drag?: boolean; blank?: boolean };
  /**
   * 数据中的经度字段名
   */
  longitudeField?: string;
  /**
   * 数据中的纬度字段名
   */
  latitudeField?: string;
  /**
   * 地理映射配置
   */
  projection?: Partial<Omit<IProjectionSpec, 'name'>>;
  /**
   * 缩放最大最小倍数限制
   */
  zoomLimit?: {
    /**
     * 最小缩放倍数
     */
    min?: number;
    /**
     * 最大缩放倍数
     */
    max?: number;
  };
  /**
   * 缩放速率（比例因子），用于加速或减缓缩放
   * @default 1
   */
  zoomRate?: number;
}

export type RegionSpec = IRegionSpec | IGeoRegionSpec;

export interface IRegionSpecInfo<T extends RegionSpec = IRegionSpec> extends IModelSpecInfo {
  /** model 具体类型 */
  type: 'region';
  /** model spec */
  spec: T;
}
