import type { IMarkSpec, IMarkTheme } from '../../typings/spec/common';
import type { ILiquidMarkSpec, IGroupMarkSpec, ILiquidOutlineSpec } from '../../typings/visual';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { IAnimationSpec } from '../../animation/spec';
import type { SymbolType } from '@visactor/vrender-core';
import type { ISymbolMark } from '../../mark/interface';

export interface ILiquidAnimationParams {
  height: {
    from: () => number | number;
    to: () => number | number;
  };
  dy: {
    from: () => number | number;
    to: () => number | number;
  };
}

export type LiquidAppearPreset = 'wave' | 'grow' | 'waveGrow';

type LiquidMarks = 'liquid';

export type LiquidShapeType = SymbolType | 'drop';

export type ILiquidPadding = {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
};

/** 布局 padding的配置 */
export type ILiquidPaddingSpec = ILiquidPadding | number | number[];

export interface ILiquidSeriesSpec extends IAnimationSpec<LiquidMarks, LiquidAppearPreset> {
  /** 系列类型 */
  type: 'liquid';
  /**
   * value字段
   */
  valueField?: string;
  /**
   * 轮廓形状
   * @default 'circle'
   */
  maskShape?: LiquidShapeType;
  /**
   * 外轮廓与region边界之间的padding
   */
  outlineMargin?: ILiquidPaddingSpec;
  /**
   * 内轮廓与外轮廓之间的padding
   */
  outlinePadding?: ILiquidPaddingSpec;
  /**
   * 是否开启指标智能反色
   * @default false
   */
  indicatorSmartInvert?: boolean;
  /**
   * 是否反向绘制
   * @default false
   * @since 1.11.10
   */
  reverse?: boolean;
  /**
   * 水波图元配置
   */
  [SeriesMarkNameEnum.liquid]?: IMarkSpec<ILiquidMarkSpec>;
  /**
   * 水波背景图元配置
   */
  [SeriesMarkNameEnum.liquidBackground]?: IMarkSpec<IGroupMarkSpec>;
  /**
   * 水波外轮廓配置
   */
  [SeriesMarkNameEnum.liquidOutline]?: IMarkSpec<ISymbolMark>;
}

export interface ILiquidSeriesTheme {
  outlineMargin?: ILiquidPaddingSpec;
  outlinePadding?: ILiquidPaddingSpec;
  [SeriesMarkNameEnum.liquid]?: Partial<IMarkTheme<ILiquidMarkSpec>>;
  [SeriesMarkNameEnum.liquidBackground]?: IMarkSpec<IGroupMarkSpec>;
  [SeriesMarkNameEnum.liquidOutline]?: IMarkSpec<ILiquidOutlineSpec>;
}
