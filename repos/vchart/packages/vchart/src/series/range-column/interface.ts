import type { IBarSeriesSpec } from '../bar/interface';
import type { ICartesianSeriesTheme } from '../cartesian/interface';
import type { IFormatMethod, IMarkSpec, IMarkTheme } from '../../typings/spec/common';
import type { IPositionedTextMarkSpec, IRectMarkSpec, ITextMarkSpec } from '../../typings/visual';
import type { IAnimationSpec } from '../../animation/spec';
import type { ILabelSpec } from '../../component/label/interface';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { DirectionType } from '../../typings/space';

export interface IRangeColumnAnimationParams {
  direction: DirectionType;
}

export type RangeColumnAppearPreset = 'fadeIn' | 'grow';

export const enum PositionEnum {
  middle = 'middle',
  start = 'start',
  end = 'end',
  bothEnd = 'bothEnd'
}

export const enum minMaxPositionEnum {
  middle = 'middle',
  start = 'start',
  end = 'end'
}

type RangeColumnMarks = 'rangeColumn';

export interface IRangeColumnSeriesSpec
  extends Omit<IBarSeriesSpec, 'type' | 'label' | keyof IAnimationSpec<RangeColumnMarks, RangeColumnAppearPreset>>,
    IAnimationSpec<RangeColumnMarks, RangeColumnAppearPreset> {
  /** 系列类型 */
  type: 'rangeColumn';

  /**
   * 数据字段配置
   */
  /* 区间最小值字段 */
  minField: string;
  /* 区间最大值字段 */
  maxField: string;

  /**
   * 图元配置
   */
  [SeriesMarkNameEnum.bar]?: IMarkSpec<IRectMarkSpec>;

  /**
   * 标签配置
   */
  [SeriesMarkNameEnum.label]?: Partial<ILabelSpec> & {
    /** 标签位置(支持两端显示 bothEnds) */
    position?: PositionEnum;
    [SeriesMarkNameEnum.minLabel]?: IMarkSpec<IPositionedTextMarkSpec> & {
      /** 是否可见 */
      visible?: boolean;
      /** 标签位置 */
      position?: keyof typeof minMaxPositionEnum;
      /** 标签偏移量 */
      offset?: number;
      /**
       * 文本格式化函数
       * @param text 文本内容
       * @param datum 文本对应的数据记录
       * @returns 格式化后的文本
       */
      formatMethod?: IFormatMethod<[text: string | string[], datum?: any]>;
    };
    /** 最大值标签 */
    [SeriesMarkNameEnum.maxLabel]?: IMarkSpec<IPositionedTextMarkSpec> & {
      /** 是否可见 */
      visible?: boolean;
      /** 标签位置 */
      position?: minMaxPositionEnum;
      /** 标签偏移量 */
      offset?: number;
      /**
       * 文本格式化函数
       * @param text 文本内容
       * @param datum 文本对应的数据记录
       * @returns 格式化后的文本
       */
      formatMethod?: IFormatMethod<[text: string | string[], datum?: any]>;
    };
  };
}

export interface IRangeColumnSeriesTheme extends ICartesianSeriesTheme {
  [SeriesMarkNameEnum.bar]?: Partial<IMarkTheme<IRectMarkSpec>>;
  [SeriesMarkNameEnum.label]?: Partial<ILabelSpec> & {
    [SeriesMarkNameEnum.minLabel]?: Partial<IMarkTheme<ITextMarkSpec> & { position?: keyof typeof minMaxPositionEnum }>;
    [SeriesMarkNameEnum.maxLabel]?: Partial<IMarkTheme<ITextMarkSpec> & { position?: keyof typeof minMaxPositionEnum }>;
  };
}
