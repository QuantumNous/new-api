import type { Functional } from '@visactor/vrender-components';
import type { ILabelSpec, IMultiLabelSpec } from '../../component/label/interface';
import type { IBarSeriesSpec, IBarSeriesTheme } from '../bar/interface';
import type { SeriesMarkNameEnum } from '../interface/type';

export interface IMosaicSeriesSpec extends Omit<IBarSeriesSpec, 'type' | 'label'> {
  /** 系列类型 */
  type: 'mosaic';
  [SeriesMarkNameEnum.label]?: IMultiLabelSpec<
    Omit<ILabelSpec, 'position'> & {
      /**
       * 是否根据分组字段过滤标签
       */
      filterByGroup?: {
        field: string;
        type?: 'min' | 'max';
        filter?: (d: any) => boolean;
      };

      /**
       * 标签位置
       * @since 1.6.0
       * 支持'top-right' | 'top-left'| 'bottom-right' | 'bottom-left'，以及函数形式配置
       * */
      position?: Functional<
        | 'outside'
        | 'top'
        | 'bottom'
        | 'left'
        | 'right'
        | 'inside'
        | 'inside-top'
        | 'inside-bottom'
        | 'inside-right'
        | 'inside-left'
        | 'top-right'
        | 'top-left'
        | 'bottom-right'
        | 'bottom-left'
      >;
    }
  >;
  /**
   * 柱子尺寸映射字段，如果不声明默认会根据相同维度下的总值占比进行映射
   * - 条形图方向时自动映射高度
   * - 竖形图方向时自动映射宽度
   * @since 1.13.10
   */
  bandWidthField?: string;
}

export type IMosaicSeriesTheme = IBarSeriesTheme;
