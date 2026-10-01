import {
  isFunction,
  isNil,
  isNumber,
  isValid,
  last,
  maxInArray,
  minInArray,
  uniqArray,
  type IBoundsLike
} from '@visactor/vutils';
import { mergeSpec } from '@visactor/vutils-extension';
import { ComponentTypeEnum, type IComponentOption } from '../../interface';
import { DataFilterBaseComponent } from '../data-filter-base-component';
import { DataZoom as DataZoomComponent, type DataZoomAttributes } from '@visactor/vrender-components';
import { transformToGraphic } from '../../../util/style';
import type { IRectGraphicAttribute, INode, ISymbolGraphicAttribute, IGroup, IGraphic } from '@visactor/vrender-core';
import type { Datum, ILayoutRect, ILayoutType } from '../../../typings';
import { LinearScale, isContinuous, isDiscrete, type ILinearScale, type IBaseScale } from '@visactor/vscale';
import { LayoutLevel, LayoutZIndex } from '../../../constant/layout';
import { ChartEvent } from '../../../constant/event';
import type { IDataZoomSpec } from './interface';
import { Factory } from '../../../core/factory';
import type { CartesianAxis } from '../../axis/cartesian';
import { DataZoomSpecTransformer } from './data-zoom-transformer';
import { getFormatFunction } from '../../util';
import { dataZoom } from '../../../theme/builtin/common/component/data-zoom';
import { isReverse, statePointToData } from '../util';
import { LayoutModel } from '../../../model/layout-model';

const DATA_ZOOM_COMPONENT_ONLY_CHANGE_KEYS: Record<string, boolean> = {
  width: true,
  height: true,
  showDetail: true,
  middleHandler: true,
  background: true,
  startHandler: true,
  endHandler: true,
  startText: true,
  endText: true,
  dragMask: true,
  selectedBackground: true,
  backgroundChart: true,
  selectedBackgroundChart: true,
  showBackgroundChart: true
};

export class DataZoom<T extends IDataZoomSpec = IDataZoomSpec> extends DataFilterBaseComponent<T> {
  static type = ComponentTypeEnum.dataZoom;
  static readonly transformerConstructor = DataZoomSpecTransformer as any;
  type = ComponentTypeEnum.dataZoom;
  name: string = ComponentTypeEnum.dataZoom;
  readonly transformerConstructor = DataZoomSpecTransformer;

  static readonly builtInTheme = {
    dataZoom
  };
  static specKey = 'dataZoom';
  specKey = 'dataZoom';

  layoutZIndex: number = LayoutZIndex.DataZoom;
  layoutLevel: number = LayoutLevel.DataZoom;
  layoutType: ILayoutType = 'region-relative';

  // datazoom组件
  protected _component!: DataZoomComponent;

  protected _valueScale!: ILinearScale;

  protected _backgroundSize!: number;
  protected _middleHandlerSize!: number;
  protected _startHandlerSize!: number;
  protected _endHandlerSize!: number;

  protected _isReverseCache: boolean = false;

  protected _cacheRect?: ILayoutRect;

  protected _previewStateScale: IBaseScale;

  constructor(spec: T, options: IComponentOption) {
    super(spec, options);

    this._valueField = 'y';
    this._filterMode = spec.filterMode ?? 'filter';
  }

  /*** start: init event and event dispatch ***/
  protected _handleChange(start: number, end: number, updateComponent?: boolean, tag?: string) {
    super._handleChange(start, end, updateComponent);

    if (this._shouldChange) {
      if (updateComponent && this._component) {
        this._component.setStartAndEnd(start, end);
      } else {
        const axis = this._relatedAxisComponent as CartesianAxis<any>;

        const startValue = statePointToData(start, this._stateScale, isReverse(axis, this._isHorizontal));
        const endValue = statePointToData(end, this._stateScale, isReverse(axis, this._isHorizontal));
        if (!isValid(startValue) || !isValid(endValue)) {
          return;
        }
        this._start = start;
        this._end = end;
        const hasChange = isFunction(this._spec.updateDataAfterChange)
          ? this._spec.updateDataAfterChange(start, end, startValue, endValue)
          : this._handleStateChange(startValue, endValue, tag);
        if (hasChange) {
          this.event.emit(ChartEvent.dataZoomChange, {
            model: this,
            value: {
              filterData: this._filterMode !== 'axis',
              start,
              end,
              startValue: this._startValue,
              endValue: this._endValue,
              newDomain: this._newDomain
            }
          });
        }
      }
    }
  }

