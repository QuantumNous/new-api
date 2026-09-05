import { DataView, type SVGParsedElement, type SVGParserResult } from '@visactor/vchart';
import type { IPictogramSeriesSpec } from './interface';
import {
  ELEMENT_HIGHLIGHT_BY_GRPHIC_NAME,
  ELEMENT_SELECT_BY_GRPHIC_NAME,
  PICTOGRAM_SERIES_TYPE,
  PictogramSeriesMark
} from './constant';
import {
  SVG_VIEWPORT_RECT_KEY,
  getSVGSource,
  registerSVGSource,
  svgSourceMap,
  unregisterSVGSource,
  type SVGParserResultWithViewport
} from './svg-source';
import { PictogramSeriesSpecTransformer } from './pictogram-transformer';
import type { IMatrix, IPoint, IPointLike, GraphicEventType } from '@visactor/vchart';
import { Bounds, Matrix, isValid, merge } from '@visactor/vchart';
import { createRect, type IGroup } from '@visactor/vchart';
import { PictogramSeriesTooltipHelper } from './tooltip-helper';
import type {
  Datum,
  IGroupMark,
  IHoverSpec,
  IMark,
  ISelectSpec,
  ISeriesSeriesInfo,
  ITextMark,
  PanEventParam,
  ZoomEventParam
} from '@visactor/vchart';
import {
  AttributeLevel,
  CompilableData,
  Factory,
  GeoSeries,
  lookup,
  registerDataSetInstanceTransform,
  shouldMarkDoMorph,
  STATE_VALUE_ENUM
} from '@visactor/vchart';
import { registerElementHighlightByGraphicName } from '../element-highlight-by-graphic-name';
import { registerElementSelectByGraphicName } from '../element-select-by-graphic-name';
import { graphicAttributeTransform, pictogram } from './transform';

export interface SVGParsedElementExtend extends SVGParsedElement {
  _finalAttributes: Record<string, any>;
  _uniqueId: string; // 用于处理 svg 中 id 重复的情况
}

export class PictogramSeries<T extends IPictogramSeriesSpec = IPictogramSeriesSpec> extends GeoSeries<T> {
  static readonly type: string = PICTOGRAM_SERIES_TYPE;
  type = PICTOGRAM_SERIES_TYPE;
  static readonly mark = PictogramSeriesMark;
  static readonly transformerConstructor = PictogramSeriesSpecTransformer;

  svg!: string;

  protected _pictogramMark: IGroupMark;
  protected _parsedSvgResult: SVGParserResultWithViewport;
  private _labelMark: ITextMark;

  private _idToMark: Map<string, IMark> = new Map();

  setAttrFromSpec() {
    super.setAttrFromSpec();
    this.svg = this._spec.svg;
    this._nameField = this._spec.nameField;
    this._valueField = this._spec.valueField;

    if (!this.svg) {
      this._option?.onError(`svg source is not specified !`);
    }
    this._parsedSvgResult = getSVGSource(this.svg)?.latestData;

    if (!this._parsedSvgResult) {
      this._option?.onError(`'${this.svg}' is not registered !`);
    }
  }

  getDatumCenter(datum: SVGParsedElementExtend): [number, number] {
    return [Number.NaN, Number.NaN];
  }

  getDatumName(datum: SVGParsedElementExtend): string {
    return datum.name || datum._nameFromParent;
  }

  getMarksWithoutRoot(): IMark[] {
    return this.getMarks().filter(
      m => m.name && !m.name.includes('seriesGroup') && !m.name.includes('root') && m !== this._pictogramMark
    );
  }

  protected _buildMarkAttributeContext() {
    super._buildMarkAttributeContext();
    this._markAttributeContext.getTransformMatrix = this.getRootMatrix.bind(this);
    this._markAttributeContext.coordToPosition = this.coordToPosition.bind(this);
    this._markAttributeContext.dataToPosition = this.dataToPosition.bind(this);
  }

  protected _defaultHoverConfig(finalHoverSpec: IHoverSpec) {
    return {
      type: ELEMENT_HIGHLIGHT_BY_GRPHIC_NAME,
      // trigger: finalHoverSpec.trigger as EventType,
      trigger: finalHoverSpec.trigger as GraphicEventType,
      triggerOff: 'pointerout' as GraphicEventType,
      blurState: STATE_VALUE_ENUM.STATE_HOVER_REVERSE,
      highlightState: STATE_VALUE_ENUM.STATE_HOVER
    };
  }

