import { Bubble } from './bubble';
import { isValid, debounce, throttle, get, isFunction } from '@visactor/vutils';
import {
  BASE_EVENTS,
  Event_Bubble_Level,
  Event_Source_Type,
  HOOK_EVENT,
  EventBubbleLevels as levels
} from '../constant/event';
import type {
  EventType,
  EventQuery,
  EventHandler,
  EventParamsDefinition,
  IEventDispatcher,
  EventBubbleLevel,
  BaseEventParams,
  EventParams,
  EventFilter,
  EventSourceType,
  InteractionEventParam,
  EventCallback
} from './interface';
import type { VChart } from '../core/vchart';
import type { CompilerListenerParameters } from '../compile/interface';
import type { Compiler } from '../compile/compiler';
import type { StringOrNumber } from '../typings';
import type { IComponent } from '../component/interface';
import { Factory } from '../core/factory';
import type { IMarkGraphic } from '../mark/interface';
import { getDatumOfGraphic } from '../util';

const componentTypeMap: Record<string, string> = {
  cartesianAxis: 'axis',
  'cartesianAxis-band': 'axis',
  'cartesianAxis-linear': 'axis',
  'cartesianAxis-time': 'axis',
  polarAxis: 'axis',
  'polarAxis-band': 'axis',
  'polarAxis-linear': 'axis',
  discreteLegend: 'legend',
  continuousLegend: 'legend',
  colorLegend: 'legend',
  sizeLegend: 'legend'
  // 组件的 type 如果没有细化的分类，不需要在这里进行映射
  // label: 'label',
  // markLine: 'markLine',
  // markArea: 'markArea',
  // markPoint: 'markPoint',
  // polarMarkLine: 'polarMarkLine',
  // polarMarkArea: 'polarMarkArea',
  // polarMarkPoint: 'polarMarkPoint',
  // geoMarkPoint: 'geoMarkPoint'
};

export class EventDispatcher implements IEventDispatcher {
  globalInstance: VChart;

  // view 事件与 window 事件视作为不同类型的事件信息，进行独立的冒泡处理
  private _viewBubbles: Map<EventType, Bubble> = new Map<EventType, Bubble>();
  private _windowBubbles: Map<EventType, Bubble> = new Map<EventType, Bubble>();
  private _canvasBubbles: Map<EventType, Bubble> = new Map<EventType, Bubble>();

  private _viewListeners: Map<string, (params: CompilerListenerParameters) => void> = new Map<
    string,
    (params: CompilerListenerParameters) => void
  >();
  private _windowListeners: Map<string, (params: CompilerListenerParameters) => void> = new Map<
    string,
    (params: CompilerListenerParameters) => void
  >();
  private _canvasListeners: Map<string, (params: CompilerListenerParameters) => void> = new Map<
    string,
    (params: CompilerListenerParameters) => void
  >();

  private _compiler: Compiler;

  constructor(vchart: VChart, compiler: Compiler) {
    this.globalInstance = vchart;
    this._compiler = compiler;
  }

  register<Evt extends EventType>(eType: Evt, handler: EventHandler<EventParamsDefinition[Evt]>): this {
    // 解析 query 配置并生成最终 handler 内容
    this._parseQuery(handler);
    // view/window 事件做独立的处理
    const bubbles = this.getEventBubble(handler.filter?.source || Event_Source_Type.chart);
    const listeners = this.getEventListeners(handler.filter?.source || Event_Source_Type.chart);

    if (!bubbles.get(eType)) {
      bubbles.set(eType, new Bubble());
    }

    // 挂载事件监听
    const bubble = bubbles.get(eType) as Bubble;
    bubble.addHandler(handler, handler.filter?.level as EventBubbleLevel);
    if (this._isValidEvent(eType) && !listeners.has(eType)) {
      const callback = this._onDelegate.bind(this);
      this._compiler.addEventListener(handler.filter?.source as EventSourceType, eType, callback);
      listeners.set(eType, callback);
    } else if (this._isInteractionEvent(eType) && !listeners.has(eType)) {
      const callback = this._onDelegateInteractionEvent.bind(this);
      this._compiler.addEventListener(handler.filter?.source as EventSourceType, eType, callback);
      listeners.set(eType, callback);
    }
    return this;
  }

  unregister<Evt extends EventType>(eType: Evt, handler?: EventHandler<EventParamsDefinition[Evt]>): this {
    let clean: boolean = false;
    // view/window 事件做独立的处理
    const bubbles = this.getEventBubble(handler?.filter?.source || Event_Source_Type.chart);
    const listeners = this.getEventListeners(handler?.filter?.source || Event_Source_Type.chart);

    if (!handler) {
      const bubble = bubbles.get(eType);
      bubble?.release();
      bubbles.delete(eType);
      clean = true;
    } else {
      const bubble = bubbles.get(eType);
      bubble?.removeHandler(handler);
      if (bubble?.getCount() === 0) {
        bubble?.release();
        bubbles.delete(eType);
        clean = true;
      }

      if ((handler?.wrappedCallback as any)?.cancel) {
        // 取消debounce/throttle事件，释放闭包内部的上下文对象
        (handler.wrappedCallback as any).cancel();
      }
    }
    // 某个事件下所有的监听取消之后删除语法层事件的代理
    if (clean && this._isValidEvent(eType)) {
      const callback = listeners.get(eType) as (params: CompilerListenerParameters) => void;
      this._compiler.removeEventListener(handler?.filter?.source || Event_Source_Type.chart, eType, callback);
      listeners.delete(eType);
    }
    return this;
  }

