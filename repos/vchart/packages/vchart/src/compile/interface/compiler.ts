import type { IApp, IColor, IStageParams, IStage, ILayer, IOption3D, ITicker } from '@visactor/vrender-core';
import type { IPerformanceHook, RenderMode } from '../../typings/spec/common';
import type { IBoundsLike } from '@visactor/vutils';
import type { StringOrNumber } from '../../typings';

/** 布局阶段 */
export enum LayoutState {
  before = 'before',
  layouting = 'layouting',
  reevaluate = 'reevaluate',
  after = 'after'
}

export interface IRenderContainer {
  dom?: HTMLElement | 'none';
  canvas?: HTMLCanvasElement | string;
}

/**
 * @since 1.8.0
 */
export type IOptimizeType = {
  // 视口不在可视区，跳过渲染，默认为true
  skipRenderWithOutRange?: boolean;
  // 跳过图元在区间外的判断
  // 不存在dirtyBounds的时候，根据该配置判断是否关闭图元的超出边界判定
  // 如果有dirtyBounds那么该配置不生效
  disableCheckGraphicWidthOutRange?: boolean;
};

export interface GestureConfig {
  press?: {
    /**
     * @default 251
     * Minimal press time in ms.
     * @see http://hammerjs.github.io/recognizer-press/
     */
    time?: number;
    /**
     * @default 10
     * Maximal movement that is allowed while pressing.
     * @see http://hammerjs.github.io/recognizer-press/
     */
    threshold?: number;
  };
  swipe?: {
    /**
     * Minimal distance required before recognizing.
     * @default 10
     * @see https://hammerjs.github.io/recognizer-swipe/
     */
    threshold?: number;
    /**
     * Minimal velocity required before recognizing, unit is in px per ms.
     * @default 0.3
     * @see http://hammerjs.github.io/recognizer-swipe/
     */
    velocity?: number;
  };
  tap?: {
    /**
     * max time between the multi-tap taps
     * @default 300
     */
    interval?: number;
  };
}

export interface IRenderOption {
  /**
   * 配置渲染环境，默认为 'desktop-browser'，当需要在非浏览器环境渲染 VChart 时，需要配置该属性。
   * - 'desktop-browser': 默认模式，适用于 PC 及 H5
   * - 'mobile-browser': H5 模式
   * - 'node': Node 渲染
   * - 'worker': worker 模式
   * - 'miniApp': 小程序模式
   * - 'lynx': lynx 渲染
   * @default 'desktop-browser'
   */
  mode?: RenderMode;

  gestureConfig?: GestureConfig;
  /**
   * 渲染环境参数配置。
   *
   * app 级 envParams 只应放对整个 VRender app scope 都有效的环境能力；
   * 具体 canvas name/id、width、height、dpr 会随 stage 创建参数传入。
   * Lynx 新接入请优先使用 pixelRatio、lynx/runtime、canvasFactory 等全局能力，
   * 不要把 domref/canvasIdLists/freeCanvasIdx 作为新主路径依赖。
   */
  modeParams?:
    | {
        tooltipCanvasId?: StringOrNumber;
        [key: string]: any;
      }
    | unknown;

  /**
   * 是否自动刷线dpr
   * @since 1.12.14
   */
  autoRefreshDpr?: boolean;
  /**
   * 设置屏幕分辨率
   */
  dpr?: number;
  /**
   * 图表交互全局开关，默认为 `true`，开启。
   * @default true
   */
  interactive?: boolean;
  /**
   * 指定绘制的区域
   */
  viewBox?: IBoundsLike;
  /**
   * 用于告诉底层的渲染引擎 VRender，图表的 Canvas 是否是受控制的canvas，如果不是的话，不会进行resize等操作。
   * @default true
   */
  canvasControled?: boolean;
  /**
   * 外部传入的 VRender stage。普通用户仍应优先使用 dom/renderCanvas；
   * 显式传入 stage 时，stage ownership 属于外部，VChart release 不会释放该 stage。
   */
  stage?: IStage;
  /**
   * 外部传入的 VRender app。VChart 可使用它创建内部 stage，但 app ownership 属于外部，
   * VChart release 只释放自己创建的 stage，不释放该 app。
   */
  app?: IApp;
  /**
   * 外部传入的 VRender layer
   */
  layer?: ILayer;

  /**
   * 绘制之前的钩子函数
   */
  beforeRender?: IStageParams['beforeRender'];
  /**
   * 绘制之后的钩子函数
   */
  afterRender?: IStageParams['afterRender'];

  renderHooks?: {
    /**
     * 渲染层清除屏幕之后的钩子函数，这个钩子在实际渲染之前
     * @since 2.0.1
     */
    afterClearScreen?: IStageParams['afterClearScreen'];
    /**
     * 渲染层清除屏幕之后的钩子函数，这个钩子在实际渲染之前
     * @since 2.0.2
     */
    afterClearRect?: IStageParams['afterClearRect'];
    /**
     * 渲染层钩子 直接透传
     * @since 2.0.2
     */
    [key: string]: any;
  };
  /**
   * 绘图区域背景色设置
   */
  background?: IColor;
  /**
   * 日志类型，用于开发调试
   */
  logLevel?: number;
  /**
   * 错误消息回调函数
   */
  onError?: (...args: any[]) => void;
  /**
   * 是否关闭dirtyBounds
   * @default false
   */
  disableDirtyBounds?: boolean;
  /**
   * 是否开启view3d的变换模式
   */
  enableView3dTransform?: boolean;
  /**
   * vrender 的插件列表
   */
  pluginList?: string[];
  /**
   * vrender 的 ticker
   */
  ticker?: ITicker;
  /**
   * @since 1.8.0
   */
  optimize?: IOptimizeType;
  /**
   * @since 1.8.3
   */
  enableHtmlAttribute?: boolean;
  /**
   * @since 1.8.9
   * 是否支持touch事件
   */
  supportsTouchEvents?: boolean;
  /**
   * @since 1.8.9
   * 是否支持pointer事件
   */
  supportsPointerEvents?: boolean;
  /**
   * @since 1.11.0
   * 用于vrender渲染react元素，`react-dom`包导出元素
   */
  ReactDOM?: any;
  /**
   * @since 1.13.2
   * @default 200
   * 单位 ms
   * 多次点击之间的最大时间，默认为 200 ms，用于判断点击次数
   */
  clickInterval?: number;
  /**
   * @since 1.13.2
   * @default false
   * VRender 参数 是否自动阻止事件
   */
  autoPreventDefault?: boolean;
  /**
   * @deprecated
   * 请使用 hooks 代替
   */
  performanceHook?: IPerformanceHook;

  /**
   * 3d配置
   */
  options3d?: {
    enable?: boolean;
    /* 是否支持3d视角变换 */
    enableView3dTranform?: boolean;
  } & IOption3D;
}
