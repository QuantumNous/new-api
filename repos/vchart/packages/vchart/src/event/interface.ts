import type { IGraphic } from '@visactor/vrender-core';
import type { IChart } from '../chart/interface';
import type { IModel } from '../model/interface';
import type { IMark, IMarkGraphic, MarkType } from '../mark/interface';
import type { DimensionEventParams } from './events/dimension/interface';
import type { Datum, IPoint, RenderMode, StringOrNumber } from '../typings';
import type { ChartEvent, Event_Bubble_Level, Event_Source_Type, HOOK_EVENT } from '../constant/event';
import type { SeriesType } from '../series/interface';
import type { TooltipEventParams } from '../component/tooltip/interface/event';
import type { ILayoutItem } from '../layout/interface';
import type { IVChart } from '../core/interface';

export type EventType =
  | 'pointerdown'
  | 'pointerup'
  | 'pointerupoutside'
  | 'pointertap'
  | 'pointerover'
  | 'pointermove'
  | 'pointerenter'
  | 'pointerleave'
  | 'pointerout'
  | 'mousedown'
  | 'mouseup'
  | 'mouseupoutside'
  | 'rightdown'
  | 'rightup'
  | 'rightupoutside'
  | 'click'
  | 'dblclick'
  | 'mousemove'
  | 'mouseover'
  | 'mouseout'
  | 'mouseenter'
  | 'mouseleave'
  | 'wheel'
  | 'touchstart'
  | 'touchend'
  | 'touchendoutside'
  | 'touchmove'
  | 'touchcancel'
  | 'tap'
  | 'dragstart'
  | 'drag'
  | 'dragenter'
  | 'dragleave'
  | 'dragover'
  | 'dragend'
  | 'drop'
  | 'pan'
  | 'panstart'
  | 'panend'
  | 'press'
  | 'pressup'
  | 'pressend'
  | 'pinch'
  | 'pinchstart'
  | 'pinchend'
  | 'swipe'
  | keyof typeof ChartEvent
  | keyof typeof HOOK_EVENT
  | string;

export type EventBubbleLevel = keyof typeof Event_Bubble_Level;

export type ComponentType =
  | 'axis'
  | 'dataZoom'
  | 'indicator'
  | 'legend'
  | 'markLine'
  | 'markArea'
  | 'markPoint'
  | 'tooltip'
  | 'title'
  | 'label'
  | 'totalLabel'
  | 'customMark';
export type EventTargetType = MarkType | ComponentType | SeriesType;

export type EventSourceType = keyof typeof Event_Source_Type;

/**
 * 事件 API 中的事件筛选配置
 */
export type EventQuery = {
  /**
   * 事件的冒泡层级配置，其中 model 指的是图表的内部模型，包括 region、series 以及 component
   */
  level?: EventBubbleLevel;
  /**
   * 事件来源配置。
   * - `window`: window 事件
   * - `chart`: 图表事件
   */
  source?: EventSourceType;

  /**
   * vrender 图形节点名称
   */
  nodeName?: string;
  /**
   * mark 图元名称
   */
  markName?: string;
  /**
   * 仅在 level 为 'mark' 或者 'model' 的场景下使用，用于筛选 mark 类型或者图表组成元素模型类型
   */
  type?: EventTargetType;
  /**
   * 用户在 spec 上配置的 id
   */
  id?: StringOrNumber;
  /**
   * 自定义过滤函数
   * @param params
   * @returns
   */
  filter?: (params: Partial<BaseEventParams>) => boolean;

  throttle?: number;
  debounce?: number;
  /**
   * 是否阻止冒泡
   */
  consume?: boolean;
};

export type EventParams = {
  /**
   * 事件对象
   */
  event?: SuperEvent;
  /**
   * 供不同的事件用于存储期望携带的数据
   */
  value?: any;
  /**
   * 事件来源的 mark
   */
  mark?: IMark;
  /**
   * 事件来源的 model
   */
  model?: IModel;
  /**
   * 事件来源的 chart
   */
  chart?: IChart;
  /**
   * 事件拾取到的图元的数据
   */
  datum?: Datum;
  /**
   * 拾取到的图形节点
   */
  node?: IGraphic;
  /**
   * @since 1.10.4
   * 生命周期相关事件，包括：
   *  - 'rendered'
   *  - 'initialized'
   *  - 'animationFinished'
   *  - 'renderFinished'
   *  - 'layoutStart'
   *  - 'layoutEnd'
   * 会返回vchart实例
   */
  vchart?: IVChart;
};

type SuperEvent = Event & {
  [key: string]: any;
};

export type BaseEventParams = EventParams & {
  /**
   * 事件对象
   */
  event: SuperEvent;
  item: IMarkGraphic;
  datum: Datum;
  source: EventSourceType;
};

export type EventCallback<Params extends EventParams> = (params: Params) => boolean | void;

/**
 * 内部事件分发中所应用的事件筛选配置
 */
export type EventFilter = {
  source: EventSourceType;
  level: EventBubbleLevel;
  type: string | null;
  markName: string | null;
  nodeName: string | null;
  userId: StringOrNumber | null;
  filter: (params: Partial<BaseEventParams>) => boolean | null;
};

export type EventHandler<Params extends EventParams> = {
  callback: EventCallback<Params>;
  query: EventQuery | null;
  // 如果有 debounce/throttle 配置则需要封装原始回调函数
  wrappedCallback?: EventCallback<Params>;
  // 转换后的事件筛选配置
  filter?: EventFilter;
  // handler 是否被禁止触发
  prevented?: boolean;
};