  protected _handleDataCollectionChange() {
    const data = this._data.getDataView();
    data.reRunAllTransform();
    // 数据更新后，重新计算scale的domain和range，保证datazoom组件的预览图和数据保持一致
    this._initAfterLayout();

    const domain = this._computeDomainOfValueScale();

    if (domain) {
      if (!this._valueScale) {
        this._valueScale = new LinearScale();
      }
      this._valueScale.domain(domain);
      this._updateValueScaleRange();

      if (this._component) {
        this._createOrUpdateComponent(true);
      }
    }
  }
  /*** end: init event and event dispatch ***/

  /*** start: component lifecycle ***/
  created() {
    super.created();
    this._initValueScale();
  }

  updateLayoutAttribute(): void {
    if (this._cacheVisibility !== false) {
      super.updateLayoutAttribute();
    }
  }

  protected _beforeLayoutEnd() {
    super._beforeLayoutEnd();
    const axis = this._relatedAxisComponent as CartesianAxis<any>;
    // 初始时reverse判断并不准确，导致start和end颠倒, 保险起见在layoutend之后触发该逻辑
    // FIXME: 牺牲了一定性能，有待优化
    if ((isReverse(axis, this._isHorizontal) && !this._isReverseCache) || this._auto) {
      // auto则代表需要根据bandsize同步更新范围
      this._isReverseCache = isReverse(axis, this._isHorizontal);
      this.effect.onZoomChange();
    }
  }

  protected _getComponentOnlySpecKeys() {
    return DATA_ZOOM_COMPONENT_ONLY_CHANGE_KEYS;
  }

  clear(): void {
    if (this._component) {
      const container = this.getContainer();
      this._component.removeAllChild();
      if (container) {
        container.removeChild(this._component as unknown as INode);
      }

      this._component = null;
    }
    super.clear();
  }

  getBoundsInRect(rect: ILayoutRect): IBoundsLike {
    const result: IBoundsLike = { x1: this.getLayoutStartPoint().x, y1: this.getLayoutStartPoint().y, x2: 0, y2: 0 };
    const startHandlerScaleXSize = this._startHandlerSize * (this._spec.startHandler.style.scaleX ?? 1);
    const startHandlerScaleYSize = this._startHandlerSize * (this._spec.startHandler.style.scaleY ?? 1);
    const endHandlerScaleXSize = this._endHandlerSize * (this._spec.endHandler.style.scaleX ?? 1);
    const endHandlerScaleYSize = this._endHandlerSize * (this._spec.endHandler.style.scaleY ?? 1);
    const extendWidth = !this._visible
      ? 0
      : this._isHorizontal
        ? (startHandlerScaleXSize - this._startHandlerSize) / 2 + (endHandlerScaleXSize - this._endHandlerSize) / 2
        : (Math.max(startHandlerScaleXSize, endHandlerScaleXSize) - this._width) / 2;
    const extendHeight = !this._visible
      ? 0
      : this._isHorizontal
        ? (Math.max(startHandlerScaleYSize, endHandlerScaleYSize) - this._height) / 2
        : (startHandlerScaleYSize - this._startHandlerSize) / 2 + (endHandlerScaleYSize - this._endHandlerSize) / 2;
    if (this._isHorizontal) {
      result.y2 = result.y1 + this._height + extendHeight;
      result.x2 = result.x1 + rect.width + extendWidth;
    } else {
      result.x2 = result.x1 + this._width + extendWidth;
      result.y2 = result.y1 + rect.height + extendHeight;
    }
    return result;
  }
  /*** end: component lifecycle ***/

  /*** start: set attributes & bind related axis and region ***/
  setAttrFromSpec() {
    super.setAttrFromSpec();

    // 用户配置, 如:80  -> 给各个部分赋予默认值 back 80, handler 80 -> 根据实际值computeSize -> 作为组件属性输入 -> 组件根据实际高度给背景分配默认高度
    // 用户不配置 -> 各部分给默认定值 -> ...(同上)
    const componentSize = this._isHorizontal ? Number(this._spec.height) : Number(this._spec.width);

    // size相关
    this._backgroundSize = this._spec.background?.size ?? 30;
    this._middleHandlerSize = this._computeMiddleHandlerSize();
    // startHandler和endHandler size如果没有配置，则默认跟随background宽 or 高
    if (isNil(this._spec?.startHandler?.style?.size)) {
      this._spec.startHandler.style.size = isNaN(componentSize)
        ? this._backgroundSize
        : componentSize - this._middleHandlerSize;
    }
    if (isNil(this._spec?.endHandler?.style?.size)) {
      this._spec.endHandler.style.size = isNaN(componentSize)
        ? this._backgroundSize
        : componentSize - this._middleHandlerSize;
    }
    const startHandlerVisible = this._spec.startHandler.style.visible ?? true;
    const endHandlerVisible = this._spec.endHandler.style.visible ?? true;
    this._startHandlerSize = startHandlerVisible ? this._spec.startHandler.style.size : 0;
    this._endHandlerSize = endHandlerVisible ? this._spec.endHandler.style.size : 0;
    this._width = this._computeWidth();
    this._height = this._computeHeight();
  }
  /*** end: set attributes & bind related axis and region ***/

