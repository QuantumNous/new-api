import { clamp, abs, merge, mixin, isValid, isBoolean, isValidNumber } from '@visactor/vutils';
import type { IRoamDragSpec, IRoamScrollSpec, IRoamZoomSpec } from './interface';
import type { BaseEventParams, IEvent } from '../../event/interface';
import type { IDataZoomSpec } from './data-zoom/interface';
import type { IRegion } from '../../region';
import { Direction, type ILayoutRect } from '../../typings';
import { Zoomable, type IZoomable } from '../../interaction/zoom';
import type { IDelayType } from '@visactor/vrender-components';
import type { IComponentOption } from '../interface';
import { getDirectionByOrient, getOrient } from '../axis/cartesian/util';

export class DataFilterEvent {
  protected _type: 'dataZoom' | 'scrollBar';
  protected _spec: IDataZoomSpec;
  protected _option: IComponentOption;
  protected _handleChange: (start: number, end: number, updateComponent?: boolean) => void;

  protected getLayoutRect: () => ILayoutRect;
  protected getState: () => { start: number; end: number };
  protected getRegions: () => IRegion[];
  protected getOption: () => IComponentOption;
  protected getEvent: () => IEvent;
  protected _isHorizontal: boolean;
  protected _regions: IRegion[];

  protected _activeRoam: boolean = true;
  protected _zoomAttr: IRoamZoomSpec = {
    enable: true,
    rate: 1,
    focus: true
  };
  protected _dragAttr: IRoamDragSpec = {
    enable: true,
    rate: 1,
    reverse: true
  };
  protected _scrollAttr: IRoamScrollSpec = {
    enable: true,
    rate: 1,
    reverse: true
  };

  enableInteraction() {
    this._activeRoam = true;
  }
  disableInteraction() {
    this._activeRoam = false;
  }
  zoomIn(location?: { x: number; y: number }) {
    this.handleChartZoom({
      zoomDelta: 1.2, // 经验值
      zoomX: location?.x,
      zoomY: location?.y
    });
  }

  zoomOut(location?: { x: number; y: number }) {
    this.handleChartZoom({
      zoomDelta: 0.8, // 经验值
      zoomX: location?.x,
      zoomY: location?.y
    });
  }

  constructor(
    type: 'dataZoom' | 'scrollBar',
    spec: IDataZoomSpec,
    handleChange: (start: number, end: number, updateComponent?: boolean) => void,
    getLayoutRect: () => ILayoutRect,
    getState: () => { start: number; end: number },
    getRegions: () => IRegion[],
    getOption: () => IComponentOption,
    getEvent: () => IEvent
  ) {
    this._type = type;
    this._spec = spec;
    this._handleChange = handleChange;
    this.getLayoutRect = getLayoutRect;
    this.getState = getState;
    this.getRegions = getRegions;
    this._regions = getRegions();
    this.getOption = getOption;
    this._option = getOption();
    this.getEvent = getEvent;

    this._isHorizontal = getDirectionByOrient(getOrient(spec as any)) === Direction.horizontal;
  }

  setEventAttrFromSpec() {
    if (this._spec.roamZoom === true || this._spec.roamZoom) {
      this._zoomAttr = merge({}, this._zoomAttr, this._spec.roamZoom);
    } else {
      this._zoomAttr.enable = false;
    }

    if (this._spec.roamDrag === true || this._spec.roamDrag) {
      this._dragAttr = merge({}, this._dragAttr, this._spec.roamDrag);
    } else {
      this._dragAttr.enable = false;
    }

    if (this._spec.roamScroll === true || this._spec.roamScroll) {
      this._scrollAttr = merge({}, this._scrollAttr, this._spec.roamScroll);
    } else {
      this._scrollAttr.enable = false;
    }

    if (isBoolean((this._spec as any).roam)) {
      this._zoomAttr.enable = this._type === 'scrollBar' ? false : (this._spec as any).roam;
      this._dragAttr.enable = (this._spec as any).roam;
      this._scrollAttr.enable = (this._spec as any).roam;
    }

    if (this._zoomAttr.enable || this._dragAttr.enable || this._scrollAttr.enable) {
      (this as unknown as IZoomable).initZoomable(this.getEvent(), this._option.mode);
    }
  }