  protected _defaultSelectConfig(finalSelectSpec: ISelectSpec) {
    const isMultiple = finalSelectSpec.mode === 'multiple';
    const triggerOff = isValid(finalSelectSpec.triggerOff)
      ? finalSelectSpec.triggerOff
      : isMultiple
      ? ['empty', 'self']
      : ['empty', finalSelectSpec.trigger];

    return {
      type: ELEMENT_SELECT_BY_GRPHIC_NAME,
      trigger: finalSelectSpec.trigger as GraphicEventType,
      triggerOff: triggerOff as GraphicEventType,
      reverseState: STATE_VALUE_ENUM.STATE_SELECTED_REVERSE,
      state: STATE_VALUE_ENUM.STATE_SELECTED,
      isMultiple
    };
  }

  initMark() {
    this._pictogramMark = this._createMark(
      PictogramSeries.mark.pictogram,
      {
        groupKey: this.getDimensionField()[0],
        isSeriesMark: true,
        skipBeforeLayouted: true
      },
      {
        morph: shouldMarkDoMorph(this._spec, PictogramSeries.mark.pictogram.name)
      }
    ) as IGroupMark;

    if (!this._pictogramMark) {
      return;
    }
    this._pictogramMark.setData(this._mapViewData);
    this._pictogramMark.setUserId(PictogramSeries.mark.pictogram.name);
    for (const element of this._mapViewData.getDataView().latestData as SVGParserResult['elements']) {
      const { graphicType: type, name, parent, id, _nameFromParent, _uniqueId } = element;

      const mark = this._createMark(
        { type, name: name ?? _nameFromParent },
        {
          groupKey: _uniqueId,
          isSeriesMark: false,
          skipBeforeLayouted: true,
          parent: (this._idToMark.get(parent?._uniqueId) as IGroupMark) ?? this._pictogramMark
        },
        {
          morph: shouldMarkDoMorph(this._spec, PictogramSeries.mark.pictogram.name)
        }
      );

      if (mark) {
        mark.setData(this._mapViewData);
        mark.setUserId(_uniqueId); // id 必须唯一，但无法控制 svg 中元素有重复 id， 这里做一个保护
        this._idToMark.set(_uniqueId, mark);
        if (mark.type !== 'group') {
          mark.setMarkConfig({ graphicName: mark.name });
        }
        mark.setTransform([
          {
            type: 'filter',
            callback: (datum: SVGParsedElementExtend) => {
              return datum._uniqueId === _uniqueId;
            }
          }
        ]);
      }
    }
    this._initLabelMark();
  }

  private _initLabelMark() {
    // @ts-ignore
    if (this._spec.label.visible !== true) {
      return;
    }

    const labelMark = this._createMark(PictogramSeries.mark.label, {
      isSeriesMark: false,
      parent: this._pictogramMark,
      groupKey: '_uniqueId',
      skipBeforeLayouted: true
    }) as ITextMark;

    if (labelMark) {
      this._labelMark = labelMark;
      this._labelMark.setData(this._mapViewData);
    }
  }

  initLabelMarkStyle() {
    if (!this._labelMark) {
      return;
    }
    this.setMarkStyle(
      this._labelMark,
      {
        visible: (d: Datum) => !!this._validElement(d as SVGParsedElementExtend),
        x: (d: Datum) => this.dataToPosition(d, true)?.x,
        y: (d: Datum) => this.dataToPosition(d, true)?.y,
        text: (d: Datum) => d[this.nameField],
        textAlign: 'center',
        textBaseline: 'middle'
      },
      STATE_VALUE_ENUM.STATE_NORMAL,
      AttributeLevel.Series
    );
  }