  /*** start: scale of background chart ***/
  protected _initValueScale() {
    const domain = this._computeDomainOfValueScale();

    if (domain) {
      const valueScale = new LinearScale();
      valueScale.domain(domain);
      this._valueScale = valueScale;
    }
  }

  protected _updateScaleRange() {
    this._updateStateScaleRange();
    this._updateValueScaleRange();
  }

  protected _updateStateScaleRange() {
    const handlerSize = this._startHandlerSize + this._endHandlerSize;
    if (!this._stateScale) {
      return;
    }

    // visible为false时, 计算stateScale的兜底range
    let stateScaleRange;
    const defaultSize = this._isHorizontal
      ? this.getLayoutRect().width - handlerSize
      : this.getLayoutRect().height - handlerSize;

    const defaultRange = (this._relatedAxisComponent as CartesianAxis<any>)?.getScale().range() ?? [
      this._startHandlerSize / 2,
      defaultSize + this._startHandlerSize / 2
    ];

    const compWidth = this._computeWidth();
    const compHeight = this._computeHeight();

    if (this._isHorizontal) {
      stateScaleRange = this._visible
        ? [this._startHandlerSize / 2, compWidth - handlerSize + this._startHandlerSize / 2]
        : defaultRange;
    } else {
      stateScaleRange = this._visible
        ? [this._startHandlerSize / 2, compHeight - handlerSize + this._startHandlerSize / 2]
        : defaultRange;
    }
    this._stateScale.range(stateScaleRange);
    this._previewStateScale?.range(
      isReverse(this._relatedAxisComponent as CartesianAxis<any>, this._isHorizontal)
        ? stateScaleRange.reverse()
        : stateScaleRange
    );
  }

  protected _updateValueScaleRange() {
    if (!this._valueScale) {
      return;
    }
    const compWidth = this._computeWidth();
    const compHeight = this._computeHeight();

    if (this._isHorizontal) {
      this._valueScale.range([compHeight - this._middleHandlerSize, 0]);
    } else {
      if (this.layoutOrient === 'left') {
        this._valueScale.range([compWidth - this._middleHandlerSize, 0]);
      } else {
        this._valueScale.range([0, compWidth - this._middleHandlerSize]);
      }
    }
  }

  protected _computeDomainOfValueScale() {
    const domain = this._data.getLatestData().map((d: any) => d[this._valueField]);

    const domainNum = domain.map((n: any) => n * 1);
    return domain.length ? [minInArray(domainNum), maxInArray(domainNum)] : null;
  }

  protected _isScaleValid(scale: IBaseScale | ILinearScale) {
    if (!scale || !scale.domain()) {
      return false;
    }
    const domain = scale.domain();
    if (isContinuous(scale.type) && domain[0] === last(domain)) {
      return false;
    }
    if (isDiscrete(scale.type) && uniqArray(domain).length === 1) {
      return false;
    }
    return true;
  }

  protected _getXScale() {
    const bindScale = (this._relatedAxisComponent as CartesianAxis<any>).getScale();
    if (bindScale.type === this.stateScale.type && this._isHorizontal) {
      return this.stateScale;
    }
    return this._isHorizontal ? this._stateScale : this._valueScale;
  }

  protected _getYScale() {
    return this._isHorizontal ? this._valueScale : this._stateScale;
  }

  protected _dataToPositionX = (datum: Datum): number => {
    const offsetLeft = !this._isHorizontal ? this._middleHandlerSize : 0;
    const offsetHandler = this._isHorizontal ? this._startHandlerSize / 2 : 0;
    const xScale = this._isHorizontal ? this._stateScale : this._valueScale;
    const xField = this._isHorizontal ? this._stateField : this._valueField;
    return xScale.scale(datum[xField]) + this.getLayoutStartPoint().x + offsetLeft + offsetHandler;
  };

  protected _dataToPositionX2 = (datum: Datum): number => {
    const offsetLeft = !this._isHorizontal ? this._middleHandlerSize : 0;
    const offsetHandler = this._isHorizontal ? this._startHandlerSize / 2 : 0;
    const xScale = this._isHorizontal ? this._stateScale : this._valueScale;
    const min = xScale.domain()[0];
    return xScale.scale(min) + this.getLayoutStartPoint().x + offsetLeft + offsetHandler;
  };

