/* eslint-disable no-duplicate-imports */
import { STATE_VALUE_ENUM } from '../../compile/mark/interface';
import { HOOK_EVENT } from '../../constant/event';
import { AttributeLevel } from '../../constant/attribute';
import { DEFAULT_DATA_KEY } from '../../constant/data';
import type { IMark, IRectMark, ILabelMark } from '../../mark/interface';
import { MarkTypeEnum } from '../../mark/interface/type';
import type { Datum, IComposedTextMarkSpec, IRectMarkSpec } from '../../typings';
import { CartesianSeries } from '../cartesian/cartesian';
import type { SeriesMarkMap } from '../interface';
import { SeriesTypeEnum } from '../interface/type';
import type { ITreemapSeriesSpec } from './interface';
import { registerDataSetInstanceTransform } from '../../data/register';
import { flatten } from '../../data/transforms/flatten';
import type { IBounds } from '@visactor/vutils';
import { isValidNumber, Bounds, Matrix, mixin, merge } from '@visactor/vutils';
import type { PanEventParam, ZoomEventParam } from '../../event/interface';
import type { TreemapNodeElement } from '@visactor/vlayouts';
import { DataView } from '@visactor/vdataset';
import { hierarchyDimensionStatistics } from '../../data/transforms/hierarchy-dimension-statistics';
import { addVChartProperty } from '../../data/transforms/add-property';
import { addHierarchyDataKey, initHierarchyKeyMap } from '../../data/transforms/data-key';
import { DEFAULT_HIERARCHY_ROOT } from '../../constant/hierarchy';
import { TreemapTooltipHelper } from './tooltip-helper';
import { animationConfig, userAnimationConfig } from '../../animation/utils';
import { registerFadeInOutAnimation } from '../../animation/config';
import type { IZoomable } from '../../interaction/zoom/zoomable';
import { Zoomable } from '../../interaction/zoom/zoomable';
import type { IDrillable } from '../../interaction/drill/drillable';
import { Drillable } from '../../interaction/drill/drillable';
import { registerRectMark } from '../../mark/rect';
import { registerTextMark } from '../../mark/text';
import { treemapSeriesMark } from './constant';
import { Factory } from '../../core/factory';
import { registerTreemapAnimation } from './animation';
import { TreemapSeriesSpecTransformer } from './treemap-transform';
import { appendHierarchyFields } from '../util/hierarchy';
import { registerMarkFilterTransform } from '../../mark/transform/filter';
import { registerMarkMapTransform } from '../../mark/transform/map';
import { treemapLayout } from '../../data/transforms/treemap';
import type { ITransformSpec } from '../../compile/interface/compilable-item';
import { treemap } from '../../theme/builtin/common/series/treemap';

export class TreemapSeries extends CartesianSeries<any> {
  static readonly type: string = SeriesTypeEnum.treemap;
  type = SeriesTypeEnum.treemap;

  static readonly mark: SeriesMarkMap = treemapSeriesMark;
  static readonly builtInTheme = { treemap };

  static readonly transformerConstructor = TreemapSeriesSpecTransformer;
  readonly transformerConstructor = TreemapSeriesSpecTransformer;

  private _leafMark: IRectMark;
  private _nonLeafMark: IRectMark;
  private _labelMark: ILabelMark;
  private _nonLeafLabelMark: ILabelMark;

  protected declare _spec: ITreemapSeriesSpec;

  protected _categoryField: string = 'name';

  getCategoryField() {
    return this._categoryField;
  }
  setCategoryField(f: string): string {
    this._categoryField = f;
    return this._categoryField;
  }

  protected _valueField: string = 'value';
  getValueField() {
    return this._valueField;
  }
  setValueField(f: string): string {
    this._valueField = f;
    return this._valueField;
  }

  private _maxDepth: number;

  // global scale and translate matrix
  private _matrix: Matrix;

  // range for treemap layout, change while zoom and pan
  private _viewBox: IBounds = new Bounds();

  private _enableAnimationHook = this.enableMarkAnimation.bind(this);

  setAttrFromSpec(): void {
    super.setAttrFromSpec();
    this.setCategoryField(this._spec.categoryField);
    this.setValueField(this._spec.valueField);
    this.setSeriesField(this._spec.seriesField ?? DEFAULT_HIERARCHY_ROOT);

    if (this._spec.roam) {
      (this as unknown as IZoomable).initZoomable(this.event, this._option.mode);
      this._matrix = new Matrix();
    }
    if (this._spec.drill) {
      (this as unknown as IDrillable).initDrillable({
        event: this.event,
        mode: this._option.mode,
        drillField: () => this._spec.drillField ?? this._categoryField ?? DEFAULT_DATA_KEY,
        getRawData: () => this.getRawData()
      });
    }

    if (isValidNumber(this._spec.maxDepth)) {
      this._maxDepth = this._spec.maxDepth - 1;
    }
  }

