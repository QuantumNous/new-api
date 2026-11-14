import type { IAxisCommonTheme } from '../axis/interface';
import type { IBrushTheme } from '../brush/interface';
import type { ICrosshairTheme } from '../crosshair/interface';
import type { IDataZoomTheme } from '../data-zoom/data-zoom/interface';
import type { IScrollBarTheme } from '../data-zoom/scroll-bar/interface';
import type { IIndicatorTheme } from '../indicator/interface';
import type { IDiscreteLegendTheme } from '../legend/discrete/interface';
import type { IColorLegendTheme, ISizeLegendTheme } from '../legend/continuous/interface';
import type { IMarkAreaTheme } from '../marker/mark-area/interface';
import type { IMarkLineTheme } from '../marker/mark-line/interface';
import type { IMarkPointTheme } from '../marker/mark-point/interface';
import type { IPlayerTheme } from '../player/interface';
import type { ITitleTheme } from '../title/interface';
import type { ITooltipSpec, ITooltipTheme } from '../tooltip/interface';
import type { ComponentTypeEnum } from './type';
import type { ITotalLabelTheme } from '../label/interface';
import type { IPoptipTheme } from '../poptip/interface';
import type { IColorKey } from '../../theme/color-scheme/interface';
import type { Direction, IOrientType } from '../../typings';
import type { ICartesianAxisCommonTheme } from '../axis/cartesian/interface/theme';
import type { IPolarAxisCommonTheme } from '../axis/polar/interface/theme';

export interface IComponentTheme {
  /**
   * 通用坐标轴配置
   */
  axis?: IAxisCommonTheme;
  /**
   * 离散轴的通用配置
   */
  axisBand?: IAxisCommonTheme;
  /**
   * 连续轴的通用配置
   */
  axisLinear?: IAxisCommonTheme;
  /**
   * 笛卡尔坐标系下 x 轴的配置
   */
  axisX?: ICartesianAxisCommonTheme;
  /**
   * 笛卡尔坐标系下 y 轴配置
   */
  axisY?: ICartesianAxisCommonTheme;
  /**
   * 极坐标系下半径轴配置
   */
  axisRadius?: IPolarAxisCommonTheme;
  /**
   * 极坐标系下角度轴配置
   */
  axisAngle?: IPolarAxisCommonTheme;
  /**
   * 离散图例配置
   */
  [ComponentTypeEnum.discreteLegend]?: IDiscreteLegendTheme;
  /**
   * 连续颜色图例配置
   */
  [ComponentTypeEnum.colorLegend]?: IColorLegendTheme;
  /**
   * 连续尺寸图例配置
   */
  [ComponentTypeEnum.sizeLegend]?: ISizeLegendTheme;
  /**
   * markLine 标记配置
   */
  [ComponentTypeEnum.markLine]?: IMarkLineTheme;
  [ComponentTypeEnum.polarMarkLine]?: IMarkLineTheme;
  /**
   * markArea 标记配置
   */
  [ComponentTypeEnum.markArea]?: IMarkAreaTheme;
  [ComponentTypeEnum.polarMarkArea]?: IMarkAreaTheme;
  /**
   * markPoint 标记配置
   */
  [ComponentTypeEnum.markPoint]?: IMarkPointTheme;
  [ComponentTypeEnum.polarMarkPoint]?: IMarkPointTheme;
  [ComponentTypeEnum.geoMarkPoint]?: IMarkPointTheme;
  /**
   * tooltip 组件配置
   */
  [ComponentTypeEnum.tooltip]?: ITooltipTheme<string | IColorKey> &
    Partial<
      Pick<
        ITooltipSpec,
        | 'visible'
        | 'activeType'
        | 'mark'
        | 'dimension'
        | 'group'
        | 'trigger'
        | 'triggerOff'
        | 'showDelay'
        | 'hideTimer'
        | 'lockAfterClick'
        | 'renderMode'
        | 'confine'
        | 'className'
        | 'parentElement'
        | 'enterable'
        | 'throttleInterval'
      >
    >;
  /**
   * crosshair 配置
   */
  [ComponentTypeEnum.crosshair]?: ICrosshairTheme;
  /**
   * dataZoom 配置
   */
  [ComponentTypeEnum.dataZoom]?: IDataZoomTheme;
  /**
   * scrollbar 滚动条配置
   */
  [ComponentTypeEnum.scrollBar]?: IScrollBarTheme;
  /**
   * 指标卡组件配置
   */
  [ComponentTypeEnum.indicator]?: IIndicatorTheme;
  /**
   * 播放器配置
   */
  [ComponentTypeEnum.player]?: IPlayerTheme;
  /**
   * 框选配置
   */
  [ComponentTypeEnum.brush]?: IBrushTheme;
  /**
   * 图表标题配置
   */
  [ComponentTypeEnum.title]?: ITitleTheme;
  /**
   * 省略文本配置
   */
  [ComponentTypeEnum.poptip]?: IPoptipTheme;
  /**
   * 堆叠总计标签配置
   * @since 1.3.0
   */
  [ComponentTypeEnum.totalLabel]?: ITotalLabelTheme;
  [key: string]: any;
}

/** 区分方向的组件主题类型 */
export type ComponentThemeWithDirection<
  T extends {
    orient?: IOrientType;
  }
> = T /* 通用主题，留作兼容 */ & {
  orient?: IOrientType;
  /** 横向主题 */
  [Direction.horizontal]?: Omit<T, 'orient'>;
  /** 纵向主题 */
  [Direction.vertical]?: Omit<T, 'orient'>;
};