  initMarkStyle() {
    const { root } = this._parsedSvgResult;
    const svgViewportRect = this._getSvgViewportRect();
    const elements = this._mapViewData.getDataView().latestData as SVGParserResult['elements'];
    if (root) {
      this.setMarkStyle(
        this._pictogramMark,
        graphicAttributeTransform.group(root.attributes),
        'normal',
        AttributeLevel.Built_In
      );
      this.setMarkStyle(
        this._pictogramMark,
        {
          postMatrix: () => this._getFittedSvgRootMatrix()
        },
        'normal',
        AttributeLevel.Built_In
      );
      if (svgViewportRect) {
        // fill should be true or content will be invisible
        this._pictogramMark.setMarkConfig({
          clip: true,
          clipPath: [createRect({ ...svgViewportRect, fill: true }) as any]
        });
      }
    }
    for (const element of elements) {
      const { _uniqueId, _finalAttributes: attributes } = element as SVGParsedElementExtend;
      const mark = this._idToMark.get(_uniqueId);
      const valid = this._validElement(element);
      if (mark) {
        // 描边粗细跟随缩放倍数
        this.setMarkStyle(mark, { keepStrokeScale: true }, 'normal', AttributeLevel.Built_In);
        if (valid) {
          this.initMarkStyleWithSpec(mark, merge({}, this._spec.pictogram, (this._spec as any)[mark.name]));
          this.setMarkStyle(mark, attributes, 'normal', AttributeLevel.Series);
          mark.setPostProcess('fill', (result, datum) => {
            return isValid(result) ? result : this._spec.defaultFillColor;
          });
        } else {
          // 对于没有设置 name 的元素，不支持响应事件、改变样式
          mark.setMarkConfig({ interactive: false });
          this.setMarkStyle(mark, attributes, 'normal', AttributeLevel.Built_In);
        }
      }
    }

    this.initLabelMarkStyle();
  }
  /** 在 svg 中使用 name attribute 标注了的图元*/
  protected _validElement(element: SVGParsedElement) {
    return element.name || element._nameFromParent;
  }

  protected initTooltip() {
    this._tooltipHelper = new PictogramSeriesTooltipHelper(this);
    this.getMarksWithoutRoot().forEach(mark => {
      if (mark && mark.name) {
        this._tooltipHelper.activeTriggerSet.mark.add(mark);
      }
    });
  }

  dataToPosition(datum: Datum, global = false): IPointLike {
    if (!datum) {
      return null;
    }
    const name = datum[this.nameField];
    if (!name) {
      return null;
    }

    const mark = this.getMarksWithoutRoot().filter(mark => mark.name === name);
    if (!mark || mark.length === 0) {
      return null;
    }
    let bounds = new Bounds();
    if (global) {
      mark.forEach(m => {
        bounds = bounds.union(m.getGraphics()[0].globalAABBBounds);
      });
    } else {
      mark.forEach(m => {
        bounds = bounds.union(m.getProduct().AABBBounds);
      });
    }

    const point = { x: (bounds.x1 + bounds.x2) / 2, y: (bounds.y1 + bounds.y2) / 2 };

    if (global) {
      const { x, y } = this.getLayoutStartPoint();
      point.x -= x;
      point.y -= y;
    }
    return point;
  }

  coordToPosition(point: IPoint): IPoint | undefined {
    if (!point) {
      return null;
    }
    const { x, y } = point;
    const matrix = this.getRootMatrix();
    if (!matrix) {
      return null;
    }
    const position = {};
    matrix.getInverse().transformPoint({ x, y }, position as IPoint);
    return position as IPoint;
  }

  getRootMatrix() {
    return this.getPictogramRootGraphic()?.transMatrix as IMatrix;
  }

  getPictogramRootGraphic(): IGroup {
    return this._pictogramMark.getProduct();
  }

  private _getSvgRootMatrix() {
    const transform = this._parsedSvgResult?.root?.transform as IMatrix;
    return transform
      ? new Matrix(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f)
      : new Matrix();
  }

  private _getSvgViewportRect() {
    const viewBoxRect = this._parsedSvgResult?.viewBoxRect;

    if (viewBoxRect) {
      return viewBoxRect;
    }

    const { width, height } = this._parsedSvgResult ?? {};
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return {
        x: 0,
        y: 0,
        width,
        height
      };
    }