  dispatch<Evt extends EventType>(eType: Evt, params: EventParamsDefinition[Evt], level?: EventBubbleLevel): this {
    // 默认事件类别为 view
    const bubble = this.getEventBubble((params as BaseEventParams).source || Event_Source_Type.chart).get(
      eType
    ) as Bubble;
    // 没有任何监听事件时，bubble 不存在
    if (!bubble) {
      return this;
    }

    // 事件冒泡逻辑：Mark -> Model -> Chart -> VChart
    let stopBubble: boolean = false;

    if (level) {
      // 如果指定了 level，则直接处理，不进行冒泡
      const handlers = bubble.getHandlers(level);
      stopBubble = this._invoke(handlers, eType, params);
    } else {
      let i = 0;

      // Mark 级别的事件只包含对语法层代理的基础事件
      while (!stopBubble && i < levels.length) {
        stopBubble = this._invoke(bubble.getHandlers(levels[i]), eType, params);
        i++;
      }
    }

    return this;
  }

  prevent<Evt extends EventType>(
    eType: Evt,
    except?: {
      handler: EventCallback<EventParams>;
      level: EventBubbleLevel;
    }
  ): this {
    const eventSourceTypes = ['canvas', 'chart', 'window'] as EventSourceType[];
    eventSourceTypes.forEach(type => {
      const bubble = this.getEventBubble(type).get(eType);
      if (bubble) {
        bubble.getAllHandlers().forEach(handler => {
          if (!except) {
            bubble.preventHandler(handler);
          } else if (
            // 只能 prevent 比当前 level 更低的事件
            (levels as EventBubbleLevel[]).indexOf(handler.filter.level) <
            (levels as EventBubbleLevel[]).indexOf(except.level)
          ) {
            if (handler.callback !== except.handler) {
              bubble.preventHandler(handler);
            }
          }
        });
      }
    });
    return this;
  }

  allow<Evt extends EventType>(eType: Evt): this {
    const eventTypes = ['canvas', 'chart', 'window'] as EventSourceType[];
    eventTypes.forEach(type => {
      const bubble = this.getEventBubble(type).get(eType);
      if (bubble) {
        bubble.getAllHandlers().forEach(handler => bubble.allowHandler(handler));
      }
    });
    return this;
  }

  clear(): void {
    const types = [Event_Source_Type.chart, Event_Source_Type.window, Event_Source_Type.canvas];

    types.forEach(type => {
      const listeners = this.getEventListeners(type);
      for (const entry of listeners.entries()) {
        this._compiler.removeEventListener(type, entry[0], entry[1]);
      }
      listeners.clear();
    });

    [this._viewBubbles, this._windowBubbles, this._canvasBubbles].forEach(bubbles => {
      for (const bubble of bubbles.values()) {
        bubble.release();
      }
      bubbles.clear();
    });
  }

  release(): void {
    this.clear();
    this.globalInstance = null;
    this._compiler = null;
  }

  /**
   * 基于转换后的事件筛选配置过滤需要调用的 handler
   */
  private _filter<Evt extends EventType>(filter: EventFilter, evt: Evt, params: EventParamsDefinition[Evt]): boolean {
    if (isFunction(filter.filter) && !filter.filter(params)) {
      return false;
    }

    // 事件 level 不需要筛选，在冒泡流程中已经处理了 level 的逻辑
    if (filter.nodeName && get(params, 'node.name') !== filter.nodeName) {
      return false;
    }

    if (filter.markName && (params as BaseEventParams)?.mark?.name !== filter.markName) {
      // 对于 markName 的筛选需要包含所有父级 mark 的 name
      return false;
    }

    let modelType = params.model?.type;
    if (componentTypeMap[modelType]) {
      modelType = componentTypeMap[modelType];
    }
    if (filter.type && modelType !== filter.type) {
      return false;
    }

    // 如果配置了 level 为 'mark' 并且没有配置 type，则只在事件参数中包含了 mark 时才触发
    if (filter.level === 'mark' && !filter.type && !(params as BaseEventParams)?.mark) {
      return false;
    }

    // 如果配置了 level 为 'model' 并且没有配置 type，则只在事件参数中包含了 model 时才触发
    if (filter.level === 'model' && !filter.type && !(params as BaseEventParams)?.model) {
      return false;
    }

    if (isValid(filter.userId) && params.model?.userId !== filter.userId) {
      return false;
    }

    return true;
  }

