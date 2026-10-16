import type { IAnimationSpec, IMarkSpec, IMarkTheme, IPathMarkSpec, ISeriesSpec } from '@visactor/vchart';

export interface IPictogramSeriesSpec extends ISeriesSpec, IAnimationSpec<'pictogram', 'fadeIn'> {
  /**
   *  系列类型
   */
  type: 'pictogram';
  /**
   *  svg 数据源
   */
  svg: string;
  /**
   *  名称维度
   */
  nameField?: string;
  /**
   *  值维度
   */
  valueField?: string;
  /**
   *  图元配置
   */
  pictogram?: IMarkSpec<Omit<IPathMarkSpec, 'smoothScale'>>;

  /** 默认填充颜色 */
  defaultFillColor?: string;
}

export interface IPictogramThemeSpec {
  defaultFillColor?: string;
  pictogram?: Partial<IMarkTheme<Omit<IPathMarkSpec, 'smoothScale'>>>;
}
