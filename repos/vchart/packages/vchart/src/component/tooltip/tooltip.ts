import { ComponentTypeEnum } from '../interface/type';
import type { IModelRenderOption } from '../../model/interface';
import type { IRegion } from '../../region/interface';
import { BaseComponent } from '../base/base-component';
import type { BaseEventParams, EventCallback, EventQuery, EventType } from '../../event/interface';
import type { ITooltipHandler, TooltipActiveType } from '../../typings/tooltip';
import type { Datum, IPoint, IShowTooltipOption } from '../../typings';
import { isMobileLikeMode, isTrueBrowser, isMiniAppLikeMode } from '../../util/env';
import type {
  ITooltip,
  ITooltipActiveTypeAsKeys,
  ITooltipSpec,
  TooltipHandlerParams,
  TotalMouseEventData
} from './interface';
import { TooltipResult } from './interface/common';
import { showTooltip } from './utils/show-tooltip';
import { isEmptyPos } from './utils/common';
import { isSameDimensionInfo } from '../../event/events/dimension/util/common';
import { ChartEvent, Event_Source_Type } from '../../constant/event';
import type {
  DimensionTooltipInfo,
  GroupTooltipInfo,
  ITooltipProcessor,
  MarkTooltipInfo,
  TooltipInfo
} from './processor/interface';
import { isDimensionInfo, isMarkInfo } from './processor/util';
// eslint-disable-next-line no-duplicate-imports
import { isValid, isNil, array, isNumber, throttle, isObject, isEqual } from '@visactor/vutils';
import { VChart } from '../../core/vchart';
import type { TooltipEventParams } from './interface/event';
import { Factory } from '../../core/factory';
import type { IGraphic } from '@visactor/vrender-core';
import { TooltipSpecTransformer } from './tooltip-transformer';
import { error } from '../../util';
import { DEFAULT_SHOW_DELAY, TooltipHandlerType, TooltipType } from './constant';
import { tooltip } from '../../theme/builtin/common/component/tooltip';

type EventHandlerList = {
  eventType: EventType;
  handler: any;
}[];

export class Tooltip extends BaseComponent<any> implements ITooltip {
  protected layoutZIndex: number = 1;
  static type = ComponentTypeEnum.tooltip;
  static readonly transformerConstructor = TooltipSpecTransformer;
  type = ComponentTypeEnum.tooltip;
  name: string = ComponentTypeEnum.tooltip;
  readonly transformerConstructor = TooltipSpecTransformer;

  static readonly builtInTheme = {
    tooltip
  };

  static specKey = 'tooltip';
  specKey = 'tooltip';

  layoutType: 'none' = 'none';
  private _hideTimer?: number;
  private _outTimer?: number;
  private _showTimer?: number;
  private _needInitEventOfTooltip?: boolean;
  private _enterable: boolean;
  private _isReleased: boolean = false;
  /**
   * 是否正在浏览tooltip内容
   */
  private _isEnterTooltip: boolean;
  declare protected _spec: ITooltipSpec;

  tooltipHandler?: ITooltipHandler;
  enable?: boolean = true;

  processor: ITooltipActiveTypeAsKeys<
    ITooltipProcessor<MarkTooltipInfo>,
    ITooltipProcessor<DimensionTooltipInfo>,
    ITooltipProcessor<GroupTooltipInfo>
  >;

  private _alwaysShow: boolean = false;

  private _cacheInfo: TooltipInfo | undefined;
  private _cacheParams: BaseEventParams | undefined;
  private _cacheActiveType: TooltipActiveType | undefined;
  private _cacheEnterableRect: { width: number; height: number };

  private _eventList: EventHandlerList = [];

  protected _isTooltipShown: boolean = false;

  protected _clickLock: boolean = false;
  private _handleMouseMove: (params: BaseEventParams) => void;

  /** 当前是否正在显示 tooltip */
  isTooltipShown() {
    return this._isTooltipShown;
  }

  protected _registerEvent() {
    /* do nothing */
  }
  protected _releaseEvent() {
    /* do nothing */
  }
  onLayoutEnd() {
    /* do nothing */
  }

