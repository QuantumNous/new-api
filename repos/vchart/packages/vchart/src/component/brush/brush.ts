import { ChartEvent } from '../../constant/event';
import { AttributeLevel } from '../../constant/attribute';
import { LayoutZIndex } from '../../constant/layout';
import { BaseComponent } from '../base/base-component';
// eslint-disable-next-line no-duplicate-imports
import { ComponentTypeEnum } from '../interface/type';
import { Brush as BrushComponent, IOperateType as BrushEvent } from '@visactor/vrender-components';
import type { IBounds, IPointLike, Maybe } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import { array, polygonIntersectPolygon, isValid, last } from '@visactor/vutils';
import type { IModelSpecInfo } from '../../model/interface';
import type { IRegion } from '../../region/interface';
import type { IGraphic, IGroup, INode, IPolygon } from '@visactor/vrender-core';
import { transformToGraphic } from '../../util/style';
import type { ISeries } from '../../series/interface';
import type { IMark, IMarkGraphic } from '../../mark/interface';
import type { BrushInteractiveRangeAttr, IBrush, IBrushSpec, selectedItemStyle } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { isEqual } from '@visactor/vutils';
import { Factory } from '../../core/factory';
import type { DataZoom } from '../data-zoom';
import type { AxisComponent } from '../axis/base-axis';
import { getSpecInfo } from '../util';
import { brush } from '../../theme/builtin/common/component/brush';
import { isReverse, statePointToData } from '../data-zoom/util';
import type { CartesianAxis } from '../axis/cartesian';
import type { IRenderOption } from '../../compile/interface';
import { addGraphicState, removeGraphicState, setGraphicStates } from '../../util/graphic-state';

const IN_BRUSH_STATE = 'inBrush';
const OUT_BRUSH_STATE = 'outOfBrush';
const BRUSH_COMPONENT_ONLY_CHANGE_KEYS: Record<string, boolean> = {
  style: true,
  inBrush: true,
  outOfBrush: true
};

export class Brush<T extends IBrushSpec = IBrushSpec> extends BaseComponent<T> implements IBrush {
  layoutType: 'none' = 'none';
  static type = ComponentTypeEnum.brush;
  type = ComponentTypeEnum.brush;
  name: string = ComponentTypeEnum.brush;

  static readonly builtInTheme = {
    brush
  };
  static specKey = 'brush';
  specKey = 'brush';

  layoutZIndex: number = LayoutZIndex.Brush;

  // brush组件
  protected _brushComponents!: BrushComponent[];
  protected _relativeRegions!: IRegion[];
  protected _linkedSeries: ISeries[] = [];

  protected _operateMask: IPolygon;

  private _itemMap: { [regionId: string | number]: IMark[] } = {};
  private _linkedItemMap: { [seriesId: string | number]: IMark[] } = {};

  // 用brushName做分组管理的原因是: 如果有多个brush, 某个图元A brush内, 但在B brush外, 该图元state会被B误变成out of brush。 但其实该图元只有在A brush外才能被判断out of brush
  // 用dict做存储因为方便查找和删减对应图元
  protected _inBrushElementsMap: { [brushName: string]: { [elementKey: string]: IMarkGraphic } } = {};
  protected _outOfBrushElementsMap: { [elementKey: string]: IMarkGraphic } = {};
  protected _linkedInBrushElementsMap: { [brushName: string]: { [elementKey: string]: IMarkGraphic } } = {};
  protected _linkedOutOfBrushElementsMap: { [elementKey: string]: IMarkGraphic } = {};

  private _cacheInteractiveRangeAttrs: BrushInteractiveRangeAttr[] = [];

  private _releatedAxes: AxisComponent[] = [];

  // 根据region找axis
  private _regionAxisMap: { [regionId: string]: AxisComponent[] } = {};
  // 根据axis找dataZoom
  private _axisDataZoomMap: { [axisId: string]: DataZoom } = {};
  // 记录当前操作的axis或dataZoom的状态
  private _zoomRecord: {
    operateComponent: AxisComponent | DataZoom;
    start: number;
    end: number;
    startValue: number | string;
    endValue: number | string;
  }[] = [];

