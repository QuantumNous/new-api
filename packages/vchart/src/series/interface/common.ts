import type { DataView } from '@visactor/vdataset';
import type { IGrammarItem } from '../../compile/interface';
import type {
  IBaseModelSpecTransformerResult,
  IModelConstructor,
  IModelMarkInfo,
  IModelOption,
  IModelSpecInfo
} from '../../model/interface';
import type { IRegion } from '../../region/interface';
import type { RenderMode } from '../../typings/spec/common';
import type { ISeries } from './series';
import type { IGroupMark, IMarkOption } from '../../mark/interface';
import type { Datum, ISeriesSpec, StringOrNumber } from '../../typings';
import type { TransformedLabelSpec } from '../../component/label/interface';
import type { SeriesMarkNameEnum, SeriesTypeEnum } from './type';

// export type SeriesStyle = 'color' | 'size' | 'shape';

export interface ISeriesSeriesInfo {
  key: string;
  /** 直接取 datum 里的原始值 */
  originalKey: any;
  datum?: Datum;
  index?: number;
  // 样式的值类型可能是 StringOrNumber | number[] | xxxx
  style: (attribute: string) => any;
  /** series 对应的缩略图类型 */
  shapeType: string;
}

export interface ISeriesOption extends IModelOption {
  mode: RenderMode;
  region: IRegion;
  sourceDataList: DataView[];
  getSeriesData: (id: StringOrNumber | undefined, index: number | undefined) => DataView | undefined;
}

export interface ISeriesConstructor extends IModelConstructor {
  readonly type: string;
  mark?: SeriesMarkMap;
  new (spec: any, options: ISeriesOption): ISeries;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ISeriesInitOption {}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ISeriesUpdateDataOption {}

export interface ISeriesStackDataNode {
  groupField?: string;
  nodes: {
    [key: string]: ISeriesStackDataMeta;
  };
}
export interface ISeriesStackDataLeaf {
  groupField?: string;
  values: any[];
  total?: number;
}

export type ISeriesStackDataMeta = ISeriesStackDataNode | ISeriesStackDataLeaf;
export type ISeriesStackData = ISeriesStackDataNode;

/**
 * 设置图表中系列分组的样式，这里的分组对应了相同的分组字段值
 */
export type ISeriesStyle = ISeriesStyleItem[];

/**
 * 特定系列分组的样式配置
 */
export type ISeriesStyleItem = {
  /**
   * 系列的分组名称
   */
  name: string;
} & {
  /**
   * 设置该系列分组下各种图元对应的样式
   */
  [markName: string]: {
    /**
     * 图元的样式
     */
    style?: any;
  };
};

export interface ISeriesMarkInitOption extends Partial<IMarkOption> {
  /** theme spec */
  themeSpec?: any;

  /** mark spec */
  markSpec?: any;

  /** 是否在编译时更新实际数据 */
  skipBeforeLayouted?: boolean;

  /** 是否是 series field 所作用的 mark（用于 tooltip shape 取色等） */
  isSeriesMark?: boolean;

  /** 数据 key 值 */
  key?: string | ((datum: any) => string);

  /** 分组 key 值 */
  groupKey?: string;

  /** 绑定系列数据（如果是 undefined 则默认是系列的 data，如果是 false 则不配置数据） */
  dataView?: DataView | false;
  /** 系列数据编译产物的名称 */
  dataProductId?: string;
  /** mark scale 如果需要使用统计信息设置domain的话，使用的series对应的统计数据 */
  seriesId?: number;

  /**
   * 状态排序方法，默认状态都是按照添加的顺序处理的，如果有特殊的需求，需要指定状态顺序，可以通过这个方法实现
   * @since 1.9.0
   */
  stateSort?: (stateA: string, stateB: string) => number;
  /**
   * use component in extension mark
   * @since 1.9.0
   */
  componentType?: string;
}

export interface ISeriesMarkInfo extends IModelMarkInfo {
  /** mark 名称 */
  name: SeriesMarkNameEnum | string;
}

export type SeriesMarkMap = Partial<Record<SeriesMarkNameEnum, ISeriesMarkInfo>>;

export interface ISeriesSpecInfo<T extends ISeriesSpec = ISeriesSpec>
  extends IModelSpecInfo,
    ISeriesSpecTransformerResult<T, any> {
  /** model 具体类型 */
  type: string | SeriesTypeEnum;
  /** model spec */
  spec: T;
  /** model theme */
  theme: any;
}

export interface ISeriesSpecTransformerResult<T, K> extends IBaseModelSpecTransformerResult<T, K> {
  /** 当前的 mark 标签 spec */
  markLabelSpec?: Partial<Record<SeriesMarkNameEnum, TransformedLabelSpec[]>>;
  /** 是否堆叠 */
  stack?: boolean;
}