  initData() {
    super.initData();

    registerDataSetInstanceTransform(this._dataSet, 'treemap', treemapLayout);

    this._data.getDataView()?.transform({
      type: 'treemap',
      options: () => ({
        nameField: this._categoryField,
        valueField: this._valueField,
        getViewBox: () => {
          return this._viewBox.empty()
            ? null
            : {
                x0: this._viewBox.x1,
                x1: this._viewBox.x2,
                y0: this._viewBox.y1,
                y1: this._viewBox.y2
              };
        },
        maxDepth: this._maxDepth,
        gapWidth: this._spec.gapWidth,
        padding: this._spec.nodePadding,
        splitType: this._spec.splitType,
        aspectRatio: this._spec.aspectRatio,
        labelPadding: this._spec.nonLeafLabel?.visible ? this._spec.nonLeafLabel?.padding : 0,
        labelPosition: this._spec.nonLeafLabel?.position,
        minVisibleArea: this._spec.minVisibleArea ?? 10,
        minChildrenVisibleArea: this._spec.minChildrenVisibleArea,
        minChildrenVisibleSize: this._spec.minChildrenVisibleSize
      })
    });
    // 矩形树图中原始数据为层次结果，图元数据为平坦化后的结构，具体逻辑如下：
    if (this.getViewData()) {
      // 对原始数据进行上卷下钻筛选
      if (this._spec.drill) {
        (this as unknown as IDrillable).initDrillableData(this._dataSet);
      }
    }
  }

  protected _runTreemapTransform(render = false) {
    this._data.getDataView().reRunAllTransform();

    if (render) {
      this.getCompiler().renderNextTick();
    }
  }

  protected _addDataIndexAndKey() {
    if (this._rawData?.dataSet) {
      registerDataSetInstanceTransform(this._rawData.dataSet, 'addVChartProperty', addVChartProperty);
      this._rawData.transform(
        {
          type: 'addVChartProperty',
          options: {
            beforeCall: initHierarchyKeyMap.bind(this),
            call: addHierarchyDataKey
          }
        }
        // rawDataStatistic 需要统计 addHierarchyDataKey 的一些字段，所以必须要运行一下
        // false
      );
    }
  }

  getRawDataStatisticsByField(field: string, isNumeric?: boolean) {
    // overwrite the getRawDataStatisticsByField of base-series
    if (!this._rawStatisticsCache) {
      this._rawStatisticsCache = {};
    }

    if (!this._rawStatisticsCache[field]) {
      if (this._rawData) {
        const result = hierarchyDimensionStatistics([this._rawData], {
          fields: [{ key: field, operations: isNumeric ? ['min', 'max'] : ['values'] }]
        })[field];
        this._rawStatisticsCache[field] = merge(this._rawStatisticsCache[field] ?? {}, result);
      }
    }

    return this._rawStatisticsCache[field];
  }

  protected _createHierarchyDataStatistics(dataName: string, rawData: DataView[]) {
    registerDataSetInstanceTransform(this._dataSet, 'hierarchyDimensionStatistics', hierarchyDimensionStatistics);
    registerDataSetInstanceTransform(this._dataSet, 'flatten', flatten);
    const data = new DataView(this._dataSet, { name: dataName });
    data.parse(rawData, {
      type: 'dataview'
    });
    data.transform(
      {
        type: 'hierarchyDimensionStatistics',
        options: {
          fields: () => {
            const fields = this.getStatisticFields();
            if (this._seriesField && this._seriesField !== this._categoryField) {
              fields.push({
                key: this._seriesField,
                operations: ['values']
              });
            }
            return fields;
          }
        }
      },
      false
    );
    return data;
  }

  getStatisticFields() {
    return appendHierarchyFields(super.getStatisticFields(), this._categoryField, this._valueField);
  }