  static getSpecInfo(chartSpec: any): Maybe<IModelSpecInfo[]> {
    return getSpecInfo<IBrushSpec>(chartSpec, this.specKey, this.type, (s: IBrushSpec) => {
      return s.visible !== false;
    });
  }

  /*** start: abstract pipe ***/
  init() {
    const inBrushMarkAttr = this._transformBrushedMarkAttr(this._spec.inBrush);
    const outOfBrushMarkAttr = this._transformBrushedMarkAttr(this._spec.outOfBrush);
    // 注册mark state, 便于后续state管理
    this._option.getAllSeries().forEach((s: ISeries) => {
      s.getActiveMarks().forEach((m: IMark) => {
        if (m) {
          s.setMarkStyle(
            m,
            {
              ...inBrushMarkAttr
            },
            IN_BRUSH_STATE,
            AttributeLevel.Series
          );
          s.setMarkStyle(
            m,
            {
              ...outOfBrushMarkAttr
            },
            OUT_BRUSH_STATE,
            AttributeLevel.Series
          );
        }
      });
    });
  }

  reInit(spec?: T) {
    super.reInit(spec);
    this.init();
  }

  private _initNeedOperatedItem() {
    const seriesUserId = this._spec.seriesId;
    const seriesIndex = this._spec.seriesIndex;
    this._relativeRegions.forEach(r => {
      const allMarks: IMark[] = [];
      r.getSeries().forEach((s: ISeries) => {
        if (
          (seriesUserId && array(seriesUserId).includes(s.userId.toString())) ||
          (seriesIndex && array(seriesIndex).includes(s.getSpecIndex())) ||
          (!seriesIndex && !seriesUserId)
        ) {
          allMarks.push(...s.getMarksWithoutRoot());
        }
        this._itemMap[r.id] = allMarks;
      });
    });

    this._linkedSeries.forEach(s => {
      this._linkedItemMap[s.id] = s.getMarksWithoutRoot();
    });
  }

  created() {
    super.created();

    this.initEvent();
    this._bindRegions();
    this._bindLinkedSeries();
    this._initRegionAxisMap();
    this._initAxisDataZoomMap();
    this._initNeedOperatedItem();
  }

  protected _bindRegions() {
    if (!isValid(this._spec.regionId) && !isValid(this._spec.regionIndex)) {
      this._relativeRegions = this._option.getAllRegions();
    } else {
      this._relativeRegions = this._option.getRegionsInUserIdOrIndex(
        array(this._spec.regionId),
        array(this._spec.regionIndex)
      );
    }
  }

  protected _bindLinkedSeries() {
    if (!isValid(this._spec.brushLinkSeriesId) && !isValid(this._spec.brushLinkSeriesIndex)) {
      return;
    }
    this._linkedSeries = this._option.getSeriesInUserIdOrIndex(
      array(this._spec.brushLinkSeriesId),
      array(this._spec.brushLinkSeriesIndex)
    );
  }

  private _initRegionAxisMap() {
    // 如果配置了axis，则按配置
    // 如果没有配置axis，则默认所有axis
    if (isValid(this._spec.axisId)) {
      array(this._spec.axisId).forEach((axisId: string) => {
        this._releatedAxes.push(this._option.getComponentByUserId(axisId) as AxisComponent);
      });
    } else if (isValid(this._spec.axisIndex)) {
      array(this._spec.axisIndex).forEach((axisIndex: number) => {
        this._releatedAxes.push(this._option.getComponentByIndex('axes', axisIndex) as AxisComponent);
      });
    } else {
      this._releatedAxes = this._option.getComponentsByKey('axes') as AxisComponent[];
    }

    // 按照region进行分组，便于brush找到关联axis (brush -> region -> axis)
    this._releatedAxes.forEach((axis: AxisComponent) => {
      axis?.getRegions().forEach((region: IRegion) => {
        if (this._regionAxisMap['region_' + region.id]) {
          this._regionAxisMap['region_' + region.id].push(axis);
        } else {
          this._regionAxisMap['region_' + region.id] = [axis];
        }
      });
    });
  }

