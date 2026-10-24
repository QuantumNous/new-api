import type { ControllerLayout, OrientType, BaseGraphicAttributes } from '@visactor/vrender-components';
import type { ISymbolMarkSpec, IRectMarkSpec } from '../../../typings';
import type { ILayoutItemSpec } from '../../../layout/interface';

export interface IPlayerTheme extends ILayoutItemSpec {
  /**
   * 组件显隐配置
   * @default true
   */
  visible?: boolean;

  /**
   * x方向偏移
   * @default 0
   */
  dx?: number;
  /**
   * y方向偏移
   * @default 0
   */
  dy?: number;

  /**
   * 组件宽度
   */
  width?: number;

  /**
   * 组件高度
   */
  height?: number;

  /**
   * 对齐方式
   */
  position?: 'start' | 'middle' | 'end';

  /**
   * 组件位置
   * @default bottom
   */
  orient?: OrientType;

  /**
   * 滑动条
   */
  slider?: IPlayerSlider;

  /**
   * 控制器
   */
  controller?: IPlayerController;
}

/**
 * 播放器对齐方式
 */
export type PlayerAlignType = 'start' | 'middle' | 'end';

/**
 * 播放器滑动条
 */
export interface IPlayerSlider {
  /**
   * 显隐控制
   * @default true
   */
  visible?: boolean;

  /**
   * 与前一个元素的间隔
   */
  space?: number;

  /**
   * x方向的偏移
   * @default 0
   */
  dx?: number;

  /**
   * y方向的偏移
   * @default 0
   */
  dy?: number;

  /**
   * 滑动轨道样式
   */
  railStyle?: IRectMarkSpec;

  /**
   * 滑动轨迹样式
   */
  trackStyle?: IRectMarkSpec;

  /**
   * 滑动手柄样式
   */
  handlerStyle?: ISymbolMarkSpec;
}

/**
 * 控制器
 */
export interface IPlayerController {
  /**
   * 显隐控制
   * @default true
   */
  visible?: boolean;

  /**
   * 开始按钮
   */
  start?: Partial<ControllerLayout & BaseGraphicAttributes<ISymbolMarkSpec>>;

  /**
   * 暂停按钮
   */
  pause?: Partial<ControllerLayout & BaseGraphicAttributes<ISymbolMarkSpec>>;

  /**
   * 后退按钮
   */
  backward?: Partial<ControllerLayout & BaseGraphicAttributes<ISymbolMarkSpec>>;

  /**
   * 前进按钮
   */
  forward?: Partial<ControllerLayout & BaseGraphicAttributes<ISymbolMarkSpec>>;
}