  initZoomEvent = () => {
    const delayType: IDelayType = this._spec?.delayType ?? 'throttle';
    const delayTime = isValid(this._spec?.delayType) ? this._spec?.delayTime ?? 30 : 0;
    const realTime = this._spec?.realTime ?? true;
    const option = { delayType, delayTime, realTime, allowComponentZoom: true };
    if (this._zoomAttr.enable) {
      (this as unknown as IZoomable).initZoomEventOfRegions(this.getRegions(), null, this.handleChartZoom, option);
    }
    if (this._scrollAttr.enable) {
      (this as unknown as IZoomable).initScrollEventOfRegions(this.getRegions(), null, this.handleChartScroll, option);
    }
    if (this._dragAttr.enable) {
      (this as unknown as IZoomable).initDragEventOfRegions(this.getRegions(), null, this.handleChartDrag, option);
    }
  };

  /// add event listener
  handleChartZoom = (params: { zoomDelta: number; zoomX?: number; zoomY?: number }, e?: BaseEventParams['event']) => {
    if (!this._activeRoam || (this._zoomAttr.filter && !this._zoomAttr.filter(params, e))) {
      return;
    }

    const { zoomDelta, zoomX, zoomY } = params;
    const { x, y } = this.getRegions()[0].getLayoutStartPoint();
    const { width, height } = this.getRegions()[0].getLayoutRect();

    const delta = Math.abs(this.getState().start - this.getState().end);
    const zoomRate = (this._spec.roamZoom as IRoamZoomSpec)?.rate ?? 1;
    // zoomDelta > 1表示放大, zoomDelta < 1表示缩小
    if (delta >= 1 && zoomDelta < 1) {
      return;
    }
    if (delta <= 0.01 && zoomDelta > 1) {
      return;
    }
    const focusLoc = this._isHorizontal ? zoomX : zoomY;
    const totalValue = delta * (zoomDelta - 1) * zoomRate;
    let startValue = totalValue / 2;
    let endValue = totalValue / 2;
    if (focusLoc) {
      const startLoc = this._isHorizontal ? x : y;
      const endLoc = this._isHorizontal ? width : height;
      startValue = (Math.abs(startLoc - focusLoc) / Math.abs(endLoc - startLoc)) * totalValue;
      endValue = (Math.abs(endLoc - focusLoc) / Math.abs(endLoc - startLoc)) * totalValue;
    }
    const start = clamp(this.getState().start + startValue, 0, 1);
    const end = clamp(this.getState().end - endValue, 0, 1);

    this._handleChange(Math.min(start, end), Math.max(start, end), true);
  };

  handleChartScroll = (params: { scrollX: number; scrollY: number }, e: BaseEventParams['event']) => {
    if (!this._activeRoam || (this._scrollAttr.filter && !this._scrollAttr.filter(params, e))) {
      return false;
    }
    const { scrollX, scrollY } = params;
    let value = this._isHorizontal ? scrollX : scrollY;
    // 判断这次是否应该要滚动，最少
    const active = this._isHorizontal ? abs(scrollX / scrollY) >= 0.5 : abs(scrollY / scrollX) >= 0.5;
    if (!this._scrollAttr.reverse) {
      value = -value;
    }

    if (active) {
      const scrollStep = (this._spec as any).scrollStep;
      if (isValidNumber(scrollStep)) {
        const sign = value > 0 ? 1 : -1;
        const scrollStepPercent = (scrollStep * (this.getState().end - this.getState().start)) / 1;
        value = sign * scrollStepPercent;
      }
      this.handleChartMove(value, this._scrollAttr.rate ?? 1);
    }

    // 判断是否滚动到最顶部或最底部
    // 如果滚动到最顶部或最底部，则不应该stopBubble
    const hasChange = this.getState().start !== 0 && this.getState().end !== 1;

    return active && hasChange;
  };

  handleChartDrag = (delta: [number, number], e: BaseEventParams['event']) => {
    if (!this._activeRoam || (this._dragAttr.filter && !this._dragAttr.filter(delta, e))) {
      return;
    }
    const [dx, dy] = delta;
    let value = this._isHorizontal ? dx : dy;
    if (this._dragAttr.reverse) {
      value = -value;
    }
    this.handleChartMove(value, this._dragAttr.rate ?? 1);
  };

  handleChartMove = (value: number, rate: number) => {
    const totalValue = this._isHorizontal ? this.getLayoutRect().width : this.getLayoutRect().height;
    if (Math.abs(value) >= 1e-6) {
      if (value > 0 && this.getState().end < 1) {
        const moveDelta = Math.min(1 - this.getState().end, value / totalValue) * rate;
        this._handleChange(this.getState().start + moveDelta, this.getState().end + moveDelta, true);
      } else if (value < 0 && this.getState().start > 0) {
        const moveDelta = Math.max(-this.getState().start, value / totalValue) * rate;
        this._handleChange(this.getState().start + moveDelta, this.getState().end + moveDelta, true);
      }
    }
    return false;
  };
}

mixin(DataFilterEvent, Zoomable);