  private _initAxisDataZoomMap() {
    (this._option.getComponentsByKey('dataZoom') as DataZoom[]).forEach((dz: DataZoom) => {
      if (dz.relatedAxisComponent) {
        this._axisDataZoomMap[(dz.relatedAxisComponent as AxisComponent).id] = dz;
      }
    });
  }

  protected initEvent() {
    // do nothing
  }

  _compareSpec(spec: T, prevSpec: T) {
    if (this._brushComponents) {
      // FIXME: 这个逻辑放在这个方法里不太妥当？
      this._relativeRegions.forEach((region: IRegion, index: number) => {
        this._updateBrushComponent(region, index);
      });
    }
    const result = super._compareSpec(spec, prevSpec);
    if (!isEqual(prevSpec, spec)) {
      result.change = true;
      result.reRender = true;
      if (!result.reMake && !result.reCompile && this._isComponentOnlySpecChange(spec, prevSpec)) {
        result.effects = {
          ...result.effects,
          component: true,
          layout: true,
          render: true
        };
      } else {
        result.reMake = true;
      }
    }
    return result;
  }

  protected _isComponentOnlySpecChange(spec: T, prevSpec: T) {
    const keys = Object.keys({
      ...prevSpec,
      ...spec
    });

    return keys.every(key => {
      return isEqual(prevSpec?.[key], spec?.[key]) || BRUSH_COMPONENT_ONLY_CHANGE_KEYS[key];
    });
  }

  onLayoutEnd(): void {
    super.onLayoutEnd();
    if (this._option.disableTriggerEvent) {
      return;
    }
    const brushVisible = this._spec.visible ?? true;
    if (brushVisible) {
      if (!this._brushComponents) {
        this._brushComponents = [];
        this._relativeRegions.forEach((region: IRegion, index: number) => {
          this._createBrushComponent(region, index);
        });
      } else {
        this._relativeRegions.forEach((region: IRegion, index: number) => {
          this._updateBrushComponent(region, index);
        });
      }
    }
  }
  /*** end: abstract pipe ***/

  /*** start: brush component ***/
  protected _updateBrushComponent(region: IRegion, componentIndex: number) {
    const interactiveAttr = this._getBrushInteractiveAttr(region);
    // 布局变化后, 更新可交互范围
    const brushComponent = this._brushComponents[componentIndex];
    brushComponent.setAttributes({
      brushStyle: transformToGraphic(this._spec?.style),
      ...interactiveAttr
    } as any);

    // 布局变化后，清空brushMask 和 重置图元高亮状态
    this._initMarkBrushState(componentIndex, '');
    brushComponent.children[0].removeAllChild();
  }

  protected _shouldEnableInteractive() {
    return (this.getOption().getCompiler().getOption() as IRenderOption).interactive !== false;
  }

