import { POLAR_DEFAULT_RADIUS, POLAR_END_RADIAN, POLAR_START_RADIAN } from '../../../constant/polar';
import type { IBaseScale, BandScale } from '@visactor/vscale';
// eslint-disable-next-line no-duplicate-imports
import { isContinuous } from '@visactor/vscale';
import { LayoutZIndex } from '../../../constant/layout';
import type { IPolarAxis, IPolarAxisCommonSpec } from './interface';
import type { IComponentOption } from '../../interface';
// eslint-disable-next-line no-duplicate-imports
import { ComponentTypeEnum } from '../../interface/type';
import { Factory } from '../../../core/factory';
import { eachSeries } from '../../../util/model';
import type { IPolarTickDataOpt } from '@visactor/vrender-components';
// eslint-disable-next-line no-duplicate-imports
import type { IPolarSeries } from '../../../series/interface';
import type {
  IPoint,
  IPolarOrientType,
  IPolarPoint,
  Datum,
  StringOrNumber,
  ILayoutType,
  ILayoutNumber
} from '../../../typings';
import { isPolarAxisSeries } from '../../../series/util/utils';
import { getAxisItem, getAxisLabelOffset, isValidPolarAxis, shouldUpdateAxis } from '../util';
import type { Dict, Maybe } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import {
  PointService,
  degreeToRadian,
  isValid,
  isArray,
  isValidNumber,
  polarToCartesian,
  cartesianToPolar
} from '@visactor/vutils';
import type { IEffect, IModelSpecInfo } from '../../../model/interface';
import { AxisComponent } from '../base-axis';
import type { IBandAxisSpec, ITick } from '../interface';
import { computeLayoutRadius, getPolarAxisInfo } from './util';
// eslint-disable-next-line no-duplicate-imports
import { mergeSpec } from '@visactor/vutils-extension';
import { calcLayoutNumber } from '../../../util/space';

