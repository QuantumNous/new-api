import type { ICartesianSeries } from '../interface';
import { BaseSeries } from '../base/base-series';
import type { IPoint } from '../../typings/coordinate';
import type { IBaseScale } from '@visactor/vscale';
import {
  STACK_FIELD_END,
  STACK_FIELD_END_PERCENT,
  STACK_FIELD_END_OffsetSilhouette,
  STACK_FIELD_START,
  STACK_FIELD_START_PERCENT,
  STACK_FIELD_START_OffsetSilhouette
} from '../../constant/data';
import type { IAxisHelper } from '../../component/axis/cartesian/interface';
import type { DirectionType } from '../../typings/space';
// eslint-disable-next-line no-duplicate-imports
import { Direction } from '../../typings/space';
import type { Datum, StringOrNumber } from '../../typings';
import { array, isValid } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import { isContinuous } from '@visactor/vscale';
import type { ICartesianSeriesSpec } from './interface';
import { sortDataInAxisHelper } from '../util/utils';
import type { IAxisLocationCfg } from '../../component/axis';
import { ComponentTypeEnum } from '../../component/interface/type';
import { ChartEvent } from '../../constant/event';
import { PREFIX } from '../../constant/base';
import type { StatisticOperations } from '../../data/transforms/interface';

export abstract class CartesianSeries<T extends ICartesianSeriesSpec = ICartesianSeriesSpec>
  extends BaseSeries<T>
  implements ICartesianSeries
{
  readonly coordinate: 'cartesian' = 'cartesian';
  protected _bandPosition = 0.5;
  protected _scaleConfig: IAxisLocationCfg = {
    bandPosition: this._bandPosition
  };
  protected _buildScaleConfig() {
    this._scaleConfig = {
      bandPosition: this._bandPosition
    };
  }

  protected _fieldX!: string[];
  get fieldX() {
    return this._fieldX;
  }
  setFieldX(f: string | string[]) {
    this._fieldX = array(f);
  }

  protected _fieldY!: string[];
  get fieldY() {
    return this._fieldY;
  }
  setFieldY(f: string | string[]) {
    this._fieldY = array(f);
  }

  protected _fieldZ?: string[];
  get fieldZ(): string[] | undefined {
    return this._fieldZ;
  }
  setFieldZ(f?: string | string[]) {
    this._fieldZ = f && array(f);
  }

  protected _fieldX2!: string;
  get fieldX2() {
    return this._fieldX2;
  }
  setFieldX2(f: string) {
    this._fieldX2 = f;
  }

  protected _fieldY2!: string;
  get fieldY2() {
    return this._fieldY2;
  }
  setFieldY2(f: string) {
    this._fieldY2 = f;
  }

  protected _specXField: string[];
  protected _specYField: string[];

  protected _direction: DirectionType = Direction.vertical;
  get direction() {
    return this._direction;
  }

  protected _scaleX!: IBaseScale;
  get scaleX() {
    return this._scaleX;
  }
  setScaleX(s: IBaseScale) {
    this._scaleX = s;
  }

  protected _scaleY!: IBaseScale;
  get scaleY() {
    return this._scaleY;
  }
  setScaleY(s: IBaseScale) {
    this._scaleY = s;
  }

  protected _scaleZ?: IBaseScale;
  get scaleZ() {
    return this._scaleZ;
  }
  setScaleZ(s: IBaseScale) {
    this._scaleZ = s;
  }

  _xAxisHelper!: IAxisHelper;
  getXAxisHelper() {
    return this._xAxisHelper;
  }
  setXAxisHelper(h: IAxisHelper) {
    this._xAxisHelper = h;
    this.onXAxisHelperUpdate();
  }

  _yAxisHelper!: IAxisHelper;
  getYAxisHelper() {
    return this._yAxisHelper;
  }
  setYAxisHelper(h: IAxisHelper) {
    this._yAxisHelper = h;
    this.onYAxisHelperUpdate();
  }

  _zAxisHelper?: IAxisHelper;
  getZAxisHelper() {
    return this._zAxisHelper;
  }
  setZAxisHelper(h: IAxisHelper) {
    this._zAxisHelper = h;
    this.onYAxisHelperUpdate();
  }

  protected _sortDataByAxis: boolean = false;
  get sortDataByAxis() {
    return this._sortDataByAxis;
  }

  getStatisticFields() {
    const fields: { key: string; operations: StatisticOperations }[] = [];
    const axes = [
      {
        axisHelper: this.getXAxisHelper(),
        fields: this._fieldX2 ? [...this._fieldX, this._fieldX2] : this._fieldX
      },
      {
        axisHelper: this.getYAxisHelper(),
        fields: this._fieldY2 ? [...this._fieldY, this._fieldY2] : this._fieldY
      },
      {
        axisHelper: this.getZAxisHelper(),
        fields: this._fieldZ
      }
    ];

    axes.forEach(axisOption => {
      if (axisOption.axisHelper && axisOption.axisHelper.getScale && axisOption.fields) {
        axisOption.fields.forEach(f => {
          const result: { key: string; operations: Array<'max' | 'min' | 'values'>; filter?: (fv: any) => boolean } = {
            key: f,
            operations: []
          };
          const scale = axisOption.axisHelper.getScale(0);
          if (isContinuous(scale.type)) {
            result.operations = ['max', 'min'];

            if (scale.type === 'log') {
              result.filter = (fv: any) => fv > 0;
            }
          } else {
            result.operations = ['values'];
          }
          fields.push(result);
        });
      }
    });

    if (this.getStack()) {
      fields.push({
        key: this.getStackValueField(),
        operations: ['allValid']
      });
    }
    return fields;
  }

  getGroupFields() {
    return this.direction === 'vertical' ? this._fieldX : this._fieldY;
  }

  getStackGroupFields(): string[] {
    return this.getGroupFields();
  }

  getStackValue() {
    const axisId = (
      this.direction === Direction.horizontal ? this.getXAxisHelper() : this.getYAxisHelper()
    )?.getAxisId();
    return this._spec.stackValue ?? `${PREFIX}_series_${this.type}_${axisId}`;
  }

  getStackValueField() {
    // TODO: hack
    if (this.direction === Direction.horizontal) {
      return array(this._spec.xField)[0];
    }
    return array(this._spec.yField)[0];
  }

  setValueFieldToStack(): void {
    if (this.direction === Direction.horizontal) {
      this.setFieldX(STACK_FIELD_END);
      this.setFieldX2(STACK_FIELD_START);
    } else {
      this.setFieldY(STACK_FIELD_END);
      this.setFieldY2(STACK_FIELD_START);
    }
  }

  setValueFieldToPercent(): void {
    if (this.direction === Direction.horizontal) {
      this.setFieldX(STACK_FIELD_END_PERCENT);
      this.setFieldX2(STACK_FIELD_START_PERCENT);
    } else {
      this.setFieldY(STACK_FIELD_END_PERCENT);
      this.setFieldY2(STACK_FIELD_START_PERCENT);
    }
  }

  setValueFieldToStackOffsetSilhouette(): void {
    if (this.direction === Direction.horizontal) {
      this.setFieldX(STACK_FIELD_END_OffsetSilhouette);
      this.setFieldX2(STACK_FIELD_START_OffsetSilhouette);
    } else {
      this.setFieldY(STACK_FIELD_END_OffsetSilhouette);
      this.setFieldY2(STACK_FIELD_START_OffsetSilhouette);
    }
  }

  onXAxisHelperUpdate(): void {
    this.onMarkPositionUpdate();
  }

  onYAxisHelperUpdate(): void {
    this.onMarkPositionUpdate();
  }

  onZAxisHelperUpdate(): void {
    this.onMarkPositionUpdate();
  }

  setAttrFromSpec() {
    super.setAttrFromSpec();
    this.setFieldX(this._spec.xField);
    this.setFieldY(this._spec.yField);
    this.setFieldZ(this._spec.zField);
    this._specXField = array(this._spec.xField);
    this._specYField = array(this._spec.yField);
    if (isValid(this._spec.direction)) {
      this._direction = this._spec.direction;
    }

    this.setFieldX2(this._spec?.x2Field);
    this.setFieldY2(this._spec?.y2Field);

    if (this.getStack()) {
      this.setValueFieldToStack();
    }
    if (this.getPercent()) {
      this.setValueFieldToPercent();
    }
    if (this.getStackOffsetSilhouette()) {
      this.setValueFieldToStackOffsetSilhouette();
    }

    if (isValid(this._spec.sortDataByAxis)) {
      this._sortDataByAxis = this._spec.sortDataByAxis === true;
    }
  }

  dataToPosition(datum: Datum, checkInViewData?: boolean): IPoint | null {
    if (!datum) {
      return null;
    }
    if (checkInViewData && !this.isDatumInViewData(datum)) {
      return null;
    }
    return {
      x: this.dataToPositionX(datum),
      y: this.dataToPositionY(datum)
    } as IPoint;
  }

  protected _buildMarkAttributeContext() {
    super._buildMarkAttributeContext();
    // position
    this._markAttributeContext.valueToX = this.valueToPositionX.bind(this);
    this._markAttributeContext.valueToY = this.valueToPositionY.bind(this);
    this._markAttributeContext.xBandwidth = (depth: number = 0) => this.getXAxisHelper().getBandwidth?.(depth) ?? 0;
    this._markAttributeContext.yBandwidth = (depth: number = 0) => this.getYAxisHelper().getBandwidth?.(depth) ?? 0;
    this._markAttributeContext.valueToPosition = this.valueToPosition.bind(this);
  }

  valueToPosition(xValue: StringOrNumber | StringOrNumber[], yValue: StringOrNumber | StringOrNumber[]) {
    return {
      x: this.valueToPositionX(xValue),
      y: this.valueToPositionY(yValue)
    };
  }

  protected _axisPosition(helper: IAxisHelper, value: StringOrNumber | StringOrNumber[], datum?: any) {
    this._scaleConfig.datum = datum;
    if (helper.isContinuous) {
      return helper.valueToPosition(value, this._scaleConfig);
    }
    return helper.dataToPosition(array(value), this._scaleConfig);
  }

  valueToPositionX(value: StringOrNumber | StringOrNumber[], datum?: any) {
    return this._axisPosition(this._xAxisHelper, value, datum);
  }
  valueToPositionY(value: StringOrNumber | StringOrNumber[], datum?: any) {
    return this._axisPosition(this._yAxisHelper, value, datum);
  }

  protected _dataToPosition(
    datum: Datum,
    axisHelper: IAxisHelper,
    field: string[],
    scaleDepth: number | undefined,
    getEncoder: () => (datum: Datum) => number,
    setEncoder: (encoder: (datum: Datum) => number) => void
  ): number {
    const encoder = getEncoder();
    if (encoder) {
      return encoder(datum);
    }

    if (!axisHelper) {
      setEncoder((datum: Datum) => Number.NaN);
      return Number.NaN;
    }
    const fields = (axisHelper.getFields ? axisHelper.getFields() : field).slice(0, scaleDepth);
    if (!fields || fields.length === 0) {
      setEncoder((datum: Datum) => null);
      return null;
    }

    if (axisHelper.isContinuous) {
      setEncoder((datum: Datum) => {
        this._scaleConfig.datum = datum;
        return axisHelper.valueToPosition(this.getDatumPositionValue(datum, fields[0]), this._scaleConfig);
      });
    } else {
      setEncoder((datum: Datum) => {
        this._scaleConfig.datum = datum;
        return axisHelper.dataToPosition(array(this.getDatumPositionValues(datum, fields)), this._scaleConfig);
      });
    }

    return getEncoder()(datum);
  }

  protected _positionXEncoder?: (datum: Datum) => number;
  protected _getPositionXEncoder = () => this._positionXEncoder?.bind(this);
  protected _setPositionXEncoder = (encoder: (datum: Datum) => number) => {
    this._positionXEncoder = encoder.bind(this);
  };

  dataToPositionX(datum: Datum): number {
    return this._dataToPosition(
      datum,
      this._xAxisHelper,
      this.fieldX,
      undefined,
      this._getPositionXEncoder,
      this._setPositionXEncoder
    );
  }

  protected _positionYEncoder?: (datum: Datum) => number;
  protected _getPositionYEncoder = () => this._positionYEncoder?.bind(this);
  protected _setPositionYEncoder = (encoder: (datum: Datum) => number) => {
    this._positionYEncoder = encoder.bind(this);
  };

  dataToPositionY(datum: Datum): number {
    return this._dataToPosition(
      datum,
      this._yAxisHelper,
      this.fieldY,
      undefined,
      this._getPositionYEncoder,
      this._setPositionYEncoder
    );
  }

  dataToPositionZ(datum: Datum): number {
    if (!this._zAxisHelper) {
      return Number.NaN;
    }
    const { dataToPosition } = this._zAxisHelper;

    return dataToPosition(this.getDatumPositionValues(datum, this._fieldZ), {
      bandPosition: this._bandPosition
    });
  }

  dataToPositionX1(datum: Datum): number {
    if (!this._xAxisHelper) {
      return Number.NaN;
    }
    return this._fieldX2 && this._fieldX2 in datum
      ? this.valueToPositionX(this.getDatumPositionValues(datum, this._fieldX2))
      : this.valueToPositionX(0);
  }

  dataToPositionY1(datum: Datum): number {
    if (!this._yAxisHelper) {
      return Number.NaN;
    }
    return this._fieldY2 && this._fieldY2 in datum
      ? this.valueToPositionY(this.getDatumPositionValues(datum, this._fieldY2))
      : this.valueToPositionY(0);
  }

  positionToData(p: IPoint): IPoint | null {
    if (!p) {
      return null;
    }
    return {
      x: this.positionToDataX(p.x),
      y: this.positionToDataY(p.y)
    };
  }

  positionToDataX(xPos: number): any | null {
    if (!this._scaleX) {
      return null;
    }
    return this._scaleX.invert(xPos);
  }

  positionToDataY(yPos: number): any | null {
    if (!this._scaleY) {
      return null;
    }
    return this._scaleY.invert(yPos);
  }

  getRegionRectLeft(): number {
    if (!this._xAxisHelper) {
      return Number.NaN;
    }
    const { getScale } = this._xAxisHelper;
    return getScale(0).range()[0];
  }

  getRegionRectRight(): number {
    if (!this._xAxisHelper) {
      return Number.NaN;
    }
    const { getScale } = this._xAxisHelper;
    return getScale(0).range()[1];
  }

  afterInitMark(): void {
    super.afterInitMark();
    this.setFieldX(this._fieldX);
    this.setFieldY(this._fieldY);
    this._buildScaleConfig();
  }

  getDimensionField(): string[] {
    if (this._direction === Direction.horizontal) {
      return this._specYField;
    }
    return this._specXField;
  }

  getDimensionContinuousField(): string[] {
    if (this._direction === Direction.horizontal) {
      return [this.fieldY[0], this.fieldY2];
    }
    return [this.fieldX[0], this.fieldX2];
  }

  getMeasureField(): string[] {
    if (this._direction === Direction.horizontal) {
      return this._specXField;
    }
    return this._specYField;
  }

  protected initEvent() {
    super.initEvent();
    // 通过轴事件来进行排序。轴的domain数据变化在系列的统计数据完成后
    if (this.sortDataByAxis) {
      this.event.on(
        ChartEvent.scaleDomainUpdate,
        {
          filter: param =>
            param.model.id ===
            (this._direction === Direction.horizontal ? this._yAxisHelper : this._xAxisHelper)?.getAxisId()
        },
        () => {
          // 只能排序，不能修改数据，此时已经在数据流的统计流程之后
          this._sortDataInAxisDomain();
        }
      );
    }
  }

  _sortDataInAxisDomain() {
    if (this.getViewData()?.latestData?.length) {
      sortDataInAxisHelper(
        this._direction === Direction.horizontal ? this._yAxisHelper : this._xAxisHelper,
        this._direction === Direction.horizontal ? this._fieldY[0] : this._fieldX[0],
        this.getViewData().latestData
      );
      this._data?.updateData(true);
    }
  }

  protected getInvalidCheckFields() {
    const fields: string[] = [];

    if (
      this._xAxisHelper &&
      this._xAxisHelper.isContinuous &&
      this._xAxisHelper.getAxisType() !== ComponentTypeEnum.geoCoordinate
    ) {
      const xFields = this._xAxisHelper.getFields ? this._xAxisHelper.getFields() : this._specXField;
      xFields.forEach(f => {
        fields.push(f);
      });
    }

    if (
      this._yAxisHelper &&
      this._yAxisHelper.isContinuous &&
      this._yAxisHelper.getAxisType() !== ComponentTypeEnum.geoCoordinate
    ) {
      const yFields = this._yAxisHelper.getFields ? this._yAxisHelper.getFields() : this._specYField;

      yFields.forEach(f => {
        fields.push(f);
      });
    }
    return fields;
  }

  reInit(spec: T) {
    if (this._positionXEncoder) {
      this._positionXEncoder = null;
    }
    if (this._positionYEncoder) {
      this._positionYEncoder = null;
    }

    super.reInit(spec);
  }
}