  protected _createBrushComponent(region: IRegion, componentIndex: number) {
    const interactiveAttr = this._getBrushInteractiveAttr(region);
    const brush = new BrushComponent({
      zIndex: this.layoutZIndex,
      brushStyle: transformToGraphic(this._spec?.style),
      ...interactiveAttr,
      ...this._spec,
      disableTriggerEvent: this._option.disableTriggerEvent
    });
    brush.id = this._spec.id ?? `brush-${this.id}`;
    this.getContainer().add(brush as unknown as INode);
    this._brushComponents.push(brush);
    this._cacheInteractiveRangeAttrs.push(interactiveAttr);

    brush.addEventListener(BrushEvent.brushActive, (e: any) => {
      this._initMarkBrushState(componentIndex, OUT_BRUSH_STATE);
      this._emitEvent(ChartEvent.brushActive, region, e);
    });

    brush.addEventListener(BrushEvent.drawStart, (e: any) => {
      if (this._spec.disableDimensionHoverWhenBrushing) {
        this._option.globalInstance.disableDimensionHoverEvent(true);
      }
      this._setRegionMarkPickable(region, true);
      this._emitEvent(ChartEvent.brushStart, region, e);
    });

    brush.addEventListener(BrushEvent.moveStart, (e: any) => {
      if (this._spec.disableDimensionHoverWhenBrushing) {
        this._option.globalInstance.disableDimensionHoverEvent(true);
      }
      this._setRegionMarkPickable(region, true);
      this._emitEvent(ChartEvent.brushStart, region, e);
    });

    brush.addEventListener(BrushEvent.drawing, (e: any) => {
      this._setRegionMarkPickable(region, false);
      this._handleBrushChange(region, e);
      this._emitEvent(ChartEvent.brushChange, region, e);
    });

    brush.addEventListener(BrushEvent.moving, (e: any) => {
      this._setRegionMarkPickable(region, false);
      this._handleBrushChange(region, e);
      this._emitEvent(ChartEvent.brushChange, region, e);
    });

    brush.addEventListener(BrushEvent.brushClear, (e: any) => {
      if (this._spec.disableDimensionHoverWhenBrushing) {
        this._option.globalInstance.disableDimensionHoverEvent(false);
      }
      this._setRegionMarkPickable(region, true);
      this._initMarkBrushState(componentIndex, '');
      this._emitEvent(ChartEvent.brushClear, region, e);
    });

    brush.addEventListener(BrushEvent.drawEnd, (e: any) => {
      if (this._spec.disableDimensionHoverWhenBrushing) {
        this._option.globalInstance.disableDimensionHoverEvent(false);
      }
      this._setRegionMarkPickable(region, true);
      const { operateMask } = e.detail as any;
      const { updateElementsState = true } = this._spec;
      if (updateElementsState) {
        this._handleBrushChange(region, e);
      }
      if (this._spec?.onBrushEnd) {
        // 如果onBrushEnd返回true，则清空brush， 并抛出clear事件
        if (this._spec.onBrushEnd(e) === true) {
          this.clearGraphic();
          this._initMarkBrushState(componentIndex, '');
          this._emitEvent(ChartEvent.brushClear, region, e);
        } else {
          this._spec.onBrushEnd(e);
          this._emitEvent(ChartEvent.brushEnd, region, e);
        }
      } else {
        const inBrushData = this._extendDataInBrush(this._inBrushElementsMap);
        if ((!this._spec.zoomWhenEmpty && inBrushData.length > 0) || !updateElementsState) {
          this._setAxisAndDataZoom(operateMask, region);
        }
        this._emitEvent(ChartEvent.brushEnd, region, e);
      }
    });

    brush.addEventListener(BrushEvent.moveEnd, (e: any) => {
      if (this._spec.disableDimensionHoverWhenBrushing) {
        this._option.globalInstance.disableDimensionHoverEvent(false);
      }
      this._setRegionMarkPickable(region, true);
      const { operateMask } = e.detail as any;
      const { updateElementsState = true } = this._spec;
      if (updateElementsState) {
        this._handleBrushChange(region, e);
      }
      const inBrushData = this._extendDataInBrush(this._inBrushElementsMap);
      if ((!this._spec.zoomWhenEmpty && inBrushData.length > 0) || updateElementsState) {
        this._setAxisAndDataZoom(operateMask, region);
      }
      this._emitEvent(ChartEvent.brushEnd, region, e);
    });
  }

  protected _getBrushInteractiveAttr(region: IRegion) {
    const regionLayoutPosition = region.getLayoutStartPoint();
    const regionLayoutRect = region.getLayoutRect();
    const seriesRegionStartX = regionLayoutPosition.x;
    const seriesRegionEndX = seriesRegionStartX + regionLayoutRect.width;
    const seriesRegionStartY = regionLayoutPosition.y;
    const seriesRegionEndY = seriesRegionStartY + regionLayoutRect.height;
    return {
      interactiveRange: {
        minY: seriesRegionStartY,
        maxY: seriesRegionEndY,
        minX: seriesRegionStartX,
        maxX: seriesRegionEndX
      },
      xRange: [seriesRegionStartX, seriesRegionEndX],
      yRange: [seriesRegionStartY, seriesRegionEndY],
      interactive: this._shouldEnableInteractive()
    } as BrushInteractiveRangeAttr;
  }

