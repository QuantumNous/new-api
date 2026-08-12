import type { ICartesianHorizontal } from './interface/spec';
import { Bounds, last, type IBounds, type IBoundsLike, type Maybe } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import type { IEffect, IModelInitOption, IModelSpecInfo } from '../../../model/interface';
import type { ICartesianSeries } from '../../../series/interface';
import type { IRegion } from '../../../region/interface';
import type { ICartesianAxisCommonSpec, IAxisHelper, ICartesianVertical } from './interface';
import { mergeSpec } from '@visactor/vutils-extension';
import {
  isArray,
  isValid,
  isValidNumber,
  eachSeries,
  isNil,
  isUndefined,
  calcLayoutNumber,
  maxInArr,
  minInArr,
  clamp
} from '../../../util';
import type { IOrientType, IPadding, IRect } from '../../../typings/space';
// eslint-disable-next-line no-duplicate-imports
import { Direction } from '../../../typings/space';
import type { IBaseScale } from '@visactor/vscale';
// eslint-disable-next-line no-duplicate-imports
import { isContinuous } from '@visactor/vscale';
import { Factory } from '../../../core/factory';
import { isXAxis, getOrient, isZAxis, isYAxis, getCartesianAxisInfo, transformInverse } from './util/common';
import { ChartEvent, HOOK_EVENT } from '../../../constant/event';
import { LayoutLevel, DEFAULT_LAYOUT_RECT_LEVEL, LayoutZIndex, USER_LAYOUT_RECT_LEVEL } from '../../../constant/layout';
import { AxisSyncPlugin } from '../../../plugin/components/axis-sync/axis-sync';
import type { Datum, StringOrNumber } from '../../../typings/common';
import type { IPoint } from '../../../typings/coordinate';
import type { ILayoutRect, ILayoutType } from '../../../typings/layout';
import type { IComponentOption } from '../../interface';
// eslint-disable-next-line no-duplicate-imports
import { ComponentTypeEnum } from '../../interface/type';
import type { AxisItem, LineAxisAttributes } from '@visactor/vrender-components';
// eslint-disable-next-line no-duplicate-imports
import { getAxisItem, isValidCartesianAxis, shouldUpdateAxis } from '../util';
import type { IAxis, ITick } from '../interface';
// eslint-disable-next-line no-duplicate-imports
import type { ICartesianTickDataOpt } from '@visactor/vrender-components';
// eslint-disable-next-line no-duplicate-imports
import type { DataSet } from '@visactor/vdataset';
// eslint-disable-next-line no-duplicate-imports
import { AxisComponent } from '../base-axis';
import type { IGraphic, IText } from '@visactor/vrender-core';
// eslint-disable-next-line no-duplicate-imports
import { createText } from '@visactor/vrender-core';
import type { ICartesianChartSpec } from '../../../chart/cartesian/interface';
import { getCombinedSizeOfRegions } from '../../../util/region';

const CartesianAxisPlugin = [AxisSyncPlugin];