  /**
   * 代理语法层事件的监听回调
   */
  private _onDelegate = (listenerParams: CompilerListenerParameters) => {
    const chart = this.globalInstance.getChart();
    const model = (isValid(listenerParams.modelId) && chart?.getModelById(listenerParams.modelId)) || undefined;
    const mark = (isValid(listenerParams.markId) && chart?.getMarkById(listenerParams.markId)) || null;

    const node = get(listenerParams.event, 'target');

    let datum = listenerParams.datum;
    if (model && model.modelType === 'component') {
      datum = (model as IComponent).getDatum(node) ?? datum;
    }

    const params: BaseEventParams = {
      event: listenerParams.event,
      item: listenerParams.item,
      source: listenerParams.source,
      datum,
      chart,
      model,
      mark: mark ?? undefined,
      node: node
    };
    this.dispatch(listenerParams.type, params);
  };

  /**
   * 代理语法层事件的监听回调
   */
  private _onDelegateInteractionEvent = (listenerParams: CompilerListenerParameters) => {
    const chart = this.globalInstance.getChart();
    const event = listenerParams.event;
    let graphics: IMarkGraphic[] = null;

    if ((event as any).graphics) {
      graphics = (event as any).graphics;
    }
    const params: InteractionEventParam = {
      event: listenerParams.event,
      chart,
      graphics,
      datums:
        graphics &&
        graphics.map(g => {
          return getDatumOfGraphic(g);
        })
    };
    this.dispatch(listenerParams.type, params);
  };

  /**
   * 调用相应事件监听下的 handlers
   */
  private _invoke<Evt extends EventType>(
    handlers: EventHandler<EventParams>[],
    type: EventType,
    params: EventParamsDefinition[Evt]
  ): boolean {
    const result = handlers.map(handler => {
      const filter = handler.filter as EventFilter;
      if (!handler.prevented && (!handler.query || this._filter(filter, type, params))) {
        const callback = handler.wrappedCallback || handler.callback;
        const stopBubble = callback.call(null, { ...params });
        const doStopBubble = stopBubble ?? handler.query?.consume;
        if (doStopBubble) {
          (params as BaseEventParams).event?.stopPropagation();
          (params as BaseEventParams).event?.preventDefault();
        }
        return !!doStopBubble;
      }
      return undefined;
    });
    // 如果某个事件回调阻止了冒泡，则阻止更高级别事件的调用过程
    return result.some(r => r === true);
  }

  /**
   * 依据事件 query 得到事件冒泡层级
   */
  private _getQueryLevel(query: EventQuery | null): EventBubbleLevel {
    // 事件默认监听在 vchart 层
    if (!query) {
      return Event_Bubble_Level.vchart;
    }
    if (query.level) {
      return query.level;
    }
    if (isValid(query.id)) {
      return Event_Bubble_Level.model;
    }

    return Event_Bubble_Level.vchart;
  }

  /**
   * 将用户 query 配置转换为最终事件筛选参数
   */
  private _parseQuery(handler: EventHandler<EventParams>): EventHandler<EventParams> {
    const query = handler.query;
    // 处理 query 带来的函数封装
    if (query?.throttle) {
      handler.wrappedCallback = throttle(handler.callback, query.throttle);
    } else if (query?.debounce) {
      handler.wrappedCallback = debounce(handler.callback, query.debounce);
    }
    let level = this._getQueryLevel(query);
    let type: string | null = null;
    let source: EventSourceType = Event_Source_Type.chart;
    let nodeName: string | null = null;
    let markName: string | null = null;
    let userId: StringOrNumber | null = null;

    if (query?.nodeName) {
      nodeName = query.nodeName;
    }

    if (query?.markName) {
      markName = query.markName;
    }

    if (query?.type && (level === Event_Bubble_Level.model || level === Event_Bubble_Level.mark)) {
      type = query.type;
    }
    if (query?.source) {
      source = query.source;
    }

    if (isValid(query?.id)) {
      userId = query?.id;
      level = Event_Bubble_Level.model; // 如果用户配置了 id，那么默认 level 为 model
    }
    handler.filter = {
      level,
      markName,
      type,
      source,
      nodeName,
      userId,
      filter: query?.filter ?? null
    };
    return handler;
  }

  private getEventBubble(source: EventSourceType) {
    switch (source) {
      case Event_Source_Type.chart:
        return this._viewBubbles;
      case Event_Source_Type.window:
        return this._windowBubbles;
      case Event_Source_Type.canvas:
        return this._canvasBubbles;
      default:
        return this._viewBubbles;
    }
  }

  private getEventListeners(source: EventSourceType) {
    switch (source) {
      case Event_Source_Type.chart:
        return this._viewListeners;
      case Event_Source_Type.window:
        return this._windowListeners;
      case Event_Source_Type.canvas:
        return this._canvasListeners;
      default:
        return this._viewListeners;
    }
  }

  private _isValidEvent(eType: string) {
    return BASE_EVENTS.includes(eType) || (Object.values(HOOK_EVENT) as string[]).includes(eType);
  }

  private _isInteractionEvent(eType: string) {
    let interactionType: string;

    return (
      eType &&
      ((interactionType = eType.split(':')[0]), interactionType) &&
      Factory.hasInteractionTrigger(interactionType)
    );
  }
}