  private _transformBrushedMarkAttr(brushedStyle: selectedItemStyle) {
    const styleResult: any = {};
    if (brushedStyle?.symbol) {
      styleResult.symbolType = brushedStyle.symbol;
    }
    if (brushedStyle?.symbolSize) {
      styleResult.size = brushedStyle.symbolSize;
    }
    if (brushedStyle?.color) {
      styleResult.fill = brushedStyle.color;
    }
    if (brushedStyle?.colorAlpha) {
      styleResult.fillOpacity = brushedStyle.colorAlpha;
    }
    return {
      ...transformToGraphic(brushedStyle),
      ...styleResult
    };
  }
  /*** end: brush component ***/

  /*** start: event dispatch ***/
  private _handleBrushChange(region: IRegion, e: any) {
    const { operateMask } = e.detail as any;
    this._operateMask = operateMask;
    const { updateElementsState = true } = this._spec;
    if (updateElementsState) {
      this._reconfigItem(operateMask, region);
      this._reconfigLinkedItem(operateMask, region);
    }
  }

  protected _extendDataInBrush(elementsMap: { [brushName: string]: { [elementKey: string]: IMarkGraphic } }) {
    const data = [];
    for (const brushName in elementsMap) {
      for (const elementKey in elementsMap[brushName]) {
        data.push({
          ...elementsMap[brushName][elementKey].context?.data?.[0]
        });
      }
    }
    return data;
  }

  protected _extendDatumOutOfBrush(elementsMap: { [elementKey: string]: IMarkGraphic }) {
    const data = [];
    for (const elementKey in elementsMap) {
      // 图例筛选后, elementKey未更新, 导致data可能为null
      // FIXME: brush透出的map维护逻辑有待优化
      data.push(elementsMap[elementKey].context?.data?.[0]);
    }
    return data;
  }

  private _emitEvent(eventType: string, region: IRegion, e: any) {
    this.event.emit(eventType, {
      model: this,
      value: {
        // 操作类型
        operateType: eventType,
        // 正在操作的region
        operateRegion: region,
        // 在选框内的 element data
        inBrushData: this._extendDataInBrush(this._inBrushElementsMap),
        // 在选框外的 element data
        outOfBrushData: this._extendDatumOutOfBrush(this._outOfBrushElementsMap),
        // 被链接的系列中：在选框内的 element data
        linkInBrushData: this._extendDataInBrush(this._linkedInBrushElementsMap),
        // 被链接的系列中：在选框外的 element data
        linkOutOfBrushData: this._extendDatumOutOfBrush(this._linkedOutOfBrushElementsMap),
        // 在选框内的 图形
        inBrushElementsMap: this._inBrushElementsMap,
        // 在选框外的 图形
        outOfBrushElementsMap: this._outOfBrushElementsMap,
        // 被链接的系列中：在选框内的 图形
        linkedInBrushElementsMap: this._linkedInBrushElementsMap,
        // 被链接的系列中：在选框外的 图形
        linkedOutOfBrushElementsMap: this._linkedOutOfBrushElementsMap,
        // 缩放记录
        zoomRecord: this._zoomRecord
      },
      vchart: this._option?.globalInstance,
      event: e
    });
  }
  /*** end: event dispatch ***/

  /** start: set mark state ***/
  private _setBrushState(graphic: IMarkGraphic, state: typeof IN_BRUSH_STATE | typeof OUT_BRUSH_STATE) {
    const currentStates = (graphic.currentStates ?? []) as string[];
    setGraphicStates(graphic, [...currentStates.filter(s => s !== IN_BRUSH_STATE && s !== OUT_BRUSH_STATE), state]);
  }