  protected _dataToPositionY = (datum: Datum): number => {
    const offsetTop = this._isHorizontal ? this._middleHandlerSize : 0;
    const offsetHandler = this._isHorizontal ? 0 : this._startHandlerSize / 2;
    const yScale = this._isHorizontal ? this._valueScale : this._getPreviewStateScale();
    const yField = this._isHorizontal ? this._valueField : this._stateField;
    return yScale.scale(datum[yField]) + this.getLayoutStartPoint().y + offsetTop + offsetHandler;
  };

  protected _dataToPositionY2 = (datum: Datum): number => {
    const offsetTop = this._isHorizontal ? this._middleHandlerSize : 0;
    const offsetHandler = this._isHorizontal ? 0 : this._startHandlerSize / 2;
    const yScale = this._isHorizontal ? this._valueScale : this._getPreviewStateScale();
    const min = yScale.domain()[0];
    return yScale.scale(min) + this.getLayoutStartPoint().y + offsetTop + offsetHandler;
  };
  /*** end: scale of background chart ***/

  /** start: component layout attr ***/
  protected _computeMiddleHandlerSize(): number {
    let size = 0;
    if (this._spec?.middleHandler?.visible) {
      const middleHandlerIconSize = this._spec.middleHandler.icon.style.size ?? 8;
      const middleHandlerBackSize = this._spec.middleHandler.background.size ?? 40;
      size += Math.max(middleHandlerIconSize as number, middleHandlerBackSize);
    }
    return size;
  }

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