export abstract class CartesianAxis<T extends ICartesianAxisCommonSpec = ICartesianAxisCommonSpec>
  extends AxisComponent<T>
  implements IAxis
{
  static type = ComponentTypeEnum.cartesianAxis;
  type = ComponentTypeEnum.cartesianAxis;
  name: string = ComponentTypeEnum.cartesianAxis;

  static specKey = 'axes';

  protected readonly _defaultBandPosition = 0.5;
  protected readonly _defaultBandInnerPadding = 0.1;
  protected readonly _defaultBandOuterPadding = 0.3;

  // 标记这个布局Item的方向（left->right, right->left, top->bottom, bottom->top）
  declare directionStr?: 'l2r' | 'r2l' | 't2b' | 'b2t';

  layoutType: ILayoutType = 'region-relative';
  layoutZIndex: number = LayoutZIndex.Axis;
  layoutLevel: number = LayoutLevel.Axis;

  protected _dataSet: DataSet;

  protected _orient: IOrientType = 'left';
  getOrient() {
    return this._orient;
  }

  protected getDefaultInteractive() {
    return true;
  }

  protected _autoIndentOnce: boolean = false;
  protected _hasAutoIndent: boolean = false;
  set autoIndentOnce(v: boolean) {
    this._autoIndentOnce = v;
  }

  protected _scales: IBaseScale[] = [];
  getScales() {
    return this._scales;
  }

  protected _tick: ITick | undefined = undefined;

  protected _axisStyle: Partial<LineAxisAttributes>;
  private _latestBounds: IBounds;
  private _verticalLimitSize: number;
  private _unitText: IText;

  protected _layoutCache: {
    width: number;
    height: number;
    _lastComputeOutBounds: IBoundsLike;
  } = { width: 0, height: 0, _lastComputeOutBounds: { x1: 0, x2: 0, y1: 0, y2: 0 } };

  // 内padding
  protected _innerOffset: { top: number; bottom: number; left: number; right: number } = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  };
  getInnerOffset() {
    return this._innerOffset;
  }

  constructor(spec: T, options: IComponentOption) {
    super(spec, options);
    this._orient = getOrient(spec, ['z']);
    if (isZAxis(this._orient)) {
      this.layoutType = 'absolute';
    }
    this._dataSet = options.dataSet;
    this._coordinateType = 'cartesian';
  }

  static getSpecInfo(chartSpec: any): Maybe<IModelSpecInfo[]> {
    const axesSpec = chartSpec[this.specKey];
    if (!axesSpec) {
      return null;
    }

    const isHorizontal = chartSpec.direction === Direction.horizontal;

    if (!isArray(axesSpec)) {
      // 如果非法，或者只有一个z轴就不创建
      if (!isValidCartesianAxis(axesSpec)) {
        return null;
      }
      const { axisType, componentName } = getCartesianAxisInfo(axesSpec, isHorizontal);
      axesSpec.type = axisType;
      return [
        {
          spec: axesSpec,
          specPath: [this.specKey],
          specInfoPath: ['component', this.specKey, 0],
          type: componentName
        }
      ];
    }
    // 处理spec
    const zAxis = axesSpec.filter(s => s.orient === 'z')[0];
    let valid = true;
    if (zAxis) {
      const xAxis = axesSpec.filter(s => s.orient === 'bottom')[0];
      const yAxis = axesSpec.filter(s => isYAxis(s.orient))[0];
      // 必须有x和y，且x必须是bottom
      valid = axesSpec.length === 3 && xAxis && yAxis;
    }

    let axesSpecList = axesSpec.map((spec, index) => ({ spec, index }));
    if (!valid) {
      axesSpecList = axesSpecList.filter(({ spec }) => spec.orient !== 'z');
    }
    const specInfos: IModelSpecInfo[] = [];
    axesSpecList.forEach(({ spec, index }) => {
      if (!isValidCartesianAxis(spec)) {
        return;
      }
      const { axisType, componentName } = getCartesianAxisInfo(spec, isHorizontal);
      spec.type = axisType;
      specInfos.push({
        spec,
        specPath: [this.specKey, index],
        specInfoPath: ['component', this.specKey, index],
        type: componentName
      });
    });
    return specInfos;
  }

  static createComponent(specInfo: IModelSpecInfo, options: IComponentOption) {
    const { spec, ...others } = specInfo;
    const C = Factory.getComponentInKey(others.type);
    if (C) {
      return new C(spec, {
        ...options,
        ...others
      }) as IAxis;
    }
    options.onError(`Component ${others.type} not found`);
    return null;
  }

  initLayout(): void {
    super.initLayout();
    this._layout.autoIndent = this._spec.autoIndent !== false;
    this._layout.layoutOrient = this._orient;
  }

  effect: IEffect = {
    scaleUpdate: params => {
      this.computeData(params?.value);
      eachSeries(
        this._regions,
        s => {
          const orient = this.getOrient();
          if (isXAxis(orient)) {
            if (
              shouldUpdateAxis(
                (s as ICartesianSeries).getXAxisHelper(),
                this.axisHelper(),
                isValid(this._seriesUserId) || isValid(this._seriesIndex)
              )
            ) {
              (s as ICartesianSeries).setXAxisHelper(this.axisHelper());
            }
          } else if (isYAxis(orient)) {
            if (
              shouldUpdateAxis(
                (s as ICartesianSeries).getYAxisHelper(),
                this.axisHelper(),
                isValid(this._seriesUserId) || isValid(this._seriesIndex)
              )
            ) {
              (s as ICartesianSeries).setYAxisHelper(this.axisHelper());
            }
          } else if (isZAxis(orient)) {
            if (
              shouldUpdateAxis(
                (s as ICartesianSeries).getZAxisHelper(),
                this.axisHelper(),
                isValid(this._seriesUserId) || isValid(this._seriesIndex)
              )
            ) {
              (s as ICartesianSeries).setZAxisHelper(this.axisHelper());
            }
          }
        },
        {
          userId: this._seriesUserId,
          specIndex: this._seriesIndex
        }
      );
    }
  };

  protected abstract computeDomain(data: { min: number; max: number; values: any[] }[]): StringOrNumber[];
  abstract valueToPosition(value: any): number;

  protected getNewScaleRange() {
    const { width, height } = this.getLayoutRect();
    const { left, right, top, bottom } = this._innerOffset;
    let newRange: number[] = [];
    if (isXAxis(this.getOrient())) {
      if (isValidNumber(width)) {
        newRange = this._inverse ? [width - right, left] : [left, width - right];
      }
    } else if (isZAxis(this.getOrient())) {
      if (isValidNumber(width)) {
        newRange = this._inverse ? [width - right, left] : [left, width - right];
        this._scale.range(newRange);
      }
    } else {
      if (isValidNumber(height)) {
        newRange = this._inverse ? [top, height - bottom] : [height - bottom, top];
      }
    }

    return newRange;
  }

  updateScaleRange() {
    let isScaleChange = false;

    const newRange = this.getNewScaleRange();
    const range = this._scale.range();
    if (newRange.length === range.length && newRange.every((value, index) => value === range[index])) {
      isScaleChange = false; // No change
    } else {
      isScaleChange = true; // Change detected
      this._scale.range(newRange);
    }

    return isScaleChange;
  }

  init(option: IModelInitOption): void {
    super.init(option);
    this.pluginService?.load(CartesianAxisPlugin.map(P => new P()));
    this.callPlugin(plugin => {
      this.pluginService && plugin.onInit && plugin.onInit(this.pluginService, this);
    });
  }

  setAttrFromSpec() {
    super.setAttrFromSpec();

    if (this._specVisible) {
      const isX = isXAxis(this.getOrient());
      if (isX) {
        if (isUndefined(this._spec.maxHeight)) {
          this._spec.maxHeight = '30%';
        }
      } else if (isUndefined(this._spec.maxWidth)) {
        this._spec.maxWidth = '30%';
      }

      const axisStyle: any = this._getAxisAttributes();
      axisStyle.label.formatMethod = this._getLabelFormatMethod();
      axisStyle.verticalFactor = this.getOrient() === 'top' || this.getOrient() === 'right' ? -1 : 1;
      this._axisStyle = axisStyle;
    }
    this._tick = this._spec.tick;
    const chartSpec = this._option.getChart()?.getSpec() as ICartesianChartSpec;
    this._inverse = transformInverse(this._spec, chartSpec?.direction === Direction.horizontal);
  }

  onLayoutStart(layoutRect: IRect, viewRect: ILayoutRect): void {
    super.onLayoutStart(layoutRect, viewRect);
    // 计算innerOffset
    if (!isZAxis(this.getOrient()) && (this._spec as ICartesianVertical | ICartesianHorizontal).innerOffset) {
      const spec = this._spec as ICartesianVertical | ICartesianHorizontal;
      if (isYAxis(this.getOrient())) {
        ['top', 'bottom'].forEach(orient => {
          this._innerOffset[orient as 'top' | 'bottom'] = calcLayoutNumber(
            (spec as ICartesianVertical).innerOffset[orient as 'top' | 'bottom'],
            viewRect.height,
            viewRect
          );
        });
      } else {
        ['left', 'right'].forEach(orient => {
          this._innerOffset[orient as 'left' | 'right'] = calcLayoutNumber(
            (spec as ICartesianHorizontal).innerOffset[orient as 'left' | 'right'],
            viewRect.width,
            viewRect
          );
        });
      }
    }
  }

  protected getSeriesStatisticsField(s: ICartesianSeries) {
    let f: string[];
    if (isXAxis(this.getOrient())) {
      f = s.fieldX;
    } else if (isZAxis(this.getOrient())) {
      f = s.fieldZ;
    } else {
      f = s.fieldY;
    }
    if (isContinuous(this._scale.type)) {
      return f;
    }
    return [f[0]];
  }

  protected _tickTransformOption() {
    return {
      ...super._tickTransformOption(),
      noDecimals: this._tick?.noDecimals,
      labelLastVisible: this._spec.label?.lastVisible,
      labelFirstVisible: this._spec.label?.firstVisible,
      labelFlush: this._spec.label?.flush
    } as ICartesianTickDataOpt;
  }

  protected axisHelper(): IAxisHelper {
    const getScale = (depth: number = 0) => {
      return this._scales[depth];
    };
    return {
      isContinuous: isContinuous(this._scale.type),
      dataToPosition: this.dataToPosition.bind(this),
      getScale,
      getAxisType: () => this.type,
      getAxisId: () => this.id,
      isInverse: () => this._inverse === true,
      getSpec: () => this._spec
    };
  }

  /** LifeCycle API**/
  afterCompile() {
    const product = this._axisMark?.getProduct();

    if (product) {
      this.event.on(HOOK_EVENT.AFTER_ELEMENT_ENCODE, ({ mark }) => {
        if (mark === this._axisMark) {
          if (this._isLayout === false) {
            // 布局结束之后再进行插件的调用
            // 插件在布局后
            if (isXAxis(this.getOrient())) {
              this.callPlugin(plugin => {
                this.pluginService &&
                  plugin.onDidLayoutHorizontal &&
                  plugin.onDidLayoutHorizontal(this.pluginService, this);
              });
            } else {
              this.callPlugin(plugin => {
                this.pluginService &&
                  plugin.onDidLayoutVertical &&
                  plugin.onDidLayoutVertical(this.pluginService, this);
              });
            }

            // 更新单位的显示位置
            if (this._unitText) {
              const { x, y } = this.getLayoutStartPoint();
              const pos = isXAxis(this._orient)
                ? {
                    x: maxInArr<number>(this._scale.range()) + x,
                    y
                  }
                : {
                    x,
                    y: minInArr<number>(this._scale.range()) + y
                  };

              this._unitText.setAttributes(pos);
            }
          }
        }
      });
    }
    this.callPlugin(plugin => {
      this.pluginService && plugin.onDidCompile && plugin.onDidCompile(this.pluginService, this);
    });
  }

  protected collectScale() {
    const scales: IBaseScale[] = [];
    eachSeries(
      this._regions,
      s => {
        scales.push(
          this.getOrient() === 'left' || this.getOrient() === 'right'
            ? (s as ICartesianSeries).scaleY
            : (s as ICartesianSeries).scaleX
        );
      },
      {
        userId: this._seriesUserId,
        specIndex: this._seriesIndex
      }
    );
    return scales;
  }

  protected collectSeriesField(depth: number, series: ICartesianSeries) {
    let field: string | string[];
    if (depth > 0) {
      field = series.getGroups()?.fields?.[depth];
    } else {
      if (isXAxis(this.getOrient())) {
        field = series.getSpec().x2Field ? [...series.fieldX, series.fieldX2] : series.fieldX;
      } else if (isZAxis(this.getOrient())) {
        field = series.fieldZ;
      } else {
        field = series.getSpec().y2Field ? [...series.fieldY, series.fieldY2] : series.fieldY;
      }
    }
    return field;
  }

  protected updateSeriesScale() {
    const orient = this.getOrient();
    eachSeries(
      this._regions,
      s => {
        if (isXAxis(orient)) {
          if (
            shouldUpdateAxis(
              (s as ICartesianSeries).getXAxisHelper(),
              this.axisHelper(),
              isValid(this._seriesUserId) || isValid(this._seriesIndex)
            )
          ) {
            (s as ICartesianSeries).setScaleX(this._scale);
            (s as ICartesianSeries).setXAxisHelper(this.axisHelper());
          }
        } else if (isYAxis(orient)) {
          if (
            shouldUpdateAxis(
              (s as ICartesianSeries).getYAxisHelper(),
              this.axisHelper(),
              isValid(this._seriesUserId) || isValid(this._seriesIndex)
            )
          ) {
            (s as ICartesianSeries).setScaleY(this._scale);
            (s as ICartesianSeries).setYAxisHelper(this.axisHelper());
          }
        } else if (isZAxis(orient)) {
          if (
            shouldUpdateAxis(
              (s as ICartesianSeries).getZAxisHelper(),
              this.axisHelper(),
              isValid(this._seriesUserId) || isValid(this._seriesIndex)
            )
          ) {
            (s as ICartesianSeries).setScaleZ(this._scale);
            (s as ICartesianSeries).setZAxisHelper(this.axisHelper());
          }
        }
      },
      {
        userId: this._seriesUserId,
        specIndex: this._seriesIndex
      }
    );
  }

  // protected _seriesUpdateAfterScaleChange(updateInfo: { domain?: boolean; range?: boolean; type?: boolean }) {
  //   const orient = this.getOrient();
  //   eachSeries(
  //     this._regions,
  //     s => {
  //       if (isXAxis(orient)) {
  //         (s as ICartesianSeries).xAxisUpdated(updateInfo);
  //       } else if (isYAxis(orient)) {
  //         (s as ICartesianSeries).yAxisUpdated(updateInfo);
  //       } else if (isZAxis(orient)) {
  //         (s as ICartesianSeries).zAxisUpdated(updateInfo);
  //       }
  //     },
  //     {
  //       userId: this._seriesUserId,
  //       specIndex: this._seriesIndex
  //     }
  //   );
  // }

  _transformLayoutPosition = (pos: Partial<IPoint>) => {
    let { x, y } = pos;
    if (isValidNumber(x)) {
      x += Number(this._orient === 'left') * this.getLayoutRect().width;
    }
    if (isValidNumber(y)) {
      y += Number(this._orient === 'top') * this.getLayoutRect().height;
    }
    return { x, y };
  };

  _transformLayoutRect = (result: ILayoutRect) => {
    if (!this._visible) {
      return result;
    }
    const bounds = this._latestBounds.clone().translate(-this.getLayoutStartPoint().x, -this.getLayoutStartPoint().y);
    switch (this._layout.layoutOrient) {
      case 'left':
        if (this._layout.layoutRectLevelMap.width === DEFAULT_LAYOUT_RECT_LEVEL) {
          result.width = bounds.x1 < 0 ? -bounds.x1 : 0;
        }
        break;
      case 'right':
        if (this._layout.layoutRectLevelMap.width === DEFAULT_LAYOUT_RECT_LEVEL) {
          result.width = bounds.x2 > 0 ? bounds.x2 : 0;
        }
        break;
      case 'top':
        if (this._layout.layoutRectLevelMap.height === DEFAULT_LAYOUT_RECT_LEVEL) {
          result.height = bounds.y1 < 0 ? -bounds.y1 : 0;
        }
        break;
      case 'bottom':
        if (this._layout.layoutRectLevelMap.height === DEFAULT_LAYOUT_RECT_LEVEL) {
          result.height = bounds.y2 > 0 ? bounds.y2 : 0;
        }
        break;
      default:
        break;
    }
    result.width = Math.ceil(result.width);
    result.height = Math.ceil(result.height);
    return this._layout.setRectInSpec(this._layoutCacheProcessing(result));
  };

  _transformLayoutPadding = (padding: IPadding) => {
    if (this.layoutOrient === 'left' || this.layoutOrient === 'right') {
      padding.top = 0;
      padding.bottom = 0;
    } else if (this.layoutOrient === 'top' || this.layoutOrient === 'bottom') {
      padding.left = 0;
      padding.right = 0;
    }
    return padding;
  };

  /**
   * bounds 预计算
   * @param rect
   * @returns
   */
  getBoundsInRect(rect: ILayoutRect): IBoundsLike {
    let result: IBoundsLike = { x1: 0, y1: 0, x2: 0, y2: 0 };
    if (!this._visible) {
      return result;
    }
    this._verticalLimitSize = isXAxis(this.getOrient()) ? rect.height : rect.width;

    this.setLayoutRect(rect);
    const isChanged = this.updateScaleRange();
    // 防止一直没有计算latestData
    if (isChanged || !isArray(this.getTickData()?.getLatestData())) {
      this.computeData('range');
    }
    const context = { skipLayout: false };
    const isX = isXAxis(this.getOrient());
    if (this.pluginService) {
      isX
        ? this.callPlugin(plugin => {
            plugin.onWillLayoutHorizontal && plugin.onWillLayoutHorizontal(this.pluginService, context, this);
          })
        : this.callPlugin(plugin => {
            plugin.onWillLayoutVertical && plugin.onWillLayoutVertical(this.pluginService, context, this);
          });
    }
    const product = this._axisMark.getProduct();
    let hasBounds = false;

    if (!context.skipLayout) {
      const attrs = this._getUpdateAttribute(true);
      const axisComponent = this._axisMark.getComponent();

      const spec = mergeSpec({ ...this.getLayoutStartPoint() }, this._axisStyle, attrs, { line: { visible: false } });
      let updateBounds = axisComponent?.getBoundsWithoutRender(spec);

      if (!updateBounds || updateBounds.empty()) {
        // 如果包围盒为空，设置为布局起点，宽高为0的包围盒
        updateBounds = new Bounds().set(spec.x, spec.y, spec.x, spec.y);
      }

      hasBounds = true;
      this._latestBounds = updateBounds;
      // 因为轴单位在某些区域显示的时候，是不参与轴某个方向的包围盒计算的，
      // 所以不太合适放在轴组件内支持，所以就在 VChart 层的轴组件上通过添加 text 图元支持
      result = this._appendAxisUnit(updateBounds, isX);
    }

    if (!hasBounds) {
      this._latestBounds = product.AABBBounds;
    }
    return result;
  }

  positionToData(pos: number, isViewPos?: boolean) {
    const isX = isXAxis(this.getOrient());
    if (isViewPos) {
      pos -= isX ? this.getLayoutStartPoint().x : this.getLayoutStartPoint().y;
    }

    if (this._innerOffset) {
      pos = isX
        ? clamp(pos, this._innerOffset.left, this.getLayoutRect().width - this._innerOffset.right)
        : clamp(pos, this._innerOffset.top, this.getLayoutRect().height - this._innerOffset.bottom);
    }
    const range = this._scale.range();

    if ((pos - range[0]) * (pos - last(range)) > 0) {
      return null;
    }

    return this._scale.invert(pos);
  }

  protected _getTitleLimit(isX: boolean) {
    const titleSpec = this._spec.title;
    if (titleSpec.visible && isNil(titleSpec.style?.maxLineWidth)) {
      const angle = this._axisStyle.title?.angle ?? titleSpec.style?.angle ?? 0;
      if (isX) {
        const width = this.getLayoutRect().width;
        const cosValue = Math.abs(Math.cos(angle));
        // VRender 接收到的limit是考虑角度计算后的宽度
        // TODO：还需要考虑angle后，高度是否太高，综合计算一个limit，比如高度不能超过图表整体高度的1/4
        return cosValue < 1e-6 ? Infinity : width / cosValue;
      }
      const height = this.getLayoutRect().height;
      const sinValue = Math.abs(Math.sin(angle));

      // TODO：还需要考虑angle后，宽度是否太宽，综合计算一个limit，比如宽度度不能超过图表整体宽度的1/4
      return sinValue < 1e-6 ? Infinity : height / sinValue;
    }

    return null;
  }

  protected _getUpdateAttribute(ignoreGrid: boolean) {
    // 获取更新的坐标轴属性
    let regionHeight = 0;
    let regionWidth = 0;

    if (!ignoreGrid) {
      const regionSize = getCombinedSizeOfRegions(this.getRegions());
      regionWidth = regionSize.width;
      regionHeight = regionSize.height;
    }

    const { width, height } = this.getLayoutRect();
    const isX = isXAxis(this._orient);
    const isY = isYAxis(this._orient);
    let end = { x: 0, y: 0 };
    let gridLength = regionHeight;
    let axisLength = width;

    if (isX) {
      end = { x: width, y: 0 };
    } else if (isY) {
      end = { x: 0, y: height };
      gridLength = regionWidth;
      axisLength = height;
    }
    const items = this.getLabelItems(axisLength);
    const attrs: any = {
      start: { x: 0, y: 0 },
      end,
      title: {
        text: this._spec.title.text || this._dataFieldText,
        maxWidth: this._getTitleLimit(isX)
      },
      items,
      scale: this._scale.clone(),
      maxWidth: this._layout.maxWidth,
      minWidth: this._layout.minWidth,
      width: this._spec.width ? this.getLayoutRect().width : undefined
    };
    if (!ignoreGrid) {
      attrs.grid = {
        type: 'line',
        start: { x: 0, y: 0 },
        end,
        items: items[0],
        verticalFactor: this._axisStyle.verticalFactor,
        length: gridLength
      };
    }

    let verticalMinSize = isX ? this.layout.minHeight : this.layout.minWidth;
    if (
      (isX && this._layout.layoutRectLevelMap.height === USER_LAYOUT_RECT_LEVEL) ||
      (isY && this._layout.layoutRectLevelMap.width === USER_LAYOUT_RECT_LEVEL)
    ) {
      verticalMinSize = this._verticalLimitSize;
    }

    attrs.verticalLimitSize = this._verticalLimitSize;
    attrs.verticalMinSize = verticalMinSize;
    attrs.label = {
      overflowLimitLength: this._getLabelOverflowLimit(isX)
    };

    if ((this as any)._afterUpdateAttribute) {
      return (this as any)._afterUpdateAttribute(attrs, ignoreGrid);
    }

    return attrs;
  }

  protected getLabelItems(length: number) {
    const tickLatestData = this.getTickData()?.getLatestData();
    if (tickLatestData && tickLatestData.length) {
      return [
        tickLatestData
          .map((obj: Datum) => {
            const normalizedValue = this._getNormalizedValue([obj.value], length);
            return getAxisItem(obj.value, normalizedValue);
          })
          .filter((entry: AxisItem) => {
            const { value, rawValue } = entry;
            const domain = this._scale.domain();
            if (this.getSpec().type === 'log') {
              return value >= 0 && value <= 1;
            }
            if (isContinuous(this._scale.type)) {
              return rawValue >= domain[0] && rawValue <= last(domain);
            }
            return domain.includes(rawValue);
          })
      ];
    }
    return [];
  }

  protected initEvent() {
    super.initEvent();

    if (this._specVisible) {
      // 过程: dolayout -> getBoundsInRect: update tick attr -> forceLayout ->  updateLayoutAttr: update tick attr -> chart layout -> scale update -> mark encode
      // 问题: chart layout之后, scale发生变化, 导致tick 和 mark position 不同步
      // 解决方案: chart layout 之后重新计算tick位置
      this.event.on(ChartEvent.layoutEnd, this._updateAxisLayout);
      // 布局结束之后处理 0 基线问题
      this.event.on(ChartEvent.layoutEnd, this._fixAxisOnZero);
      // 图表resize后，需要正常布局，清除布局缓存
      this.event.on(ChartEvent.layoutRectUpdate, () => {
        this._clearLayoutCache();
      });
    }
  }

  protected _updateAxisLayout = () => {
    if (!this._visible) {
      this._syncComponentVisibility();
      return;
    }

    const startPoint = this.getLayoutStartPoint();
    const { grid: updateGridAttrs, ...updateAxisAttrs } = this._getUpdateAttribute(false);
    const axisAttrs = mergeSpec({ x: startPoint.x, y: startPoint.y }, this._axisStyle, updateAxisAttrs);
    //axisComponent.setAttributes(axisAttrs);
    this._axisMark.setSimpleStyle(axisAttrs);

    if (this._gridMark) {
      // const gridComponent = this._gridMark.getComponent(); // 获取语法元素

      // gridComponent.setAttributes(
      //   mergeSpec({ x: startPoint.x, y: startPoint.y }, this._getGridAttributes(), updateGridAttrs)
      // );

      this._gridMark.setSimpleStyle(
        mergeSpec({ x: startPoint.x, y: startPoint.y }, this._getGridAttributes(), updateGridAttrs)
      );
    }

    this._syncComponentVisibility();
  };

  protected _getNormalizedValue(values: any[], length: number) {
    return length === 0 ? 0 : this.dataToPosition(values) / length;
  }

  private _fixAxisOnZero = () => {
    // 在布局结束之后调整坐标轴零基线
    const { onZero, visible } = this._spec.domainLine;
    if (this.visible && onZero && visible !== false) {
      const { onZeroAxisId, onZeroAxisIndex } = this._spec.domainLine;
      const axesComponents = this._option.getComponentsByKey('axes') as IAxis[];
      const isX = isXAxis(this.getOrient());

      // 判断坐标轴是否可用
      const isValidAxis = (item: any) => {
        return (
          (isX ? !isXAxis(item.getOrient()) : isXAxis(item.getOrient())) &&
          isContinuous(item.getScale().type) &&
          (item.getTickData()
            ? item
                .getTickData()
                .getLatestData()
                ?.find((d: any) => d.value === 0)
            : item.getScale().domain()[0] <= 0 && last(item.getScale().domain()) >= 0)
        );
      };
      const relativeAxes = axesComponents.filter(item => isValidAxis(item));
      if (relativeAxes.length) {
        let bindAxis;
        if (isValid(onZeroAxisId)) {
          bindAxis = relativeAxes.find(axis => axis.id === onZeroAxisId);
        } else if (isValid(onZeroAxisIndex)) {
          const indexAxis = axesComponents[onZeroAxisIndex];
          if (isValidAxis(indexAxis)) {
            bindAxis = indexAxis;
          }
        } else {
          // 默认绑定第一条的相对坐标轴
          bindAxis = relativeAxes[0];
        }
        if (bindAxis) {
          const axisMark = this._axisMark;
          // 找到了绑定的 axis，获取基线的位置
          const position = bindAxis.valueToPosition(0);
          // 获取偏移量
          if (isX) {
            axisMark.setSimpleStyle({
              ...axisMark.getSimpleStyle(),
              line: {
                ...this._axisStyle.line,
                dy:
                  this._orient === 'bottom'
                    ? -(
                        (bindAxis.getInverse() ? bindAxis.getScale().range()[1] : bindAxis.getScale().range()[0]) -
                        position
                      )
                    : position
              }
            });
          } else {
            axisMark.setSimpleStyle({
              ...axisMark.getSimpleStyle(),
              line: {
                ...this._axisStyle.line,
                dx:
                  this._orient === 'left'
                    ? position
                    : -(
                        (bindAxis.getInverse() ? bindAxis.getScale().range()[0] : bindAxis.getScale().range()[1]) -
                        position
                      )
              }
            });
          }
        }
      }
    }
  };

  protected _layoutCacheProcessing(rect: ILayoutRect) {
    ['width', 'height'].forEach(key => {
      if (rect[key as 'width' | 'height'] < this._layoutCache[key as 'width' | 'height']) {
        rect[key as 'width' | 'height'] = this._layoutCache[key as 'width' | 'height'];
      } else {
        this._layoutCache[key as 'width' | 'height'] = rect[key as 'width' | 'height'];
      }
    });

    // outBounds
    if (this._autoIndentOnce && this._hasAutoIndent) {
      // use cache
      ['x1', 'x2', 'y1', 'y2'].forEach(key => {
        this.layout.getLastComputeOutBounds()[key as 'x1' | 'x2' | 'y1' | 'y2'] =
          this._layoutCache._lastComputeOutBounds[key as 'x1' | 'x2' | 'y1' | 'y2'];
      });
    } else {
      this._hasAutoIndent = true;
      ['x1', 'x2', 'y1', 'y2'].forEach(key => {
        if (
          this.layout.getLastComputeOutBounds()[key as 'x1' | 'x2' | 'y1' | 'y2'] <
          this._layoutCache._lastComputeOutBounds[key as 'x1' | 'x2' | 'y1' | 'y2']
        ) {
          this.layout.getLastComputeOutBounds()[key as 'x1' | 'x2' | 'y1' | 'y2'] =
            this._layoutCache._lastComputeOutBounds[key as 'x1' | 'x2' | 'y1' | 'y2'];
        } else {
          this._layoutCache._lastComputeOutBounds[key as 'x1' | 'x2' | 'y1' | 'y2'] =
            this.layout.getLastComputeOutBounds()[key as 'x1' | 'x2' | 'y1' | 'y2'];
        }
      });
    }

    return rect;
  }

  // 需要在重新设置属性时，更新cache
  reInit(spec?: T): void {
    super.reInit(spec);
    this._clearLayoutCache();
  }

  _clearLayoutCache() {
    this._hasAutoIndent = false;
    this._layoutCache.width = 0;
    this._layoutCache.height = 0;
    this._layoutCache._lastComputeOutBounds = { x1: 0, x2: 0, y1: 0, y2: 0 };
  }

  onDataUpdate(): void {
    // clear layout cache
    this._clearLayoutCache();
  }

  private _appendAxisUnit(bounds: IBounds, isX: boolean) {
    if (this._spec.unit && this._spec.unit.visible) {
      const { text, style } = this._spec.unit;
      let pos;
      let unitTextStyle: any;
      const { x, y } = this.getLayoutStartPoint();
      if (isX) {
        pos = {
          x: maxInArr<number>(this._scale.range()) + x,
          y
        };
        unitTextStyle = {
          textAlign: 'left',
          textBaseline: 'middle'
        };
      } else {
        pos = {
          x,
          y: minInArr<number>(this._scale.range()) + y
        };
        unitTextStyle = {
          textAlign: this._orient === 'left' ? 'left' : 'right',
          textBaseline: 'bottom'
        };
      }

      unitTextStyle = {
        ...unitTextStyle,
        ...style,
        x: pos.x,
        y: pos.y,
        text
      };
      if (this._unitText) {
        this._unitText.setAttributes(unitTextStyle);
      } else {
        this._unitText = createText(unitTextStyle);
        this._unitText.name = 'axis-unit';
        this.getContainer()?.add(this._unitText);
      }

      // 左轴
      const textBounds = this._unitText.AABBBounds;
      if (!isX) {
        bounds.x1 += textBounds.x1 < bounds.x1 ? textBounds.x1 - bounds.x1 : 0;
        bounds.y1 += textBounds.y1 < bounds.y1 ? textBounds.y1 - bounds.y1 : 0;
      } else {
        bounds.x2 += textBounds.x2 > bounds.x2 ? textBounds.x2 - bounds.x2 : 0;
        bounds.y2 += textBounds.y2 > bounds.y2 ? textBounds.y2 - bounds.y2 : 0;
      }
    }

    return bounds;
  }

  protected _getNeedClearVRenderComponents(): IGraphic[] {
    return this._unitText ? [this._unitText] : [];
  }

  private _getLabelOverflowLimit(isX: boolean) {
    if (isX && this._spec.label?.visible !== false && this._spec.label?.autoLimit === true) {
      const axesComponents = this._option.getComponentsByKey('axes') as IAxis[];
      const relativeRegions = this.getRegions();
      const relativeAxes = axesComponents.filter(item => {
        const orient = item.getOrient();
        return (
          (orient === 'left' || orient === 'right') &&
          item.getRegions().some(region => relativeRegions.includes(region))
        );
      });

      let leftLimitLength = 0;
      let rightLimitLength = 0;
      const startX = this.getLayoutStartPoint().x;
      const endX = startX + this.getLayoutRect().width;
      relativeAxes.forEach(axis => {
        const relativeStartX = axis.getLayoutStartPoint().x;
        if (axis.getOrient() === 'left' && relativeStartX === startX) {
          const leftAxisWidth = axis.getLayoutRect().width;
          leftLimitLength = Math.max(leftLimitLength, leftAxisWidth);
        } else if (relativeStartX === endX) {
          const rightAxisWidth = axis.getLayoutRect().width;
          rightLimitLength = Math.max(rightLimitLength, rightAxisWidth);
        }
      });
      return { left: leftLimitLength, right: rightLimitLength };
    }
    return undefined;
  }
}