  private _reconfigItem(operateMask: IPolygon, region: IRegion) {
    if (!operateMask?.globalTransMatrix || !operateMask?.attribute?.points) {
      return;
    }

    // 根据变换矩阵得到brushMask的实际坐标
    const points = operateMask?.attribute?.points ?? [];
    const { a, b, c, d, e, f } = operateMask.globalTransMatrix;
    const pointsCoord = points.map((p: IPointLike) => {
      return {
        x: a * p.x + c * p.y + e,
        y: b * p.x + d * p.y + f
      };
    });
    const { markTypeFilter = [] } = this._spec;

    // 遍历图元, 更新状态
    this._itemMap[region.id].forEach((mark: IMark) => {
      if (markTypeFilter.includes(mark.type)) {
        return;
      }
      const graphics = mark.getGraphics();

      if (!graphics || !graphics.length) {
        return;
      }
      graphics.forEach((graphicItem: IMarkGraphic) => {
        const elementKey = mark.id + '_' + graphicItem.context.key;
        // 判断逻辑:
        // 应该被置为inBrush状态的图元:
        // before: 在out brush elment map, 即不在任何brush中
        // now: 在当前brush图元中

        // 应该被置为outOfBrush状态的图元:
        // before: 在当前brush 的 in brush element map中, 即在当前brush中
        // now: 不在当前brush中
        const isBrushContainItem = this._isBrushContainItem(operateMask.globalAABBBounds, pointsCoord, graphicItem);
        if (this._outOfBrushElementsMap?.[elementKey] && isBrushContainItem) {
          this._setBrushState(graphicItem, IN_BRUSH_STATE);
          if (!this._inBrushElementsMap[operateMask?.name]) {
            this._inBrushElementsMap[operateMask?.name] = {};
          }
          this._inBrushElementsMap[operateMask?.name][elementKey] = graphicItem;
          delete this._outOfBrushElementsMap[elementKey];
        } else if (this._inBrushElementsMap?.[operateMask?.name]?.[elementKey] && !isBrushContainItem) {
          this._setBrushState(graphicItem, OUT_BRUSH_STATE);
          this._outOfBrushElementsMap[elementKey] = graphicItem;
          delete this._inBrushElementsMap[operateMask.name][elementKey];
        }
      });
    });
  }

  private _reconfigLinkedItem(operateMask: IPolygon, region: IRegion) {
    if (!operateMask?.globalTransMatrix || !operateMask?.attribute?.points) {
      return;
    }

    const regionLayoutPos = region.getLayoutStartPoint();
    const seriesId = region.getSeries().map(s => s.id);
    this._linkedSeries.forEach((s: ISeries) => {
      if (!seriesId.includes(s.id)) {
        const sRegionLayoutPos = s.getRegion().getLayoutStartPoint();

        const regionOffsetX = sRegionLayoutPos.x - regionLayoutPos.x;
        const regionOffsetY = sRegionLayoutPos.y - regionLayoutPos.y;

        // 根据变换矩阵得到brushMask的实际坐标
        const points = operateMask?.attribute?.points ?? [];
        const { a, b, c, d, e, f } = operateMask.globalTransMatrix;

        const dx = regionOffsetX || 0;
        const dy = regionOffsetY || 0;

        const pointsCoord = points.map((p: IPointLike) => {
          return {
            x: a * p.x + c * p.y + e + dx,
            y: b * p.x + d * p.y + f + dy
          };
        });

        operateMask.globalAABBBounds
          .clone()
          .set(
            operateMask.globalAABBBounds.x1 + dx,
            operateMask.globalAABBBounds.y1 + dy,
            operateMask.globalAABBBounds.x2 + dx,
            operateMask.globalAABBBounds.y2 + dy
          );

        const { markTypeFilter = [] } = this._spec;
        this._linkedItemMap[s.id].forEach((mark: IMark) => {
          if (markTypeFilter.includes(mark.type)) {
            return;
          }
          const graphics = mark.getGraphics();
          if (!graphics || !graphics.length) {
            return;
          }
          graphics.forEach((graphicItem: IMarkGraphic) => {
            const { key } = graphicItem.context;

            const elementKey = mark.id + '_' + graphicItem.context.key;
            // 判断逻辑:
            // 应该被置为inBrush状态的图元:
            // before: 在out brush elment map, 即不在任何brush中
            // now: 在当前brush图元中

            // 应该被置为outOfBrush状态的图元:
            // before: 在当前brush 的 in brush element map中, 即在当前brush中
            // now: 不在当前brush中
            if (
              this._linkedOutOfBrushElementsMap?.[elementKey] &&
              this._isBrushContainItem(operateMask.globalAABBBounds, pointsCoord, graphicItem)
            ) {
              this._setBrushState(graphicItem, IN_BRUSH_STATE);
              if (!this._linkedInBrushElementsMap[operateMask?.name]) {
                this._linkedInBrushElementsMap[operateMask?.name] = {};
              }
              this._linkedInBrushElementsMap[operateMask?.name][elementKey] = graphicItem;
              delete this._linkedOutOfBrushElementsMap[elementKey];
            } else if (
              this._linkedInBrushElementsMap?.[operateMask?.name]?.[elementKey] &&
              !this._isBrushContainItem(operateMask.globalAABBBounds, pointsCoord, graphicItem)
            ) {
              this._setBrushState(graphicItem, OUT_BRUSH_STATE);
              this._linkedOutOfBrushElementsMap[elementKey] = graphicItem;
            }
          });
        });
      }
    });
  }