  initMark() {
    const nonLeafMark = this._createMark(TreemapSeries.mark.nonLeaf, {
      isSeriesMark: true
    });
    if (nonLeafMark) {
      nonLeafMark.setTransform([
        {
          type: 'filter',
          callback: (datum: TreemapNodeElement) => {
            return !this._shouldFilterElement(datum, 'nonLeaf');
          }
        } as ITransformSpec
      ]);
      this._nonLeafMark = nonLeafMark;
    }

    const leafMark = this._createMark(TreemapSeries.mark.leaf, {
      isSeriesMark: true
    });
    if (leafMark) {
      leafMark.setTransform([
        {
          type: 'filter',
          callback: (datum: TreemapNodeElement) => {
            return !this._shouldFilterElement(datum, 'leaf');
          }
        } as ITransformSpec
      ]);
      this._leafMark = leafMark;
    }
  }

  initMarkStyle() {
    this._initLeafMarkStyle();
    this._initNonLeafMarkStyle();
  }

  protected _initLeafMarkStyle() {
    if (!this._leafMark) {
      return;
    }

    this.setMarkStyle<IRectMarkSpec>(
      this._leafMark,
      {
        x: datum => datum.x0,
        y: datum => datum.y0,
        x1: datum => datum.x1,
        y1: datum => datum.y1,
        fill: this.getColorAttribute()
      },
      STATE_VALUE_ENUM.STATE_NORMAL,
      AttributeLevel.Series
    );
  }

  protected _initNonLeafMarkStyle() {
    if (!this._nonLeafMark) {
      return;
    }
    this.setMarkStyle<IRectMarkSpec>(
      this._nonLeafMark,
      {
        x: datum => datum.x0,
        y: datum => datum.y0,
        x1: datum => datum.x1,
        y1: datum => datum.y1,
        fill: this.getColorAttribute()
      },
      STATE_VALUE_ENUM.STATE_NORMAL,
      AttributeLevel.Series
    );
  }

  _initRichStyleOfLabelMark(labelMark: ILabelMark) {
    if (labelMark.getTextType() === 'rich') {
      this.setMarkStyle<IComposedTextMarkSpec>(
        labelMark,
        {
          maxWidth: datum => Math.abs(datum.x0 - datum.x1),
          maxHeight: datum => Math.abs(datum.y0 - datum.y1),
          ellipsis: true
        },
        STATE_VALUE_ENUM.STATE_NORMAL,
        AttributeLevel.Series
      );
    }
  }

  initLabelMarkStyle(labelMark: ILabelMark) {
    if (!labelMark) {
      return;
    }
    this._labelMark = labelMark;
    labelMark.setRule('treemap');
    this.setMarkStyle(
      labelMark,
      {
        x: datum => (datum.x0 + datum.x1) / 2,
        y: datum => (datum.y0 + datum.y1) / 2,
        text: datum => {
          return datum.datum[datum.depth]?.[this.getDimensionField()[0]];
        },
        maxLineWidth: (datum: Datum) => {
          return datum.x1 === datum.x0 ? Number.MIN_VALUE : datum.x1 - datum.x0;
        }
      },
      STATE_VALUE_ENUM.STATE_NORMAL,
      AttributeLevel.Series
    );

    this._initRichStyleOfLabelMark(labelMark);
  }

  protected initNonLeafLabelMarkStyle(labelMark: ILabelMark) {
    if (!labelMark) {
      return;
    }
    this._nonLeafLabelMark = labelMark;
    labelMark.setRule('treemap');
    this.setMarkStyle(
      labelMark,
      {
        x: datum => {
          if (datum.labelRect) {
            return (datum.labelRect.x0 + datum.labelRect.x1) / 2;
          }
          return (datum.x0 + datum.x1) / 2;
        },
        y: datum => {
          if (datum.labelRect) {
            return (datum.labelRect.y0 + datum.labelRect.y1) / 2;
          }
          return (datum.y0 + datum.y1) / 2;
        },
        text: datum => {
          return datum.datum[datum.depth]?.[this.getDimensionField()[0]];
        },
        maxLineWidth: (datum: any) => {
          return datum.x1 === datum.x0 ? Number.MIN_VALUE : datum.x1 - datum.x0;
        }
      },
      STATE_VALUE_ENUM.STATE_NORMAL,
      AttributeLevel.Series
    );
    this._initRichStyleOfLabelMark(labelMark);
  }

  initAnimation(): void {
    this.getMarksInType(MarkTypeEnum.rect).forEach(mark => {
      mark.setAnimationConfig(
        animationConfig(
          Factory.getAnimationInKey('treemap')?.(),
          userAnimationConfig(mark.name, this._spec, this._markAttributeContext)
        )
      );
    });
  }

