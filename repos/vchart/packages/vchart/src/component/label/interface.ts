import type { BaseLabelAttrs, DataLabelAttrs } from '@visactor/vrender-components';
import type { ConvertToMarkStyleSpec, Datum, IComposedTextMarkSpec, IFormatMethod, ITextMarkSpec } from '../../typings';
import type { IComponentSpec } from '../base/interface';
import type { ILabelMark, IMark } from '../../mark/interface';
import type { ISeries } from '../../series/interface';
import type { IRegion } from '../../region/interface';

export interface ILabelInfo {
  baseMark: IMark;
  labelMark: ILabelMark;
  series: ISeries;
  labelSpec: TransformedLabelSpec;
}

export interface ILabelComponentContext {
  region: IRegion;
  labelInfo: ILabelInfo[];
}

export interface ILabelFormatMethodContext {
  series?: ISeries;
}

/**
 * 系列图元标签配置，一般用于展示数据项
 */
export interface ILabelSpec extends ILabelAnimationSpec {
  /**
   * 标签组件的层级
   */
  zIndex?: number;
  /** 默认不显示标签 */
  visible?: boolean;
  /**
   * 是否支持交互。
   * @default false
   */
  interactive?: boolean;
  /**
   * 文本类型：text, rich,
   * @since 1.7.0
   * @deprecated
   */
  textType?: 'text' | 'rich';
  /**
   * 格式化函数
   * @since 1.10.0 支持返回结构 `{type:'rich', text: [{text:'some text', fill:'black', fontSize: 20}]}
   */
  formatMethod?: IFormatMethod<[text: string | string[], datum?: Datum, ctx?: ILabelFormatMethodContext]>;
  /**
   * 字符串模版
   * 用{}包裹变量名的字符串模版, 变量名取自数据属性值
   * eg: 'type={type},value={value}'
   * @since 1.7.0
   */
  formatter?: string | string[];
  /** 标签与其对应数据图元的间距 */
  offset?: number;
  /** 标签位置 */
  position?: string;
  /** 标签样式配置 */
  style?: ConvertToMarkStyleSpec<IComposedTextMarkSpec>;
  /** 交互样式配置 */
  state?: LabelStateStyle<Partial<IComposedTextMarkSpec>>;
  /** 标签防重叠配置 */
  overlap?: BaseLabelAttrs['overlap'] & {
    /**
     * 防重叠区域边距
     * @since 1.13.7
     */
    padding?: DataLabelAttrs['size']['padding'];
  };
  /** 标签智能反色配置 */
  smartInvert?: BaseLabelAttrs['smartInvert'];
  /**
   * 堆积数据过滤类型
   * @since 1.12.0
   */
  stackDataFilterType?: 'min' | 'max';
  /** 自定义标签数据筛选和排序
   * @since 1.3.0
   */
  dataFilter?: BaseLabelAttrs['dataFilter'];
  /** 自定义标签布局函数。
   * @description 当配置了 customLayoutFunc 后，默认布局和防重叠逻辑将不再生效。（overlap/position/offset不生效）
   * @since 1.3.0
   */
  customLayoutFunc?: BaseLabelAttrs['customLayoutFunc'];
  /** 自定义标签躲避函数
   * @description 当配置了 customOverlapFunc 后，会根据 position 和 offset 进行初始布局。配置的防重叠逻辑(overlap)不生效。
   * @since 1.3.0
   */
  customOverlapFunc?: BaseLabelAttrs['customOverlapFunc'];
  /**
   * 防重叠计算完成后的回调函数
   * @since 1.13.5
   */
  onAfterOverlapping?: BaseLabelAttrs['onAfterOverlapping'];
  /**
   * 标签布局
   */
  labelLayout?: 'series' | 'region';
  /**
   * 是否支持3D
   */
  support3d?: boolean;
  /**
   * 是否同步数据图元的状态变化
   * @default false
   * @since 1.9.0
   */
  syncState?: boolean;
  /**
   * 是否显示标签关联图元的 mark tooltip
   * @default false
   * @since 1.13.5
   */
  showRelatedMarkTooltip?: boolean;
}

export type ILabelAnimationSpec = Pick<
  BaseLabelAttrs,
  'animation' | 'animationEnter' | 'animationUpdate' | 'animationExit'
>;
export type IMultiLabelSpec<T extends Omit<ILabelSpec, 'position'>> = T | T[];

type LabelStateStyle<T> = {
  /**
   * 标签hover状态样式配置
   */
  hover?: T;
  /**
   * 标签hover_reverse状态样式配置
   */
  hover_reverse?: T;
  /**
   * 标签选中状态样式配置
   */
  selected?: T;
  /**
   * 标签未选中状态样式配置
   */
  selected_reverse?: T;
};

export type ITotalLabelSpec = Pick<
  ILabelSpec,
  'visible' | 'formatMethod' | 'interactive' | 'offset' | 'style' | 'state' | 'textType' | 'overlap'
> & {
  /** 堆叠汇总标签的位置，在一组堆积图元的上方或下方
   * @default 'top'
   */
  position?: 'top' | 'bottom';
  /**
   * 不管总计标签是否展示，内部都默认计算总计值
   * @default false
   */
  alwayCalculateTotal?: boolean;
};

export interface ITotalLabelTheme
  extends Pick<ILabelSpec, 'visible' | 'interactive' | 'offset' | 'overlap' | 'smartInvert' | 'animation'> {
  style?: ITextMarkSpec;
}

// 内部处理转换后的标签配置
export type TransformedLabelSpec = ILabelSpec & {
  getStyleHandler: (series: ISeries) => (mark?: ILabelMark, spec?: any) => void;
};