  private _isBrushContainItem(brushMaskAABBBounds: IBounds, brushMaskPointsCoord: IPointLike[], item: IMarkGraphic) {
    // brush与图表图元进行相交 或 包含判断
    let itemBounds: { x: number; y: number }[] = [];
    if (['symbol', 'rect'].includes(item.type)) {
      const { x1, x2, y1, y2 } = item?.globalAABBBounds;
      itemBounds = [
        {
          x: x1,
          y: y1
        },
        {
          x: x2,
          y: y1
        },
        {
          x: x2,
          y: y2
        },
        {
          x: x1,
          y: y2
        }
      ];
      return polygonIntersectPolygon(brushMaskPointsCoord, itemBounds);
    }
    return brushMaskAABBBounds.intersects(item.globalAABBBounds);
  }

  protected _initItemMap(
    itemMap: Record<string, IMark[]>,
    elementMap: Record<string, IMarkGraphic>,
    stateName: string
  ) {
    const { markTypeFilter = [] } = this._spec;

    Object.entries(itemMap).forEach(([regionId, marks]) => {
      marks.forEach((mark: IMark) => {
        if (markTypeFilter.includes(mark.type)) {
          return;
        }
        const graphics = mark.getGraphics();
        if (!graphics || !graphics.length) {
          return;
        }
        graphics.forEach((el: IMarkGraphic) => {
          const elementKey = mark.id + '_' + el.context.key;
          removeGraphicState(el, [IN_BRUSH_STATE, OUT_BRUSH_STATE]);
          stateName && addGraphicState(el, stateName, true);
          elementMap[elementKey] = el;
        });
      });
    });
  }

  protected _initMarkBrushState(componentIndex: number, stateName: string) {
    this._brushComponents.forEach((brush, index) => {
      if (index !== componentIndex) {
        brush.children[0].removeAllChild();
      }
    });

    this._inBrushElementsMap = {};
    this._outOfBrushElementsMap = {};
    this._linkedInBrushElementsMap = {};
    this._linkedOutOfBrushElementsMap = {};

    this._initItemMap(this._itemMap, this._outOfBrushElementsMap, stateName);
    this._initItemMap(this._linkedItemMap, this._linkedOutOfBrushElementsMap, stateName);
  }

  // 绘制brush的时候, 避免brush与图元交互冲突
  private _setRegionMarkPickable(region: IRegion, pickable: boolean) {
    region
      .getGroupMark()
      .getGraphics()
      .forEach(g => g.setAttribute('childrenPickable', pickable));
  }
  /** end: set mark state  ***/

  /** start: control data zoom ***/
  private _stateClamp(state: number) {
    return Math.min(Math.max(0, state), 1);
  }