  protected initEvent(): void {
    super.initEvent();
    // Roam
    if (this._spec.roam) {
      // 拖拽事件
      (this as unknown as IZoomable).initDragEventOfSeries(this);
      this.event.on('panmove', e => {
        this.handlePan(e as PanEventParam);
      });
      // 缩放事件
      (this as unknown as IZoomable).initZoomEventOfSeries(this);
      this.event.on('zoom', e => {
        this.handleZoom(e as ZoomEventParam);
      });
    }
    // Drill
    if (this._spec.drill) {
      (this as unknown as IDrillable).bindDrillEvent();
    }
  }

  protected _getDataIdKey() {
    return 'key';
  }

  protected initTooltip() {
    this._tooltipHelper = new TreemapTooltipHelper(this);
    this._leafMark && this._tooltipHelper.activeTriggerSet.mark.add(this._leafMark);
    this._nonLeafMark && this._tooltipHelper.activeTriggerSet.mark.add(this._nonLeafMark);
  }

  private _shouldFilterElement(datum: TreemapNodeElement, nodeType: 'leaf' | 'nonLeaf') {
    const isLeaf = datum.isLeaf;
    // 过滤掉非需要的节点
    return nodeType === 'leaf' ? !isLeaf : isLeaf;
  }

  handlePan(event: PanEventParam) {
    const { delta } = event;
    if (delta[0] === 0 && delta[1] === 0) {
      return;
    }
    this._matrix.reset();
    this._matrix.translate(delta[0], delta[1]);
    const { a, b, c, d, e, f } = this._matrix;
    this._matrix.multiply(a, b, c, d, e, f);

    this._viewBox.transformWithMatrix(this._matrix);

    this._runTreemapTransform(true);
  }

  handleZoom(event: ZoomEventParam) {
    const { scale, scaleCenter } = event;
    if (scale === 1) {
      return;
    }

    this._matrix.reset();
    const { x, y } = scaleCenter;
    this._matrix.translate(x, y);
    this._matrix.scale(scale, scale);
    this._matrix.translate(-x, -y);
    const { a, b, c, d, e, f } = this._matrix;
    this._matrix.multiply(a, b, c, d, e, f);
    // 缩放过程中会有新增/减少的element，对应执行enter/exit动画，会使得缩放交互效果体验很差
    // 这里在缩放过程中先关闭所有动画
    this.disableMarkAnimation();
    this.event.on(HOOK_EVENT.AFTER_DO_RENDER, this._enableAnimationHook);
    this._viewBox.transformWithMatrix(this._matrix);
    this._runTreemapTransform(true);
  }

  getDimensionField() {
    return [this._categoryField];
  }

  getMeasureField(): string[] {
    return [this._valueField];
  }

  onLayoutEnd(): void {
    super.onLayoutEnd();
    this._viewBox.set(0, 0, this.getLayoutRect().width, this.getLayoutRect().height);
    this._runTreemapTransform();
  }

  protected enableMarkAnimation() {
    this.getMarks().forEach(mark => {
      // mark.getProduct().animate?.enable();
    });
    [this._labelMark, this._nonLeafLabelMark].forEach(m => {
      if (m && m.getComponent()) {
        m.getComponent().getProduct().enableAnimation();
      }
    });
    // 在所有动画执行之后关闭动画
    this.event.off(HOOK_EVENT.AFTER_DO_RENDER, this._enableAnimationHook);
  }

  protected disableMarkAnimation() {
    this.getMarks().forEach(mark => {
      // mark.getProduct().animate?.disable();
    });
    [this._labelMark, this._nonLeafLabelMark].forEach(m => {
      if (m && m.getComponent()) {
        m.getComponent().getProduct().disableAnimation();
      }
    });
  }

  getDefaultShapeType(): string {
    return 'square';
  }

  getActiveMarks(): IMark[] {
    return [this._nonLeafMark, this._leafMark];
  }

  isHierarchyData = () => {
    return true;
  };

  getMarkData(datum: Datum) {
    return datum?.datum ? datum.datum[datum.datum.length - 1] : datum;
  }
}

mixin(TreemapSeries, Drillable);
mixin(TreemapSeries, Zoomable);

export const registerTreemapSeries = () => {
  registerMarkFilterTransform();
  registerMarkMapTransform();
  registerRectMark();
  registerTextMark();
  registerTreemapAnimation();
  registerFadeInOutAnimation();
  Factory.registerSeries(TreemapSeries.type, TreemapSeries);
};
