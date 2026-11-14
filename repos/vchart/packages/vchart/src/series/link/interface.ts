import type { ICartesianSeriesSpec, ICartesianSeriesTheme } from '../cartesian/interface';
import type { IMarkSpec, IMarkTheme } from '../../typings/spec/common';
import type { ILineMarkSpec, ISymbolMarkSpec } from '../../typings/visual';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { DataView } from '@visactor/vdataset';
import type { IDotSeriesSpec } from '../dot/interface';

export interface ILinkSeriesSpec extends ICartesianSeriesSpec, ILinkSeriesSpecFromDot {
  /**
   * 系列类型
   */
  type: 'link';

  /**
   * from 字段配置
   * @description 用于绘制link的起点。
   */
  fromField: string;

  /**
   * to 字段配置
   * @description 用于绘制link的终点。
   */
  toField: string;

  /**
   * 被关联的dot series index
   */
  dotSeriesIndex: number;

  // TODO: 这里的 type 是某种内部定义类型还是一位维度key呢？维度key的话应该用 xxxField 更合理

  /**
   * dot type字段配置
   * @description 用于区分link的stroke逻辑。如果没有配置，则每条link都使用相同的stroke
   */
  dotTypeField?: string;
  /**
   * 图元配置
   */
  [SeriesMarkNameEnum.link]?: IMarkSpec<ILineMarkSpec>;
}

type ILinkSeriesSpecFromDot = {
  // 以下属性不对用户开放
  // 原因: 在sequence chart层做了特殊处理，这些属性都从关联的dot series中获得，不开放给用户
  /**
   * 被关联dot series的数据
   */
  dataDot?: DataView;
  /**
   * 被关联的dot series的spec
   */
  dotSeriesSpec?: IDotSeriesSpec;
  /**
   * link 系列的左边距(和dot 系列保持一致，主要用于放置dot 系列的title和subTitle)
   */
  leftAppendPadding?: number;
  /**
   * link 系列的可视高度
   */
  clipHeight?: number;
};

export interface ILinkSeriesTheme extends ICartesianSeriesTheme {
  [SeriesMarkNameEnum.link]?: Partial<IMarkTheme<ILineMarkSpec>>;
  [SeriesMarkNameEnum.arrow]?: Partial<IMarkTheme<ISymbolMarkSpec>>;
}