export type ExtendEventParam = EventParams & {
  event?: Event;
  item?: IMarkGraphic;
  datum?: Datum;
  source?: EventSourceType;
};

export type LayoutEventParam = {
  elements: (ILayoutItem & { type: string })[];
} & Partial<BaseEventParams>;

export type PanEventParam = ExtendEventParam & {
  // x/y方向上的偏移值
  delta: [number, number];
};

export type ZoomEventParam = ExtendEventParam & {
  // 缩放值
  scale: number;
  // 缩放中心
  scaleCenter: IPoint;
};

export type InteractionEventParam = {
  graphics?: IMarkGraphic[];
  datums?: Datum[];
} & Partial<BaseEventParams>;

export type EventParamsDefinition = {
  // 基础事件回调参数
  pointerdown: BaseEventParams;
  pointerup: BaseEventParams;
  pointerupoutside: BaseEventParams;
  pointertap: BaseEventParams;
  pointerover: BaseEventParams;
  pointermove: BaseEventParams;
  pointerenter: BaseEventParams;
  pointerleave: BaseEventParams;
  pointerout: BaseEventParams;
  mousedown: BaseEventParams;
  mouseup: BaseEventParams;
  mouseupoutside: BaseEventParams;
  rightdown: BaseEventParams;
  rightup: BaseEventParams;
  rightupoutside: BaseEventParams;
  click: BaseEventParams;
  dblclick: BaseEventParams;
  mousemove: BaseEventParams;
  mouseover: BaseEventParams;
  mouseout: BaseEventParams;
  mouseenter: BaseEventParams;
  mouseleave: BaseEventParams;
  wheel: BaseEventParams;
  touchstart: BaseEventParams;
  touchend: BaseEventParams;
  touchendoutside: BaseEventParams;
  touchmove: BaseEventParams;
  touchcancel: BaseEventParams;

  dragstart: BaseEventParams;
  drag: BaseEventParams;
  dragenter: BaseEventParams;
  dragleave: BaseEventParams;
  dragover: BaseEventParams;
  dragend: BaseEventParams;
  drop: BaseEventParams;

  tap: BaseEventParams;
  pan: BaseEventParams;
  panstart: BaseEventParams;
  panend: BaseEventParams;
  press: BaseEventParams;
  pressup: BaseEventParams;
  pressend: BaseEventParams;
  pinch: BaseEventParams;
  pinchstart: BaseEventParams;
  pinchend: BaseEventParams;
  swipe: BaseEventParams;

  // VChart 内置的扩展组合事件
  dimensionHover: DimensionEventParams;
  dimensionClick: DimensionEventParams;
  tooltipShow: TooltipEventParams;
  tooltipHide: TooltipEventParams;
  tooltipRelease: TooltipEventParams;
  afterLayout: LayoutEventParam;

  // 交互相关事件
  'element-select:start': InteractionEventParam;
  'element-select:reset': InteractionEventParam;
  'element-highlight:start': InteractionEventParam;
  'element-highlight:reset': InteractionEventParam;

  // 扩展事件参数
  [key: string]: ExtendEventParam;
};

export interface IEventDispatcher {
  globalInstance: IVChart;
  register: <Evt extends EventType>(eType: Evt, handler: EventHandler<EventParamsDefinition[Evt]>) => this;
  unregister: <Evt extends EventType>(eType: Evt, handler?: EventHandler<EventParamsDefinition[Evt]>) => this;
  dispatch: <Evt extends EventType>(eType: Evt, params?: EventParamsDefinition[Evt], level?: EventBubbleLevel) => this;
  clear: () => void;
  release: () => void;
  prevent: <Evt extends EventType>(
    eType: Evt,
    except?: {
      handler: EventCallback<EventParamsDefinition[Evt]>;
      level: EventBubbleLevel;
    }
  ) => void;
  allow: <Evt extends EventType>(eType: Evt) => void;
}

export interface IEvent {
  on: (<Evt extends EventType>(eType: Evt, callback: EventCallback<EventParamsDefinition[Evt]>) => this) &
    (<Evt extends EventType>(
      eType: Evt,
      query: EventQuery,
      callback: EventCallback<EventParamsDefinition[Evt]>
    ) => this);
  off: (<Evt extends EventType>(eType: Evt, callback?: EventCallback<EventParamsDefinition[Evt]>) => this) &
    (<Evt extends EventType>(
      eType: Evt,
      query: EventQuery,
      callback: EventCallback<EventParamsDefinition[Evt]>
    ) => this);
  emit: <Evt extends EventType>(eType: Evt, params: EventParamsDefinition[Evt], level?: EventBubbleLevel) => void;
  release: () => void;

  getComposedEventMap: () => Map<EventCallback<EventParams>, { eventType: EventType; event: IComposedEvent }>;
  prevent: <Evt extends EventType>(
    eType: Evt,
    except?: {
      handler: EventCallback<EventParamsDefinition[Evt]>;
      level: EventBubbleLevel;
    }
  ) => void;
  allow: <Evt extends EventType>(eType: Evt) => void;
}

export interface IComposedEvent {
  register: <Evt extends EventType>(eType: Evt, handler: EventHandler<EventParamsDefinition[Evt]>) => void;
  unregister: () => void;
  dispatch: (v: unknown, opt: unknown) => unknown;
}

export interface IComposedEventConstructor {
  new (eventDispatcher: IEventDispatcher, mode: RenderMode): IComposedEvent;
}