    return this._parsedSvgResult?.[SVG_VIEWPORT_RECT_KEY] ?? null;
  }

  private _getSvgRootBounds(rootMatrix: Matrix) {
    const viewBoxRect = this._getSvgViewportRect();

    if (!viewBoxRect) {
      return null;
    }

    const bounds = new Bounds().setValue(
      viewBoxRect.x,
      viewBoxRect.y,
      viewBoxRect.x + viewBoxRect.width,
      viewBoxRect.y + viewBoxRect.height
    );
    bounds.transformWithMatrix(rootMatrix);

    return bounds;
  }

  private _appendMatrixScale(matrix: Matrix, scale: number, center: IPointLike) {
    const nextMatrix = new Matrix();

    nextMatrix.translate(center.x, center.y);
    nextMatrix.scale(scale, scale);
    nextMatrix.translate(-center.x, -center.y);
    nextMatrix.multiply(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);

    return nextMatrix;
  }

  private _appendMatrixTranslate(matrix: Matrix, dx: number, dy: number) {
    const nextMatrix = new Matrix();

    nextMatrix.translate(dx, dy);
    nextMatrix.multiply(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);

    return nextMatrix;
  }

  private _getFittedSvgRootMatrix() {
    const rootMatrix = this._getSvgRootMatrix();
    const bounds = this._getSvgRootBounds(rootMatrix);

    if (!bounds) {
      return rootMatrix;
    }

    const width = bounds.width();
    const height = bounds.height();
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return rootMatrix;
    }

    const { width: regionWidth, height: regionHeight } = this.getLayoutRect();
    const rootCenterX = (bounds.x1 + bounds.x2) / 2;
    const rootCenterY = (bounds.y1 + bounds.y2) / 2;
    const scale = Math.min(regionWidth / width, regionHeight / height);
    const scaledMatrix = this._appendMatrixScale(rootMatrix, scale, { x: rootCenterX, y: rootCenterY });

    return this._appendMatrixTranslate(scaledMatrix, regionWidth / 2 - rootCenterX, regionHeight / 2 - rootCenterY);
  }

  initData() {
    super.initData();
    const parsedSvg = svgSourceMap.get(this.svg);
    if (!parsedSvg) {
      this._option?.onError('no valid svg found!');
    }
    const svgData = new DataView(this._dataSet, { name: `pictogram_${this.id}_data` });
    registerDataSetInstanceTransform(this._dataSet, 'pictogram', pictogram);
    registerDataSetInstanceTransform(this._dataSet, 'lookup', lookup);
    svgData
      .parse([parsedSvg], {
        type: 'dataview'
      })
      .transform({ type: 'pictogram' })
      .transform({
        type: 'lookup',
        options: {
          from: () => this.getViewData().latestData,
          key: 'name',
          fields: this._nameField,
          set: (a: Datum, b: Datum) => {
            if (b) {
              a.data = b;
            }
          }
        }
      })
      .transform({
        type: 'lookup',
        options: {
          from: () => this.getViewData().latestData,
          key: '_nameFromParent',
          fields: this._nameField,
          set: (a: Datum, b: Datum) => {
            if (b) {
              a.data = b;
            }
          }
        }
      });
    this._data?.getDataView().target.addListener('change', svgData.reRunAllTransform);
    this._mapViewData = new CompilableData(this._option, svgData);
  }

  mapViewDataUpdate() {
    this._mapViewData.updateData();
  }

  onLayoutEnd(): void {
    super.onLayoutEnd();
    this._mapViewData?.getDataView().reRunAllTransform();
  }

  updateSVGSize() {
    const root = this.getPictogramRootGraphic();
    if (root) {
      root.setAttributes({ postMatrix: this._getFittedSvgRootMatrix() });
    }
  }

  protected initEvent(): void {
    super.initEvent();
    this._mapViewData.getDataView()?.target.addListener('change', this.mapViewDataUpdate.bind(this));
  }

  handleZoom(e: ZoomEventParam) {
    const { scale, scaleCenter } = e;
    if (scale === 1) {
      return;
    }

    const root = this.getPictogramRootGraphic();
    if (root) {
      if (!root.attribute.postMatrix) {
        root.setAttributes({
          postMatrix: new Matrix()
        });
      }
      root.scale(scale, scale, scaleCenter);
    }
  }

  handlePan(e: PanEventParam) {
    const { delta } = e;
    if (delta[0] === 0 && delta[1] === 0) {
      return;
    }
    const root = this.getPictogramRootGraphic();
    if (root) {
      if (!root.attribute.postMatrix) {
        root.setAttributes({
          postMatrix: new Matrix()
        });
      }
      root.translate(delta[0], delta[1]);
    }
  }

  getMarkData(datum: Datum) {
    return datum.data ?? {};
  }

  getMeasureField(): string[] {
    return [this.valueField];
  }

  getDimensionField(): string[] {
    return [this.nameField];
  }
  protected _getSeriesInfo(field: string, keys: string[]) {
    const defaultShapeType = this.getDefaultShapeType();
    return keys.map(key => {
      return {
        key,
        originalKey: key,
        style: this.getSeriesStyle({
          data: {
            [field]: key
          }
        }),
        shapeType: defaultShapeType
      } as ISeriesSeriesInfo;
    });
  }

  release(): void {
    this._parsedSvgResult = null;
    this._idToMark.clear();
    this._idToMark = null;
  }
}

export const registerPictogramSeries = () => {
  // 注册语法元素
  Factory.registerSeries(PictogramSeries.type, PictogramSeries);
  Factory.registerImplement('registerSVG', registerSVGSource);
  Factory.registerImplement('unregisterSVG', unregisterSVGSource);
  registerElementHighlightByGraphicName();
  registerElementSelectByGraphicName();
};
