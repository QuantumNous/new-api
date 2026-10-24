import { isEmpty, isFunction, isNil, isNumber, isValid } from '@visactor/vutils';
import type { IComponentOption } from '../../interface';
// eslint-disable-next-line no-duplicate-imports
import { ComponentTypeEnum } from '../../interface/type';
import { DataFilterBaseComponent } from '../data-filter-base-component';
import type { ScrollBarAttributes } from '@visactor/vrender-components';
// eslint-disable-next-line no-duplicate-imports
import { ScrollBar as ScrollBarComponent } from '@visactor/vrender-components';
import { transformToGraphic } from '../../../util/style';
import type { IRectGraphicAttribute, INode, IGroup, IGraphic } from '@visactor/vrender-core';
import { LayoutLevel, LayoutZIndex } from '../../../constant/layout';
import { ChartEvent } from '../../../constant/event';
import { SCROLL_BAR_DEFAULT_SIZE } from '../../../constant/scroll-bar';
import type { IScrollBarSpec } from './interface';
import { Factory } from '../../../core/factory';
import type { ILayoutType } from '../../../typings/layout';
import { isClose } from '../../../util';
import { scrollBar } from '../../../theme/builtin/common/component/scroll-bar';
import { isReverse, statePointToData } from '../util';
import type { CartesianAxis } from '../../axis/cartesian';
// import { SCROLLBAR_EVENT, SCROLLBAR_END_EVENT } from '@visactor/vrender-components/es/constant';

// 由vrender透出, 接入新版本后需修改
const SCROLLBAR_EVENT = 'scrollDrag';
const SCROLLBAR_END_EVENT = 'scrollUp';

const SCROLL_BAR_COMPONENT_ONLY_CHANGE_KEYS: Record<string, boolean> = {
  width: true,
  height: true,
  rail: true,
  slider: true,
  round: true,
  innerPadding: true,
  minSliderSize: true
};

export class ScrollBar<T extends IScrollBarSpec = IScrollBarSpec> extends DataFilterBaseComponent<T> {
  static type = ComponentTypeEnum.scrollBar;
  type = ComponentTypeEnum.scrollBar;
  name: string = ComponentTypeEnum.scrollBar;

  static readonly builtInTheme = {
    scrollBar
  };
  static specKey = 'scrollBar';
  specKey = 'scrollBar';

  layoutZIndex: number = LayoutZIndex.DataZoom;
  layoutLevel: number = LayoutLevel.DataZoom;
  layoutType: ILayoutType = 'region-relative';

  // scrollbar组件
  protected _component!: ScrollBarComponent;

  constructor(spec: T, options: IComponentOption) {
    super(spec as any, options);
    this._filterMode = spec.filterMode ?? 'axis';
  }

  /*** start: init event and event dispatch ***/
  protected _handleChange(start: number, end: number, updateComponent?: boolean) {
    super._handleChange(start, end, updateComponent);
    // filter out scroll event with same scroll value
    const isSameScrollValue = isClose(this._start, start) && isClose(this._end, end);
    // realTime为false时，start和end始终没有变化过, 但是需要触发change事件
    if (this._shouldChange && (!isSameScrollValue || this._spec.realTime === false)) {
      if (updateComponent && this._component) {
        this._component.setAttribute('range', [start, end]);
      }

      this._start = start;
      this._end = end;
      const axis = this._relatedAxisComponent as CartesianAxis<any>;
      const reverse = isReverse(axis, this._isHorizontal);
      const startValue = statePointToData(start, this._stateScale, reverse);
      const endValue = statePointToData(end, this._stateScale, reverse);
      const hasChange = isFunction(this._spec.updateDataAfterChange)
        ? this._spec.updateDataAfterChange(start, end, startValue, endValue)
        : this._handleStateChange(startValue, endValue);
      if (hasChange) {
        this.event.emit(ChartEvent.scrollBarChange, {
          model: this,
          value: {
            filterData: this._filterMode !== 'axis',
            start: this._start,
            end: this._end,
            startValue: this._startValue,
            endValue: this._endValue,
            newDomain: this._newDomain
          }
        });
      }
    }
  }