    return (
      Math.max(this._startHandlerSize || 0, this._endHandlerSize || 0, this._backgroundSize || 0) +
      this._middleHandlerSize
    );
  }

  protected _computeHeight(): number {
    if (this._visible === false) {
      return 0;
    }

    if (isNumber(this._spec.height)) {
      return this._spec.height;
    }

    if (this._isHorizontal) {
      return (
        Math.max(this._startHandlerSize || 0, this._endHandlerSize || 0, this._backgroundSize || 0) +
        this._middleHandlerSize
      );
    }
    return this.getLayoutRect().height;
  }
  /** end: component layout attr ***/

  /** start: datazoom component attr ***/
  private _getAttrs(isNeedPreview: boolean) {
    const spec = this._spec ?? ({} as T);
    return {
      zIndex: this.layoutZIndex,
      start: this._start,
      end: this._end,
      position: {
        x: this.getLayoutStartPoint().x,
        y: this.getLayoutStartPoint().y
      },
      orient: this._orient,
      size: {
        width: this._computeWidth(),
        height: this._computeHeight()
      },
      showDetail: spec.showDetail,
      brushSelect: spec.brushSelect ?? false,
      zoomLock: spec.zoomLock ?? false,
      minSpan: this._minSpan,
      maxSpan: this._maxSpan,
      delayType: spec.delayType,
      delayTime: isValid(spec.delayType) ? (spec.delayTime ?? 30) : 0,
      realTime: spec.realTime ?? true,
      previewData: isNeedPreview && this._data.getLatestData(),
      previewPointsX: isNeedPreview && this._dataToPositionX,
      previewPointsY: isNeedPreview && this._dataToPositionY,
      tolerance: this._spec.tolerance,
      isReverse: isReverse(this._relatedAxisComponent as CartesianAxis<any>, this._isHorizontal),
      ...(this._getComponentAttrs(isNeedPreview) as any)
    } as DataZoomAttributes;
  }

  private _getLayoutAttrs() {
    return {
      position: {
        x: this.getLayoutStartPoint().x,
        y: this.getLayoutStartPoint().y
      },
      size: {
        width: this._computeWidth(),
        height: this._computeHeight()
      }
    };
  }

  protected _createOrUpdateComponent(changeData?: boolean) {
    if (this._visible) {
      const isNeedPreview = this._spec.showBackgroundChart !== false;
      const attrs = this._getAttrs(isNeedPreview);

      const axis = this._relatedAxisComponent as CartesianAxis<any>;

      if (this._component) {
        this._component.setAttributes(attrs);
        if (changeData) {
          this._component.setPreviewData(this._data.getDataView().latestData);
          if (isNeedPreview) {
            if (this._isHorizontal) {
              this._component.setPreviewPointsY1(this._dataToPositionY2);
            } else {
              this._component.setPreviewPointsX1(this._dataToPositionX2);
            }
            this._component.setStatePointToData((state: number) =>
              statePointToData(state, this._stateScale, isReverse(axis, this._isHorizontal))
            );
          }
        }
      } else {
        const container = this.getContainer();
        this._component = new DataZoomComponent(attrs);
        this._component.setPreviewData(this._data.getDataView().latestData);

        if (this._isHorizontal) {
          isNeedPreview && this._component.setPreviewPointsY1(this._dataToPositionY2);
        } else {
          isNeedPreview && this._component.setPreviewPointsX1(this._dataToPositionX2);
        }
        this._component.setStatePointToData((state: number) =>
          statePointToData(state, this._stateScale, isReverse(axis, this._isHorizontal))
        );

        this._component.addEventListener('dataZoomChange', (e: any) => {
          const { start, end, tag } = e.detail;
          this._handleChange(start, end, undefined, tag);
        });
        container.add(this._component as unknown as INode);
      }
    }
  }

  protected _getComponentAttrs(isNeedPreview: boolean) {
    const {
      middleHandler = {},
      startText = {},
      endText = {},
      backgroundChart = {},
      selectedBackgroundChart = {}
    } = this._spec as T;
    return {
      backgroundStyle: transformToGraphic(this._spec.background?.style) as unknown as IRectGraphicAttribute,
      startHandlerStyle: transformToGraphic(this._spec.startHandler?.style) as unknown as ISymbolGraphicAttribute,
      middleHandlerStyle: middleHandler.visible
        ? {
            visible: true,
            icon: transformToGraphic(middleHandler.icon?.style) as unknown as ISymbolGraphicAttribute,
            background: {
              size: middleHandler.background?.size,
              style: transformToGraphic(middleHandler.background?.style)
            } as any
          }
        : { visible: false },
      endHandlerStyle: transformToGraphic(this._spec.endHandler?.style) as unknown as ISymbolGraphicAttribute,
      startTextStyle: {
        padding: startText.padding,
        formatMethod: this._getHandlerTextFormatMethod(startText),
        textStyle: transformToGraphic(startText.style)
      } as unknown,
      endTextStyle: {
        padding: endText.padding,
        formatMethod: this._getHandlerTextFormatMethod(endText),
        textStyle: transformToGraphic(endText.style)
      } as unknown,
      selectedBackgroundStyle: transformToGraphic(
        this._spec.selectedBackground.style
      ) as unknown as IRectGraphicAttribute,
      dragMaskStyle: transformToGraphic(this._spec.dragMask?.style) as unknown as IRectGraphicAttribute,
      backgroundChartStyle: isNeedPreview
        ? {
            line: mergeSpec(transformToGraphic(backgroundChart.line?.style), { fill: false }),
            area: {
              curveType: 'basis',
              visible: true,
              ...transformToGraphic(backgroundChart.area?.style)
            }
          }
        : {
            line: { visible: false },
            area: { visible: false }
          },
      selectedBackgroundChartStyle: isNeedPreview
        ? {
            line: mergeSpec(transformToGraphic(selectedBackgroundChart.line?.style), { fill: false }),
            area: {
              curveType: 'basis',
              visible: true,
              ...transformToGraphic(selectedBackgroundChart.area?.style)
            }
          }
        : {
            line: { visible: false },
            area: { visible: false }
          },
      disableTriggerEvent: this._option.disableTriggerEvent
    };
  }

  protected _getHandlerTextFormatMethod(spec: IDataZoomSpec['startText']) {
    const { formatMethod, formatter } = spec;
    const { formatFunc } = getFormatFunction(formatMethod, formatter);
    return formatFunc ? (text: any) => formatFunc(text, { label: text }, formatter) : undefined;
  }
  /** end: datazoom component attr ***/

  protected _getNeedClearVRenderComponents(): IGraphic[] {
    return [this._component] as unknown as IGroup[];
  }

  onDataUpdate() {
    super.onDataUpdate();
    // 预览scale
    if (this._previewStateScale !== this._stateScale) {
      this._previewStateScale = null;
    }
  }

  protected _getPreviewStateScale() {
    if (!this._previewStateScale) {
      // 当轴inverse时，需要反转预览scale
      if (isReverse(this._relatedAxisComponent as CartesianAxis<any>, this._isHorizontal)) {
        this._previewStateScale = this._stateScale.clone();
        this._previewStateScale.range(this._stateScale.range().reverse());
      } else {
        this._previewStateScale = this._stateScale;
      }
    }
    return this._previewStateScale;
  }
}

export const registerDataZoom = () => {
  Factory.registerComponent(DataZoom.type, DataZoom);
};
