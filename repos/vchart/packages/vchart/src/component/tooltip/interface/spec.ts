import type { EventSourceType, EventType } from '../../../event/interface';
import type {
  IGroupTooltipPattern,
  ITooltipActual,
  ITooltipPattern,
  Maybe,
  MaybeArray,
  TooltipActiveType,
  TooltipData
} from '../../../typings';
import type { ITooltipActiveTypeAsKeys, TooltipHandlerParams, TooltipResult } from './common';
import type { ITooltipTheme } from './theme';

export interface ITooltipSpec
  extends Partial<
    /**
     * mark tooltip pattern
     * & dimension tooltip pattern
     * （*支持在series上设置）
     */
    ITooltipActiveTypeAsKeys<
      ITooltipPattern & {
        /**
         * mark tooltip是否展示触发点所在的所有图形的数据
         */
        checkOverlap?: boolean;
      },
      ITooltipPattern,
      IGroupTooltipPattern
    >
  > {
  /**
   * 是否显示
   * （*支持在series上设置）
   * （*会影响自定义handler）
   */
  visible?: boolean;
  /**
   * 受支持的激活类型
   * （*支持在series上设置）
   * （*会影响自定义handler）
   */
  activeType?: TooltipActiveType | TooltipActiveType[];
  /**
   * tooltip触发方式
   * （*会影响自定义handler）
   * @since 1.12.10 支持自定义的事件触发
   */
  trigger?:
    | MaybeArray<'hover' | 'click' | { eventType: EventType; source?: EventSourceType; consume?: boolean }>
    | 'none';
  /**
   * 隐藏tooltip的触发方式（目前仅支持和trigger一致的设置以及none）
   * （*会影响自定义handler）
   * @since 1.12.10 支持自定义的事件触发
   */
  triggerOff?:
    | MaybeArray<
        | 'hover'
        | 'click'
        | { eventType: EventType; source?: EventSourceType; consume?: boolean; checkOutside?: boolean }
      >
    | 'none';
  /**
   * 当设置了`enterable: true`，且 trigger类型为`hover`的时候，为了方便鼠标进入提示信息的内容区域，设置的显示延迟时长
   * 其他情况设置无效
   * @since 1.12.8
   */
  showDelay?: number;

  /**
   * 隐藏计时器
   * @since 1.11.7
   */
  hideTimer?: number;
  /**
   * 点击后锁定，只有点击才可以更新位置或者解锁，通常用于 trigger 为 `['hover', 'click']` 的场景
   * （*会影响自定义handler）
   * @since 1.10.0
   */
  lockAfterClick?: boolean;
  /**
   * tooltip样式，是现在支持的三种类型的tooltip组件（包括dimension、mark、group）的公共样式
   */
  style?: Omit<ITooltipTheme<string>, 'offset' | 'transitionDuration'>;

  /**
   * 自定义handler方法
   */
  handler?: Partial<ITooltipHandlerSpec>;

  /**
   * tooltip 渲染方式，默认为 html
   */
  renderMode?: 'html' | 'canvas';
  /**
   * 是否将 tooltip 框限制在画布区域内，renderMode 为 canvas 时，默认开启。
   */
  confine?: boolean;

  /**
   * tooltip dom元素的 className，仅当 renderMode: 'html' 时生效
   */
  className?: string;
  /**
   * tooltip dom 元素的挂载点，可传 id 或 dom 对象
   */
  parentElement?: Maybe<string | HTMLElement | HTMLCanvasElement>;
  /**
   * 鼠标是否可进入提示框浮层中，默认为false，如需详情内交互，如添加链接，按钮，可设置为 true。
   * 该属性目前只对 renderMode 为 html 时生效
   * TODO: 支持 renderMode: canvas
   */
  enterable?: boolean;

  /**
   * 浮层移动动画过渡时间，单位是 ms，设置为 0 的时候会紧跟着鼠标移动（目前仅影响 dom tooltip）
   */
  transitionDuration?: number;

  /**
   * 更新 tooltip 的防抖动时间间隔，单位是 ms
   */
  throttleInterval?: number;

  /**
   * 更新 tooltip dom 元素，仅当 renderMode: 'html' 时生效
   * @since 1.6.0
   */
  updateElement?: (tooltipElement: HTMLElement, actualTooltip: ITooltipActual, params: TooltipHandlerParams) => void;
  /**
   * 计算tooltip位置时候的偏移量
   */
  offset?: {
    /**
     * x 方向的偏移量
     */
    x?: number;
    /**
     * y 方向的偏移量
     */
    y?: number;
  };
}

type ISeriesToolipPattern = Pick<
  ITooltipPattern,
  | 'visible'
  | 'title'
  | 'content'
  | 'hasShape'
  | 'shapeColor'
  | 'shapeFill'
  | 'shapeHollow'
  | 'shapeLineWidth'
  | 'shapeSize'
  | 'shapeStroke'
  | 'shapeType'
  | 'updateContent'
  | 'updateTitle'
  | 'updatePosition'
>;

/**
 * 系列上的tooltip配置，优先级高于全局tooltip配置
 * 对于visible相当配置，系列tooltip只能关闭，不能覆盖全局tooltip配置
 */
export interface ISeriesTooltipSpec extends Pick<ITooltipSpec, 'visible' | 'activeType' | 'handler'> {
  /**
   * 该系列数据在dimension tooltip中特有的配置
   */
  dimension?: ISeriesToolipPattern;
  /**
   * 该系列数据在mark tooltip中特有的配置
   */
  mark?: ISeriesToolipPattern;
  /**
   * 该系列数据在group tooltip中特有的配置
   */
  group?: Pick<IGroupTooltipPattern, 'triggerMark'> & ISeriesToolipPattern;
}

export interface ITooltipHandlerSpec {
  /** 显示 tooltip，可以选择返回是否遇到异常 */
  showTooltip: (
    activeType: TooltipActiveType,
    tooltipData: TooltipData,
    params: TooltipHandlerParams
  ) => Maybe<TooltipResult>;
  /** 隐藏 tooltip，可以选择返回是否遇到异常 */
  hideTooltip: (params: TooltipHandlerParams) => Maybe<TooltipResult>;
  /** 释放 tooltip */
  release: () => void;
  /** 可选，判断 tooltip 是否正在显示 */
  isTooltipShown?: () => boolean;
}
