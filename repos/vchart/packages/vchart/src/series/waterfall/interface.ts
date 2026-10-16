import type { Datum, IMarkSpec, IMarkTheme, IRuleMarkSpec, ITextMarkSpec } from '../../typings';
import type { IAnimationSpec } from '../../animation/spec';
import type { BarAppearPreset, IBarSeriesSpec, IBarSeriesTheme } from '../bar/interface';
import type { ILabelSpec, ITotalLabelSpec } from '../../component/label/interface';
import type { SeriesMarkNameEnum } from '../interface/type';

export type WaterfallAppearPreset = BarAppearPreset;

type WaterfallMarks = 'bar';

export interface IWaterfallTotalText {
  /** 总计文本 */
  text?: string;
}

export interface IWaterfallTotalEnd extends IWaterfallTotalText {
  /** 此类型下，默认在数据最后增加一条总计信息 */
  type: 'end';
}
export interface IWaterfallTotalCustom extends IWaterfallTotalText {
  /** 此类型下，总计的运算方式由自定义函数决定 */
  type: 'custom';
  /** 总计值的标志位，对应 field 的值为 true 时，认为数据是总计数据 */
  tagField: string;
  /** 总计数据在运算时会调用这个函数，参数为当前总计数据，当前累计信息，需要返回总计的起点值与终点值 */
  product: (datum: Datum, current: { start: number; end: number }) => { start: number; end: number };
}

export interface IWaterfallTotalField extends IWaterfallTotalText {
  /** 此类型下，总计的运算方式由对应的数据字段决定 */
  type: 'field';
  /** 总计值的标志位，对应 field 的值为 true 时，认为数据是总计数据 */
  tagField: string;
  /** 可以指定总计值 */
  valueField?: string;
  /** 可以指定总计起点 */
  startField?: string;
  /** 可以指定总计计算前 n 个维度 */
  collectCountField?: string;
}

export type IWaterfallStackLabelPosition = 'withChange' | 'middle' | 'max' | 'min';
export type IWaterfallStackLabelValueType = 'change' | 'absolute';

export interface IWaterfallSeriesSpec
  extends Omit<IBarSeriesSpec, 'type' | 'label'>,
    IAnimationSpec<WaterfallMarks, WaterfallAppearPreset> {
  /**
   *  系列类型
   */
  type: 'waterfall';
  /**
   * 总计配置
   */
  total?: IWaterfallTotalEnd | IWaterfallTotalField | IWaterfallTotalCustom;
  /**
   * 引导线配置
   */
  [SeriesMarkNameEnum.leaderLine]?: IMarkSpec<IRuleMarkSpec>;
  /**
   * 堆积值标签配置
   */
  [SeriesMarkNameEnum.stackLabel]?: ILabelSpec & {
    /** 标签位置 */
    position?: IWaterfallStackLabelPosition;
    /** 标签偏移量 */
    offset?: number;
    /** 标签值 */
    valueType?: IWaterfallStackLabelValueType;
  };

  totalLabel?: ITotalLabelSpec & {
    /** 标签位置 */
    position?: IWaterfallStackLabelPosition;
    /** 标签偏移量 */
    offset?: number;
    /** 标签值 */
    valueType?: IWaterfallStackLabelValueType;
  };

  /**
   * 标签配置
   */
  [SeriesMarkNameEnum.label]?: ILabelSpec & {
    /** 是否可见 */
    visible: boolean;
    /** 标签位置(支持两端显示 bothEnds) */
    // position?: PositionEnum;
    /** 标签偏移量 */
    offset?: number;
  };

  /**
   * 瀑布图类型
   * 默认为 increase 增长瀑布图
   * @since 2.0.6
   */
  calculationMode?: 'increase' | 'decrease';
}

export interface IWaterfallSeriesTheme extends IBarSeriesTheme {
  seriesFieldName: {
    total: string;
    increase: string;
    decrease: string;
  };
  [SeriesMarkNameEnum.leaderLine]?: Partial<IMarkTheme<IRuleMarkSpec>>;
  [SeriesMarkNameEnum.stackLabel]?: Partial<
    IMarkTheme<ITextMarkSpec> & { offset?: number; position?: IWaterfallStackLabelPosition }
  >;
}