  created() {
    super.created();
    this._regions = this._option.getAllRegions();
    // event
    this._initEvent();
  }

  _compareSpec(spec: ITooltipSpec, prevSpec: ITooltipSpec) {
    const result = super._compareSpec(spec, prevSpec);
    const specChanged = !isEqual(prevSpec, spec);

    if (specChanged && !result.reMake && !result.reCompile) {
      result.change = true;
      result.reRender = true;
      result.effects = {
        ...result.effects,
        component: true,
        render: true
      };
    }

    return result;
  }

  release() {
    super.release();
    this._isReleased = true;
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
    }

    this._eventList.forEach(({ eventType, handler }) => {
      this.event.off(eventType, handler);
    });
    this._eventList = [];
    this.tooltipHandler?.release?.();
    this._isTooltipShown = false;
  }

  beforeRelease() {
    // 触发事件
    this.event.emit(ChartEvent.tooltipHide, {
      tooltip: this,
      chart: this.getChart()
    } as unknown as TooltipEventParams);
    this.event.emit(ChartEvent.tooltipRelease, {
      tooltip: this,
      chart: this.getChart()
    } as unknown as TooltipEventParams);
  }

  protected _initHandler() {
    const renderMode = this._spec.renderMode ?? 'html';

    const userTooltipHandler = this._option.globalInstance.getTooltipHandlerByUser();
    if (userTooltipHandler) {
      this.tooltipHandler = userTooltipHandler;
      this._enterable = false;
    } else {
      // 构造内部默认 handler
      const type = renderMode === 'canvas' ? TooltipHandlerType.canvas : TooltipHandlerType.dom;
      const handlerConstructor = Factory.getComponentPluginInType(type);
      if (!handlerConstructor) {
        error('Can not find tooltip handler: ' + type);
      }
      const handler = new handlerConstructor();
      handler.name = `${this._spec.className}-${this._option.globalInstance.id ?? 0}-${this.getSpecIndex()}`;
      this.pluginService?.load([handler]);

      this.tooltipHandler = handler as unknown as ITooltipHandler;

      if (this._spec.enterable && renderMode === 'html' && this.tooltipHandler) {
        this._enterable = true;
        this._needInitEventOfTooltip = true;
      } else {
        this._enterable = false;
      }
    }
  }

  protected _initEventOfTooltipContent() {
    if (!this._needInitEventOfTooltip) {
      return;
    }

    const container = this.tooltipHandler?.getRootDom?.();

    if (container) {
      container.addEventListener('pointerenter', () => {
        if (!this._enterable) {
          return;
        }
        this._isEnterTooltip = true;

        const rect = container.getBoundingClientRect?.();
        if (rect) {
          this._cacheEnterableRect = { width: rect.width, height: rect.height };
        }
        if (this._outTimer) {
          clearTimeout(this._outTimer);
          this._outTimer = null;
        }

        if (this._showTimer) {
          clearTimeout(this._showTimer);
          this._showTimer = null;
        }
      });

      container.addEventListener('pointerleave', () => {
        if (!this._enterable) {
          return;
        }
        this._isEnterTooltip = false;

        if (this._spec.triggerOff === 'none') {
          return;
        }

        if (this._cacheEnterableRect) {
          const newRect = container.getBoundingClientRect?.();

          /**
           * 这里需要比对width，height，是防止用户在进入到tooltip 的时候做了一些操作，
           * 导致tooltip的尺寸发生变更，这种情况一般不需要隐藏tooltip
           */
          if (
            newRect &&
            Object.keys(this._cacheEnterableRect).every(
              k => (this._cacheEnterableRect as any)[k] === (newRect as any)[k]
            )
          ) {
            this._cacheEnterableRect = null;
            this._outTimer = setTimeout(
              this.hideTooltip,
              this._spec?.showDelay ?? DEFAULT_SHOW_DELAY
            ) as unknown as number;
          }
        }
      });

      this._needInitEventOfTooltip = false;
    }
  }

  protected _initProcessor() {
    // 初始化 tooltip 类型
    const activeType = this._spec.activeType;

    this.processor = {};

    (activeType as TooltipActiveType[]).forEach(type => {
      const instance = Factory.createTooltipProcessor(type, this);

      if (instance) {
        (this.processor as any)[type] = instance;
      }
    });
  }

  protected _initEvent() {
    if (this._option.disableTriggerEvent) {
      return;
    }
    const trigger = array(this._spec.trigger ?? 'hover');
    const triggerOff = array(this._spec.triggerOff);
    const mode = this._option.mode;

    trigger.forEach(triggerType => {
      if (triggerType === 'hover') {
        this._handleMouseMove = this._throttle(this._getMouseMoveHandler(false));

        this._mountEvent('pointermove', { source: 'chart' }, this._handleMouseMove);
        // 移动端的点按 + 滑动触发
        if (isMobileLikeMode(mode) || isMiniAppLikeMode(mode)) {
          this._mountEvent('pointerdown', { source: 'chart' }, this._getMouseMoveHandler(false));
          this._mountEvent('pointerup', { source: 'window' }, this._getMouseOutHandler(true));
        }
        this._mountEvent('pointerleave', { source: 'chart' }, this._getMouseOutHandler(false));
      } else if (triggerType === 'click') {
        this._mountEvent('pointertap', { source: 'chart' }, this._getMouseMoveHandler(true));
        this._mountEvent('pointerup', { source: 'window' }, this._getMouseOutHandler(true));
      } else if (isObject(triggerType)) {
        this._mountEvent(
          triggerType.eventType,
          { source: triggerType.source ?? 'chart', consume: triggerType.consume },
          this._getMouseMoveHandler(true)
        );
      }
    });
    const offEvents = triggerOff.filter(entry => isObject(entry));

    offEvents.forEach(entry => {
      this._mountEvent(
        (entry as any).eventType,
        { source: (entry as any).source ?? 'chart', consume: (entry as any).consume },
        this._getMouseOutHandler((entry as any).checkOutside ?? false)
      );
    });

    if (!trigger.includes('click') && this._spec.lockAfterClick) {
      this._mountEvent('pointertap', { source: 'chart' }, this._handleClickToLock);
    }
  }

  protected _throttle(callback: (...args: any[]) => any): (...args: any[]) => any {
    let wait: number;
    if (isNumber(this._spec.throttleInterval)) {
      wait = this._spec.throttleInterval;
    } else {
      if (this._spec.renderMode !== 'html' || !this._spec.transitionDuration) {
        wait = 10;
      } else {
        wait = 50;
      }
    }
    return throttle(callback, wait);
  }

  protected _mountEvent = (eType: EventType, query: EventQuery, callback: EventCallback<any>) => {
    this.event.on(eType, query, callback);
    this._eventList.push({
      eventType: eType,
      handler: callback
    });
  };

  protected _handleClickToLock = (params: BaseEventParams) => {
    if (this._clickLock) {
      this._handleChartMouseOut(params);
      this._clickLock = false;
    } else {
      if (!this._isTooltipShown && !this.tooltipHandler?.isTooltipShown?.()) {
        return;
      }
      this._clickLock = true;
    }
  };

  protected _getMouseOutHandler = (needPointerDetection?: boolean) => (params: BaseEventParams) => {
    if (this._isReleased) {
      return;
    }
    if (this._alwaysShow || this._clickLock) {
      return;
    }

    if (!this._isTooltipShown && !this.tooltipHandler?.isTooltipShown?.()) {
      return;
    }

    const browserEnv = isTrueBrowser(this._option?.mode);
    const { clientX, clientY } = params.event as MouseEvent;

    // 当 enterable 为 true，同时鼠标移入 tooltip 时 pointerleave 事件也会触发，所以这里做一个判断

    // 判断鼠标是否在图表范围内
    if (browserEnv && needPointerDetection && this._isPointerInChart({ x: clientX, y: clientY })) {
      return;
    }

    if (this._enterable) {
      this._outTimer = setTimeout(() => {
        this._handleChartMouseOut(params);
      }, this._spec?.showDelay ?? DEFAULT_SHOW_DELAY) as unknown as number;
    } else {
      this._handleChartMouseOut(params);
    }
  };

  protected _handleChartMouseOut = (params?: BaseEventParams) => {
    if (
      this._cacheActiveType &&
      this._option?.componentShowContent &&
      (this._option.componentShowContent.tooltip === false ||
        (isObject(this._option.componentShowContent.tooltip) &&
          this._option.componentShowContent.tooltip[this._cacheActiveType] === false))
    ) {
      return;
    }
    if (this._alwaysShow || this._isReleased || this._isEnterTooltip) {
      return;
    }

    if (this._spec.triggerOff !== 'none') {
      this._hideTooltipByHandler({
        ...(params as any),
        tooltip: this
      });

      if (this._handleMouseMove && (this._handleMouseMove as any).cancel) {
        // 防止因为throttle，mousemove事件又触发了一遍，导致 tooltip 隐藏失败
        (this._handleMouseMove as any).cancel();
      }
      this._cacheEnterableRect = null;
      this._cacheInfo = undefined;
      this._cacheParams = undefined;
      this._cacheActiveType = undefined;
    }
  };

  protected _getMouseMoveHandler = (isClick: boolean) => (params: BaseEventParams) => {
    if (this._isReleased || this._isEnterTooltip) {
      return;
    }
    if (this._outTimer) {
      clearTimeout(this._outTimer);
      this._outTimer = null;
    }

    if (!this.tooltipHandler) {
      this._initHandler();
    }

    if (!this.processor) {
      this._initProcessor();
    }

    if (this._alwaysShow) {
      return;
    }

    if (this._clickLock) {
      if (isClick) {
        this._handleChartMouseOut(params);
        this._clickLock = false;
      }
      return;
    }

    if (!isClick && this._enterable && this.tooltipHandler?.isTooltipShown?.()) {
      if (this._showTimer) {
        clearTimeout(this._showTimer);
      }

      this._showTimer = setTimeout(() => {
        this._handleChartMouseMove(params, isClick);
      }, this._spec?.showDelay ?? DEFAULT_SHOW_DELAY) as unknown as number;
    } else {
      this._handleChartMouseMove(params, isClick);
    }
  };

  protected _handleChartMouseMove = (params: BaseEventParams, isClick: boolean) => {
    if (this._isReleased) {
      return;
    }
    /* 获取 tooltip 原始数据 */
    const mouseEventData = this._getMouseEventData(params);
    const {
      tooltipInfo: { dimension: dimensionInfo },
      ignore: { mark: ignoreMark }
    } = mouseEventData;

    /** tooltip 是否显示成功 */
    const success: ITooltipActiveTypeAsKeys<
      boolean | 'unShowByOption',
      boolean | 'unShowByOption',
      boolean | 'unShowByOption'
    > = {
      mark: false,
      dimension: false,
      group: false
    };

    const supportedTooltip = [TooltipType.group, TooltipType.mark, TooltipType.dimension];

    for (let i = 0, len = supportedTooltip.length; i < len; i++) {
      const type = supportedTooltip[i];
      const res = this.processor[type] ? this._showTooltipByMouseEvent(type, mouseEventData, params, isClick) : false;

      if (res === 'unShowByOption') {
        success[type] = 'unShowByOption';
      } else if (res) {
        success[type] = true;
        break;
      }
    }

    /* 如果不是常规情况，进行一些特殊情况tooltip处理 */
    if (Object.values(success).every(val => !val) && !isEmptyPos(params)) {
      // 用户手动配置ignore，则继续显示缓存tooltip
      if (ignoreMark && isMarkInfo(this._cacheInfo)) {
        success.mark = this._showTooltipByMouseEvent('mark', mouseEventData, params, isClick, true);
      } else if (isValid(dimensionInfo)) {
        // 用户没有手动配置ignore的话，默认显示dimension tooltip
        success.dimension = this._showTooltipByMouseEvent('dimension', mouseEventData, params, isClick);
      }
    }

    /* 如果还是不应该显示tooltip，则隐藏上一次tooltip */
    if (success.mark !== true && success.group !== true && (success.dimension !== true || isNil(dimensionInfo))) {
      // 如果 tooltip 类型都不是 'unShowByOption'，则隐藏上一次 tooltip
      // 否则，不隐藏上一次 tooltip ，tooltip 不展示属于 'unShowByOption' 类型的情况
      if (!this._cacheActiveType || success[this._cacheActiveType as TooltipActiveType] !== 'unShowByOption') {
        this._handleChartMouseOut(params);
      }
    } else {
      this._initEventOfTooltipContent();
    }
  };

  protected _showContentByEvent(activeType: TooltipActiveType) {
    if (this._option?.componentShowContent) {
      // 全局关闭 tooltip
      if (this._option.componentShowContent.tooltip === false) {
        return false;
      }
      // 单独关闭 tooltip
      if (
        isObject(this._option.componentShowContent.tooltip) &&
        this._option.componentShowContent.tooltip[activeType] === false
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * 通过鼠标事件触发 tooltip，返回是否成功
   * @param activeType tooltip 类型
   * @param mouseEventData tooltip 相关数据
   * @param params 事件参数
   * @param useCache 是否直接显示缓存 tooltip
   * @returns 是否成功执行
   */
  protected _showTooltipByMouseEvent = (
    activeType: TooltipActiveType,
    mouseEventData: TotalMouseEventData,
    params: BaseEventParams,
    isClick: boolean,
    useCache?: boolean
  ): boolean | 'unShowByOption' => {
    if (!this._showContentByEvent(activeType)) {
      return 'unShowByOption';
    }

    const processor = this.processor[activeType];
    // 判断是否应该触发 tooltip
    if (!processor.shouldHandleTooltip(params, mouseEventData.tooltipInfo[activeType])) {
      return false;
    }
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
    }

    let success: boolean;

    if (useCache) {
      // 直接显示缓存 tooltip
      success = !processor.showTooltip(this._cacheInfo as any, params, true);
    } else {
      const tooltipInfo = mouseEventData.tooltipInfo[activeType];
      const isSameAsCache = this._isSameAsCache(tooltipInfo, params, activeType);

      success = !processor.showTooltip(tooltipInfo as any, params, isSameAsCache);

      if (success) {
        // 成功显示 tooltip，则更新缓存
        this._cacheInfo = tooltipInfo;
        this._cacheParams = params;
        this._cacheActiveType = activeType;
      }
    }
    if (success) {
      this._isTooltipShown = true;
      if (isClick && this._spec.lockAfterClick && !this._clickLock) {
        this._clickLock = true;
      } else if (Number.isFinite(this._spec.hideTimer)) {
        // hover 事件，设置默认的定时器，避免out事件不触发的问题
        this._hideTimer = setTimeout(() => {
          this._handleChartMouseOut();
        }, this._spec.hideTimer as number) as unknown as number;
      }
    }
    // 全局唯一 tooltip
    const vchart = this._option?.globalInstance;
    if (success && VChart.globalConfig.uniqueTooltip && vchart) {
      VChart.hideTooltip(vchart.id);
    }
    return success;
  };

  protected _getMouseEventData = (params: BaseEventParams): TotalMouseEventData => {
    const result: TotalMouseEventData = {
      tooltipInfo: {},
      ignore: {}
    };

    Object.keys(this.processor).forEach(activeType => {
      const { tooltipInfo, ignore } = this.processor[activeType as TooltipActiveType].getMouseEventData(params);
      result.tooltipInfo[activeType as TooltipActiveType] = tooltipInfo as any;
      result.ignore[activeType as TooltipActiveType] = ignore;
    });
    return result;
  };

  protected _hideTooltipByHandler = (params: TooltipHandlerParams): TooltipResult => {
    if (!this._isTooltipShown && !this.tooltipHandler?.isTooltipShown?.()) {
      // 如果当前 tooltip 未显示，则提前退出
      return TooltipResult.success;
    }

    // 触发事件
    this.event.emit(ChartEvent.tooltipHide, {
      ...params,
      source: Event_Source_Type.chart, // 统一 event 的来源
      tooltip: this
    });

    // 删除缓存
    Object.values(this.processor).forEach((processor: ITooltipProcessor<TooltipInfo>) => {
      processor.clearCache();
    });

    // 隐藏 tooltip
    const handler = this._spec.handler ?? this.tooltipHandler;
    // 防止用户自定义 handler 时，未实现 hideTooltip 方法
    if (handler?.hideTooltip) {
      const result = handler.hideTooltip.call(handler, params);
      if (!result) {
        this._isTooltipShown = false;
      }
      return result;
    }
    return TooltipResult.failed;
  };

  reInit(spec?: any) {
    super.reInit(spec);

    if (this.tooltipHandler) {
      const renderMode = this._spec.renderMode ?? 'html';
      const newEnterable = this._spec.enterable && renderMode === 'html';

      if (newEnterable && !this._enterable) {
        this._needInitEventOfTooltip = true;
      }
      this._enterable = newEnterable;

      this.tooltipHandler?.reInit?.();
    } else {
      this._initHandler();
    }
  }

  showTooltip(datum: Datum, options: IShowTooltipOption) {
    if (!this.tooltipHandler) {
      this._initHandler();
    }

    if (!this.processor) {
      this._initProcessor();
    }

    if (!this.tooltipHandler?.showTooltip) {
      return false;
    }

    const result = showTooltip(datum, options, this);
    if (result !== 'none') {
      this._alwaysShow = !!options?.alwaysShow;
      this._cacheActiveType = result;
    }
    return result;
  }

  /** 手动隐藏 tooltip，返回是否成功 */
  hideTooltip = (): boolean => {
    if (this._isReleased) {
      return false;
    }

    const params: TooltipHandlerParams = {
      changePositionOnly: false,
      tooltip: this,
      item: undefined,
      datum: undefined,
      source: Event_Source_Type.chart
    } as any;

    this._alwaysShow = false;
    return !this._hideTooltipByHandler(params);
  };

  private _isSameAsCache(
    nextInfo?: TooltipInfo,
    nextParams?: BaseEventParams,
    nextActiveType?: TooltipActiveType
  ): boolean {
    if (nextActiveType !== this._cacheActiveType) {
      return false;
    }
    if (nextInfo === this._cacheInfo) {
      return true;
    }
    if (isNil(this._cacheInfo) || isNil(nextInfo)) {
      return false;
    }

    // 判断 tooltip 信息是否一致
    if (isDimensionInfo(nextInfo)) {
      if (isMarkInfo(this._cacheInfo)) {
        return false;
      }

      const prevInfo = this._cacheInfo as DimensionTooltipInfo;
      const isSameAsCacheInfo =
        prevInfo.length === nextInfo.length && nextInfo.every((info, i) => isSameDimensionInfo(info, prevInfo[i]));

      return isSameAsCacheInfo;
    }

    if (isDimensionInfo(this._cacheInfo)) {
      return false;
    }

    const prevInfo = this._cacheInfo as MarkTooltipInfo;
    const isSameAsCacheInfo =
      nextInfo?.datum === prevInfo.datum && nextInfo?.mark === prevInfo.mark && nextInfo?.series === prevInfo.series;
    if (!isSameAsCacheInfo) {
      return false;
    }

    // 判断事件触发信息是否一致
    const prevParams = this._cacheParams;
    if (isNil(prevParams) || isNil(nextParams)) {
      return false;
    }
    return (
      prevParams.mark === nextParams.mark &&
      prevParams.model === nextParams.model &&
      prevParams.datum === nextParams.datum
    );
  }

  private _isPointerInChart(point: IPoint): boolean {
    const globalInstance = this._option?.globalInstance;
    if (!globalInstance) {
      return false;
    }
    const chart = globalInstance.getChart();
    if (!chart) {
      return false;
    }
    const { x, y } = point;
    const canvas = globalInstance.getCanvas();
    const { x: chartX, y: chartY, width: chartWidth, height: chartHeight } = canvas.getBoundingClientRect();
    // 鼠标仍在图表范围内，则不处理
    if (x >= chartX && x <= chartX + chartWidth && y >= chartY && y <= chartY + chartHeight) {
      return true;
    }

    return false;
  }

  getVisible() {
    return this._spec.visible !== false;
  }
}

export const registerTooltip = () => {
  Factory.registerComponent(Tooltip.type, Tooltip);
};