  private _setAxisAndDataZoom(operateMask: IPolygon, region: IRegion) {
    this._zoomRecord = [];
    if (this._spec.zoomAfterBrush) {
      // step1: 拿到brush bounds, 计算 continuous axis/dataZoom新范围
      const operateMaskBounds = operateMask.AABBBounds;

      // step2:
      // 如果轴关联了dataZoom，则通过dataZoom更新轴
      // 如果轴没有关联dataZoom，则直接更改轴rangeFactor
      this._regionAxisMap['region_' + region.id]?.forEach(axis => {
        const isHorizontal = axis.layoutOrient === 'bottom' || axis.layoutOrient === 'top';
        const axisRangeExpand = this._spec.axisRangeExpand ?? 0;
        const { x1, x2, y1, y2 } = operateMaskBounds;
        const regionStartAttr = isHorizontal ? 'x' : 'y';
        const regionSizeAttr = isHorizontal ? 'width' : 'height';
        const boundsStart = isHorizontal ? x1 : y1;
        const boundsEnd = isHorizontal ? x2 : y2;

        const range = axis.getScale().range();
        const rangeFactor = axis.scaleRangeFactor() ?? [0, 1];

        // 判断轴是否为反向轴（last(range) < range[0])，即从右到左, 或从下到上
        // 如果是反向轴, 计算start和end时, 也要保持 start < end
        const isAxisReverse = last(range) < range[0];
        const startPosTemp = boundsStart - region.getLayoutStartPoint()[regionStartAttr];
        const endPosTemp = boundsEnd - region.getLayoutStartPoint()[regionStartAttr];
        const endPos = isAxisReverse ? Math.min(startPosTemp, endPosTemp) : Math.max(startPosTemp, endPosTemp);
        const startPos = isAxisReverse ? Math.max(startPosTemp, endPosTemp) : Math.min(startPosTemp, endPosTemp);

        const start =
          ((startPos - range[0]) / (last(range) - range[0])) * (rangeFactor[1] - rangeFactor[0]) + rangeFactor[0];
        const end =
          ((endPos - range[0]) / (last(range) - range[0])) * (rangeFactor[1] - rangeFactor[0]) + rangeFactor[0];
        const newStart = this._stateClamp(start - axisRangeExpand);
        const newEnd = this._stateClamp(end + axisRangeExpand);

        if (this._axisDataZoomMap[axis.id]) {
          const dataZoom = this._axisDataZoomMap[axis.id];

          const newStartPercent = isAxisReverse ? 1 - newStart : newStart;
          const newEndPercent = isAxisReverse ? 1 - newEnd : newEnd;
          dataZoom.setStartAndEnd(Math.min(newStartPercent, newEndPercent), Math.max(newStartPercent, newEndPercent), [
            'percent',
            'percent'
          ]);

          this._zoomRecord.push({
            operateComponent: dataZoom,
            start: newStartPercent,
            end: newEndPercent,
            startValue: statePointToData(
              newStartPercent,
              dataZoom.stateScale,
              isReverse(dataZoom.relatedAxisComponent as CartesianAxis<any>, dataZoom.isHorizontal)
            ),
            endValue: statePointToData(
              newEndPercent,
              dataZoom.stateScale,
              isReverse(dataZoom.relatedAxisComponent as CartesianAxis<any>, dataZoom.isHorizontal)
            )
          });
        } else {
          axis.scaleRangeFactor([newStart, newEnd]);
          axis.effect.scaleUpdate();

          this._zoomRecord.push({
            operateComponent: axis,
            start: newStart,
            end: newEnd,
            startValue: axis.getScale().invert(startPos),
            endValue: axis.getScale().invert(endPos)
          });
        }
      });
    }
  }

  /** end: control data zoom ***/

  protected _getNeedClearVRenderComponents(): IGraphic[] {
    return this._brushComponents as unknown as IGroup[];
  }

  clearGraphic(): void {
    if (this._brushComponents) {
      this._brushComponents.forEach(brush => {
        (brush as any)._container.incrementalClearChild();
      });
    }
  }

  clear(): void {
    if (this._brushComponents) {
      const container = this.getContainer();
      this._brushComponents.forEach((brush, index) => {
        // 清空元素状态
        this._initMarkBrushState(index, '');

        brush.removeAllChild();
        brush.releaseBrushEvents();

        if (container) {
          container.removeChild(brush as unknown as INode);
        }
      });
      this._brushComponents = null;
    }
  }
  clearBrushStateAndMask() {
    this._relativeRegions.forEach((region: IRegion, componentIndex: number) => {
      this._initMarkBrushState(componentIndex, '');
      this._brushComponents[componentIndex].children[0].removeAllChild();
    });
  }
}

export const registerBrush = () => {
  Factory.registerComponent(Brush.type, Brush);
};
