import type {
  ICartesianCrosshairSpec,
  ICommonCrosshairSpec,
  ICrosshairCategoryFieldSpec,
  ICrosshairValueFieldSpec,
  IPolarCrosshairSpec
} from './spec';

export interface ICrosshairTheme extends ICommonCrosshairSpec {
  /**
   * band 轴 crosshair 的公共配置
   * @since 1.3.0
   */
  bandField?: Partial<ICrosshairCategoryFieldSpec>;
  /**
   * linear 轴 crosshair 的公共配置
   * @since 1.3.0
   */
  linearField?: Partial<ICrosshairValueFieldSpec>;
  xField?: Partial<ICartesianCrosshairSpec['xField']>;
  yField?: Partial<ICartesianCrosshairSpec['yField']>;
  categoryField?: Partial<IPolarCrosshairSpec['categoryField']>;
  valueField?: Partial<IPolarCrosshairSpec['valueField']>;
  /**
   * crosshair trigger配置
   */
  trigger?: ICommonCrosshairSpec['trigger'];
  triggerOff?: ICommonCrosshairSpec['triggerOff'];
}