  protected _handleDataCollectionChange() {
    if (this._spec.auto) {
      const data = this._data.getDataView();
      data.reRunAllTransform();
    }
  }
  /*** end: init event and event dispatch ***/

  protected _getComponentOnlySpecKeys() {
    return SCROLL_BAR_COMPONENT_ONLY_CHANGE_KEYS;
  }

  /*** start: component lifecycle ***/

  protected _beforeLayoutEnd() {
    super._beforeLayoutEnd();
    this.effect.onZoomChange?.();
  }

  onLayoutEnd(): void {
    // 保证自己的宽高正确
    this._updateComponentBounds();
    super.onLayoutEnd();
  }
  /*** end: component lifecycle ***/

  /*** start: scale ***/
  protected _updateScaleRange() {
    // do nothing
  }

  protected _updateComponentBounds() {
    if (this._component) {
      this._component.setAttributes({
        x: this.getLayoutStartPoint().x,
        y: this.getLayoutStartPoint().y,
        width: this.getLayoutRect().width,
        height: this.getLayoutRect().height
      });
    }
  }

  /*** end: scale ***/

  /** start: component layout attr ***/
  protected _computeWidth(): number {
    if (this._visible === false) {
      return 0;
    }
    if (isNumber(this._spec.width)) {
      return this._spec.width;
    }

    if (this._isHorizontal) {
      return this.getLayoutRect().width;
    }
    // default value
    return SCROLL_BAR_DEFAULT_SIZE;
  }

  protected _computeHeight(): number {
    if (this._visible === false) {
      return 0;
    }
    if (isNumber(this._spec.height)) {
      return this._spec.height;
    }

    // default value
    if (!this._isHorizontal) {
      return this.getLayoutRect().height;
    }

    return SCROLL_BAR_DEFAULT_SIZE;
  }
  /** end: component layout attr ***/

  /** start: scrollbar component attr ***/
  private _getAttrs() {
    return {
      zIndex: this.layoutZIndex,
      x: this.getLayoutStartPoint().x,
      y: this.getLayoutStartPoint().y,
      width: this.getLayoutRect().width,
      height: this.getLayoutRect().height,
      range: [this._start, this._end],
      direction: this._isHorizontal ? 'horizontal' : 'vertical',
      delayType: this._spec?.delayType,
      delayTime: isValid(this._spec?.delayType) ? this._spec?.delayTime ?? 30 : 0,
      realTime: this._spec?.realTime ?? true,
      minSliderSize: this._spec?.minSliderSize,
      ...this._getComponentAttrs()
    } as ScrollBarAttributes;
  }

  protected _createOrUpdateComponent() {
    const attrs = this._getAttrs();
    if (this._component) {
      this._component.setAttributes(attrs);
    } else {
      const container = this.getContainer();
      this._component = new ScrollBarComponent(attrs);
      // 绑定事件，防抖，防止频繁触发
      this._component.addEventListener(SCROLLBAR_EVENT, (e: any) => {
        const value = e.detail.value;
        this._handleChange(value[0], value[1]);
      });
      this._component.addEventListener(SCROLLBAR_END_EVENT, (e: any) => {
        const value = e.detail.value;
        this._handleChange(value[0], value[1]);
      });
      container.add(this._component as unknown as INode);
    }
  }

  protected _getComponentAttrs() {
    const { rail, slider, innerPadding } = this._spec;
    const attrs: Partial<ScrollBarAttributes> = {};

    if (!isNil(innerPadding)) {
      attrs.padding = innerPadding;
    }

    if (!isEmpty(rail?.style)) {
      attrs.railStyle = transformToGraphic(rail.style) as unknown as IRectGraphicAttribute;
    }
    if (!isEmpty(slider?.style)) {
      attrs.sliderStyle = transformToGraphic(slider.style) as unknown as IRectGraphicAttribute;
    }
    attrs.disableTriggerEvent = this._option.disableTriggerEvent;
    return attrs;
  }
  /** end: scrollbar component attr ***/

  protected _getNeedClearVRenderComponents(): IGraphic[] {
    return [this._component] as unknown as IGroup[];
  }
}

export const registerScrollBar = () => {
  Factory.registerComponent(ScrollBar.type, ScrollBar);
};