export abstract class PolarAxis<T extends IPolarAxisCommonSpec = IPolarAxisCommonSpec>
  extends AxisComponent<T>
  implements IPolarAxis
{
  static type = ComponentTypeEnum.polarAxis;
  type = ComponentTypeEnum.polarAxis;
  name: string = ComponentTypeEnum.polarAxis;

  static specKey = 'axes';

  protected readonly _defaultBandPosition = 0;
  protected readonly _defaultBandInnerPadding = 0;
  protected readonly _defaultBandOuterPadding = 0;

  layoutType: ILayoutType = 'absolute';
  layoutZIndex: number = LayoutZIndex.Axis;
  protected _tick: ITick | undefined = undefined;

  protected _center: { x: string | number; y: string | number } | null = null;
  get center() {
    return this._center;
  }

  protected _startAngle: number = POLAR_START_RADIAN;
  get startAngle() {
    return this._startAngle;
  }

  protected _endAngle: number = POLAR_END_RADIAN;
  get endAngle() {
    return this._endAngle;
  }

  protected _orient: IPolarOrientType = 'radius';
  getOrient() {
    return this._orient;
  }

  protected getDefaultInteractive() {
    return this._orient !== 'angle';
  }

  protected _groupScales: IBaseScale[] = [];
  getGroupScales() {
    return this._groupScales;
  }

  private _axisStyle: any;
  private _gridStyle: any;

  static getSpecInfo(chartSpec: any): Maybe<IModelSpecInfo[]> {
    if (!chartSpec[this.specKey]) {
      return null;
    }
    const isArraySpec = isArray(chartSpec[this.specKey]);
    const axesSpec = isArraySpec ? chartSpec[this.specKey] : [chartSpec[this.specKey]];
    const specInfos: IModelSpecInfo[] = [];
    let angleAxisIndex: number;
    let radiusAxisIndex: number;
    const radiusAxisSpecInfos: IModelSpecInfo[] = [];
    const angleAxisSpecInfos: IModelSpecInfo[] = [];

    axesSpec.forEach((s: any, i: number) => {
      if (!isValidPolarAxis(s)) {
        return;
      }
      const { axisType, componentName, startAngle, endAngle, center, outerRadius, layoutRadius } = getPolarAxisInfo(
        s,
        chartSpec
      );
      s.center = center;
      s.startAngle = startAngle;
      s.endAngle = endAngle;
      s.outerRadius = outerRadius;
      s.type = axisType;
      s.layoutRadius = layoutRadius;
      const info = {
        spec: s,
        specPath: isArraySpec ? [this.specKey, i] : [this.specKey],
        specInfoPath: ['component', this.specKey, i],
        type: componentName
      };
      specInfos.push(info);
      if (s.orient === 'radius') {
        radiusAxisSpecInfos.push(info);
        radiusAxisIndex = i;
      } else {
        angleAxisSpecInfos.push(info);
        angleAxisIndex = i;
      }
    });
    radiusAxisSpecInfos.forEach(info => {
      (info as any).angleAxisIndex = angleAxisIndex;
    });

    angleAxisSpecInfos.forEach(info => {
      (info as any).radiusAxisIndex = radiusAxisIndex;
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
      }) as IPolarAxis;
    }
    options.onError(`Component ${others.type} not found`);
    return null;
  }

  constructor(spec: T, options: IComponentOption) {
    super(spec, options);

    this._coordinateType = 'polar';
  }

  effect: IEffect = {
    scaleUpdate: param => {
      this.computeData(param?.value);
      eachSeries(
        this._regions,
        s => {
          if (this.getOrient() === 'radius') {
            if (
              shouldUpdateAxis(
                (s as IPolarSeries).radiusAxisHelper,
                this.axisHelper(),
                isValid(this._seriesUserId) || isValid(this._seriesIndex)
              )
            ) {
              (s as IPolarSeries).radiusAxisHelper = this.axisHelper();
            }
          } else {
            if (
              shouldUpdateAxis(
                (s as IPolarSeries).angleAxisHelper,
                this.axisHelper(),
                isValid(this._seriesUserId) || isValid(this._seriesIndex)
              )
            ) {
              (s as IPolarSeries).angleAxisHelper = this.axisHelper();
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

  setAttrFromSpec() {
    super.setAttrFromSpec();

    if (this._specVisible) {
      this._axisStyle = this._getAxisAttributes();
      this._gridStyle = this._getGridAttributes();
    }

    this._tick = this._spec.tick;
    this._orient = this._spec.orient === 'angle' ? 'angle' : 'radius';
    this._center = this._spec.center;
    this._startAngle = degreeToRadian(this._spec.startAngle);
    this._endAngle = degreeToRadian(this._spec.endAngle);
    this._inverse = this._spec.inverse;
  }

  _transformLayoutPosition = (pos: Partial<IPoint>) => {
    const region = this.getRegions()?.[0];
    return region ? region.getLayoutStartPoint() : pos;
  };

  protected _tickTransformOption() {
    return {
      ...super._tickTransformOption(),
      noDecimal: this._tick?.noDecimals,
      startAngle: this.startAngle,
      labelOffset: getAxisLabelOffset(this._spec),
      getRadius: () => this.getOuterRadius(),
      inside: this._spec.inside
    } as IPolarTickDataOpt;
  }

  updateScaleRange() {
    const prevRange = this._scale.range();
    let newRange: [number, number];

    if (this.getOrient() === 'radius') {
      newRange = this._inverse
        ? [this.computeLayoutOuterRadius(), this.computeLayoutInnerRadius()]
        : [this.computeLayoutInnerRadius(), this.computeLayoutOuterRadius()];
    } else {
      newRange = this._inverse ? [this._endAngle, this._startAngle] : [this._startAngle, this._endAngle];
    }

    if (prevRange && newRange && prevRange[0] === newRange[0] && prevRange[1] === newRange[1]) {
      return false;
    }

    this._scale.range(newRange);

    return true;
  }

  protected collectSeriesField(depth: number, series: IPolarSeries) {
    let field: string | string[];

    if (depth > 0) {
      field = series.getGroups()?.fields?.[depth];
    } else {
      field = this.getOrient() === 'radius' ? series.getRadiusField() : series.getAngleField();
    }
    return field;
  }

  protected abstract computeDomain(data: { min: number; max: number; values: any[] }[]): StringOrNumber[];

  protected updateSeriesScale(): void {
    eachSeries(
      this._regions,
      s => {
        if (this.getOrient() === 'radius') {
          if (
            shouldUpdateAxis(
              (s as IPolarSeries).radiusAxisHelper,
              this.axisHelper(),
              isValid(this._seriesUserId) || isValid(this._seriesIndex)
            )
          ) {
            (s as IPolarSeries).setRadiusScale(this._scale);
            (s as IPolarSeries).radiusAxisHelper = this.axisHelper();
          }
        } else {
          if (
            shouldUpdateAxis(
              (s as IPolarSeries).angleAxisHelper,
              this.axisHelper(),
              isValid(this._seriesUserId) || isValid(this._seriesIndex)
            )
          ) {
            (s as IPolarSeries).setAngleScale(this._scale);
            (s as IPolarSeries).angleAxisHelper = this.axisHelper();
          }
        }
      },
      {
        userId: this._seriesUserId,
        specIndex: this._seriesIndex
      }
    );
  }

  protected getSeriesStatisticsField(s: IPolarSeries) {
    const f = this.getOrient() === 'radius' ? s.getRadiusField() : s.getAngleField();
    if (isContinuous(this._scale.type)) {
      return f;
    }
    return [f[0]];
  }

  protected initGroupScales() {
    // do nothing
  }

  // axisHelper
  protected axisHelper() {
    const getScale = (depth: number = 0) => {
      return this._scales[depth];
    };

    const helper = {
      isContinuous: isContinuous(this._scale.type),
      dataToPosition: this.dataToPosition.bind(this),
      coordToPoint: this.coordToPoint.bind(this),
      pointToCoord: this.pointToCoord.bind(this),
      center: this.getCenter.bind(this),
      layoutRadius: this._computeLayoutRadius.bind(this),
      getScale,
      getAxisId: () => this.id,
      getSpec: () => this._spec
    };
    return helper;
  }

  positionToData(position: IPoint) {
    const coord = this.pointToCoord(position);
    if (this.getOrient() === 'radius') {
      return this.invert(coord.radius);
    }
    return this.invert(coord.angle);
  }

  /**
   * 将半径和角度转换为笛卡尔坐标点
   * @param point 角度 & 弧度信息
   * @returns 笛卡尔坐标点 { x, y }
   */
  coordToPoint(point: IPolarPoint): IPoint {
    // center & startAngle 都是坐标系转换的配置，在 scale 中不生效，仅在最终转换时生效
    const center = this.getCenter();

    return polarToCartesian(center, point.radius, point.angle);
  }

  /**
   * 将笛卡尔坐标转换为对应的半径和弧度
   * @param point 笛卡尔坐标点 { x, y }
   * @returns 角度 & 弧度信息 { radius, angle }
   */
  pointToCoord(point: IPoint): IPolarPoint {
    const center = this.getCenter();
    const startAngle = this._startAngle;
    const endAngle = this._endAngle;
    return cartesianToPolar(point, center, startAngle, endAngle);
  }

  /**
   * 获取坐标轴圆心位置
   * @returns 圆心位置
   */
  getCenter = (): IPoint => {
    const layoutRect = this.getRefLayoutRect();
    const { width, height } = layoutRect;

    return {
      x: calcLayoutNumber(this._center?.x as ILayoutNumber, width, layoutRect, width / 2),
      y: calcLayoutNumber(this._center?.y as ILayoutNumber, height, layoutRect, height / 2)
    };
  };

  /**
   * 获取极坐标半径值
   * @returns 半径数值
   */
  getOuterRadius(): number {
    return this.computeLayoutOuterRadius();
  }

  /**
   * 获取极坐标内半径值
   * @returns 内半径数值
   */
  getInnerRadius(): number {
    return this.computeLayoutInnerRadius();
  }

  updateLayoutAttribute(): void {
    if (this._visible) {
      if (this.getOrient() === 'radius') {
        this._layoutRadiusAxis();
      } else {
        this._layoutAngleAxis();
      }
    }

    super.updateLayoutAttribute();
  }

  protected _getNormalizedValue(values: any[], length: number) {
    return length === 0 ? 0 : (this.dataToPosition(values) - this._getStartValue()) / length;
  }

  protected getLabelItems(length: number) {
    const tickLatestData = this.getTickData()?.getLatestData();
    if (tickLatestData && tickLatestData.length) {
      return [
        tickLatestData.map((obj: Datum) => {
          return getAxisItem(obj.value, this._getNormalizedValue([obj.value], length));
        })
      ];
    }
    return [];
  }
  protected _getStartValue() {
    if (this.getOrient() === 'radius') {
      return this.computeLayoutInnerRadius();
    }

    return this._startAngle;
  }

  private _layoutAngleAxis(): void {
    const center = this.getCenter();
    const radius = this.computeLayoutOuterRadius();
    const innerRadius = this.computeLayoutInnerRadius();
    const angleRange = this._endAngle - this._startAngle;
    const items = this.getLabelItems(angleRange);
    const commonAttrs = {
      ...this.getLayoutStartPoint(),
      inside: this._spec.inside,
      center,
      radius,
      innerRadius,
      startAngle: this._startAngle,
      endAngle: this._endAngle,
      layoutRect: this.getRefLayoutRect(),
      autoLabelMaxWidth: this._spec.label?.autoLabelMaxWidth ?? false,
      sides: this._getRelatedAxis((this._option as any).radiusAxisIndex)?.getSpec()?.grid?.smooth
        ? undefined
        : this.getScale().domain().length
    };
    const attrs: any = {
      ...commonAttrs,
      size: this.getRefLayoutRect(),
      title: {
        text: this._spec.title.text || this._dataFieldText
      },
      items,
      orient: 'angle',
      scale: this._scale
    };
    if (this._spec.grid.visible) {
      attrs.grid = {
        type: 'line',
        smoothLink: true,
        items: items[0],
        ...commonAttrs
      };
    }
    this._update(attrs);
  }

  private _layoutRadiusAxis(): void {
    const center = this.getCenter();
    const radius = this.computeLayoutOuterRadius();
    const innerRadius = this.computeLayoutInnerRadius();
    const endPoint = this.coordToPoint({ angle: this._startAngle, radius });
    const startPoint = this.coordToPoint({ angle: this._startAngle, radius: innerRadius });
    const distance = PointService.distancePP(startPoint, endPoint);
    const items = this.getLabelItems(distance);
    const commonAttrs = {
      ...this.getLayoutStartPoint(),
      start: startPoint,
      end: endPoint,
      verticalFactor: -1
    };
    const attrs: any = {
      ...commonAttrs,
      title: {
        text: this._spec.title.text || this._dataFieldText
      },
      items,
      orient: 'radius',
      scale: this._scale.clone()
    };
    if (this._spec.grid?.visible) {
      attrs.grid = {
        items: items[0],
        type: this._spec.grid?.smooth ? 'circle' : 'polygon',
        center,
        closed: true,
        sides: this._getRelatedAxis((this._option as any).angleAxisIndex)
          ?.getScale()
          .domain().length,
        startAngle: this._startAngle,
        endAngle: this._endAngle,
        ...commonAttrs
      };
    }
    this._update(attrs);
  }

  protected _getRelatedAxis(index: number): IPolarAxis | undefined {
    if (isValid(index)) {
      return this._option.getComponentByIndex(this.specKey, index) as IPolarAxis;
    }
    return undefined;
  }

  private _computeLayoutRadius() {
    return computeLayoutRadius(
      () => this._spec.layoutRadius,
      this.getRefLayoutRect,
      this.getCenter,
      () => ({ startAngle: this._startAngle, endAngle: this._endAngle })
    );
  }

  private computeLayoutOuterRadius() {
    /**
     * 兼容radius旧配置
     * @deprecated use outerRadius instead
     */
    const radius = this._spec.outerRadius ?? this._spec.radius;
    const outerRadius = radius ?? this.getRefSeriesRadius().outerRadius;
    return this._computeLayoutRadius() * outerRadius;
  }

  private computeLayoutInnerRadius() {
    const innerRadius = this._spec.innerRadius ?? this.getRefSeriesRadius().innerRadius;
    return this._computeLayoutRadius() * innerRadius;
  }

  private getRefLayoutRect = () => {
    return this.getRegions()[0].getLayoutRect();
  };

  private getRefSeriesRadius() {
    let outerRadius: number = POLAR_DEFAULT_RADIUS;
    let innerRadius: number = 0;
    const chartSpec = this.getChart().getSpec() as any;
    // FIXME: 为了保证 common 图表能够应用系列的 radius 配置，当前从相应的 region 中取到 radius 信息
    eachSeries(
      this.getRegions(),
      s => {
        const series = s as IPolarSeries;
        if (isPolarAxisSeries(series.type)) {
          const {
            outerRadius: seriesRadius = chartSpec.outerRadius,
            innerRadius: seriesInnerRadius = chartSpec.innerRadius
          } = series;
          if (isValidNumber(seriesRadius)) {
            outerRadius = seriesRadius;
          }
          if (isValidNumber(seriesInnerRadius)) {
            innerRadius = seriesInnerRadius;
          }
        }
      },
      {
        userId: this._seriesUserId,
        specIndex: this._seriesIndex
      }
    );
    return { outerRadius, innerRadius };
  }

  private _update(attrs: Dict<unknown>) {
    const { grid: gridAttrs, ...axisAttrs } = attrs;
    const axisProduct = this._axisMark.getComponent(); // 获取语法元素并更新
    axisProduct.setAttributes(mergeSpec({}, this._axisStyle, axisAttrs));

    if (this._gridMark) {
      const gridProduct = this._gridMark.getComponent(); // 获取语法元素并更新
      gridProduct.setAttributes(mergeSpec({}, this._gridStyle, gridAttrs));
    }
  }

  invert(value: number): number {
    if (this.getOrient() === 'angle' && this._scale.type === 'band') {
      //极坐标轴需要手动取模，超出range时默认会截断
      const range = this._scale.range();
      const rangeValue = range[range.length - 1] - range[0];
      const bandPosition = (this.getSpec() as IBandAxisSpec).bandPosition ?? this._defaultBandPosition;
      const offset = bandPosition === 0.5 ? 0 : (this._scale as BandScale).bandwidth() / 2;
      if (range[0] < 0) {
        const angle = value + offset;
        const transformedAngle = ((angle + Math.abs(range[0])) % rangeValue) - Math.abs(range[0]);
        return this._scale.invert(transformedAngle);
      }
      return this._scale.invert((value + offset) % rangeValue);
    }

    return this._scale.invert(value);
  }
}
