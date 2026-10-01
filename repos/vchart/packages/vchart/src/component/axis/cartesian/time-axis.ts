import type { IEffect } from '../../../model/interface';
import { DataView } from '@visactor/vdataset';
import { isXAxis } from './util/common';
import { isValid, TimeUtil } from '@visactor/vutils';
import { eachSeries } from '../../../util/model';
import type { ICartesianSeries } from '../../../series/interface';
import { CartesianLinearAxis } from './linear-axis';
import type { ICartesianTickDataOpt } from '@visactor/vrender-components';
import { ComponentTypeEnum } from '../../interface/type';
import type { Datum } from '../../../typings';
import { CompilableData } from '../../../compile/data/compilable-data';
import type { LinearAxisMixin } from '../mixin/linear-axis-mixin';
import type { ICartesianTimeAxisSpec } from './interface';
import { Factory } from '../../../core/factory';
import { registerAxis } from '../base-axis';
import { getAxisItem, shouldUpdateAxis } from '../util';
// eslint-disable-next-line no-duplicate-imports
import { mergeSpec } from '@visactor/vutils-extension';
import { continuousTicks, LineAxis, LineAxisGrid } from '@visactor/vrender-components';
import { registerDataSetInstanceTransform } from '../../../data/register';
import type { IGroup } from '@visactor/vrender-core';
import type { VRenderComponentOptions } from '../../../core/interface';
import { AxisEnum, GridEnum } from '../interface/common';
import { commonAxis } from '../../../theme/builtin/common/component/axis/common-axis';
import { axisX, axisY } from '../../../theme/builtin/common/component/axis/cartesian-axis';

export interface CartesianTimeAxis<T extends ICartesianTimeAxisSpec = ICartesianTimeAxisSpec>
  extends Pick<LinearAxisMixin, 'valueToPosition'>,
    CartesianLinearAxis<T> {}

export class CartesianTimeAxis<
  T extends ICartesianTimeAxisSpec = ICartesianTimeAxisSpec
> extends CartesianLinearAxis<T> {
  static type = ComponentTypeEnum.cartesianTimeAxis;
  type = ComponentTypeEnum.cartesianTimeAxis;

  static specKey = 'axes';
  static readonly builtInTheme = {
    axis: commonAxis,
    axisX,
    axisY
  };

  protected _layerTickData!: CompilableData;

  protected _zero: boolean = false;

  effect: IEffect = {
    scaleUpdate: params => {
      this.computeData(params?.value);
      eachSeries(
        this._regions,
        s => {
          if (isXAxis(this.getOrient())) {
            if (
              shouldUpdateAxis(
                (s as ICartesianSeries).getXAxisHelper(),
                this.axisHelper(),
                isValid(this._seriesUserId) || isValid(this._seriesIndex)
              )
            ) {
              (s as ICartesianSeries).setXAxisHelper(this.axisHelper());
            }
          } else {
            if (
              shouldUpdateAxis(
                (s as ICartesianSeries).getYAxisHelper(),
                this.axisHelper(),
                isValid(this._seriesUserId) || isValid(this._seriesIndex)
              )
            ) {
              (s as ICartesianSeries).setYAxisHelper(this.axisHelper());
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
    this._tick = mergeSpec({}, this._spec.tick, this._spec.layers?.[0]);
  }

  protected _initData() {
    super._initData();

    // 如果layer数组的第二项未配置，则不显示第二层
    if (this._spec.layers?.[1]) {
      const layerTickData = new DataView(this._option.dataSet, { name: `${this.type}_${this.id}_layer_1_ticks` })
        .parse(this._scale, {
          type: 'scale'
        })
        .transform(
          {
            type: `${this.type}-ticks`,
            options: {
              ...this._tickTransformOption(),
              tickCount: this._spec.layers[1].tickCount,
              forceTickCount: this._spec.layers[1].forceTickCount,
              tickStep: this._spec.layers[1].tickStep
            } as ICartesianTickDataOpt
          },
          false
        );
      this._layerTickData = new CompilableData(this._option, layerTickData);
    }
  }

  /**
   * @override
   */
  protected computeData(updateType?: 'range' | 'domain' | 'force'): void {
    super.computeData(updateType);
    if (this._layerTickData) {
      this._layerTickData.getDataView().reRunAllTransform();
      this._layerTickData.updateData();
    }
  }

  created() {
    super.created();
    if (this._layerTickData) {
      if (this._axisMark) {
        this._layerTickData.addRelatedMark(this._axisMark);
      }

      if (this._gridMark) {
        this._layerTickData.addRelatedMark(this._gridMark);
      }
    }
  }

  protected _getLabelFormatMethod(): any {
    const timeUtil = TimeUtil.getInstance();
    const timeFormat1 = this._spec.layers?.[1]?.timeFormat || '%Y%m%d';
    const timeFormatMode1 = this._spec.layers?.[1]?.timeFormatMode || 'local';
    const timeFormatter1 = timeFormatMode1 === 'local' ? timeUtil.timeFormat : timeUtil.timeUTCFormat;

    const timeFormat0 = this._spec.layers?.[0]?.timeFormat || '%Y%m%d';
    const timeFormatMode0 = this._spec.layers?.[0]?.timeFormatMode || 'local';
    const timeFormatter0 = timeFormatMode0 === 'local' ? timeUtil.timeFormat : timeUtil.timeUTCFormat;

    return (value: any, datum: any, index: number, data: any[], layer: number) => {
      let timeValue: string;
      if (layer === 0) {
        timeValue = timeFormatter0(timeFormat0, value);
      } else {
        timeValue = timeFormatter1(timeFormat1, value);
      }

      return this._spec.label?.formatMethod ? this._spec.label.formatMethod(timeValue, datum) : timeValue;
    };
  }

  protected getLabelItems(length: number) {
    const items = [];

    const tickLatestData = this.getTickData()?.getLatestData();
    if (tickLatestData && tickLatestData.length) {
      items.push(
        tickLatestData.map((obj: Datum) => {
          return getAxisItem(obj.value, this._getNormalizedValue([obj.value], length));
        })
      );
    }

    const layerLatestData = this._layerTickData?.getLatestData();
    if (layerLatestData && layerLatestData.length) {
      items.push(
        layerLatestData.map((obj: Datum) => {
          return getAxisItem(obj.value, this._getNormalizedValue([obj.value], length));
        })
      );
    }

    return items;
  }

  protected registerTicksTransform() {
    const name = `${this.type}-ticks`;
    registerDataSetInstanceTransform(this._option.dataSet, name, continuousTicks);

    return name;
  }
  transformScaleDomain() {
    // do nothing
  }
}

export const registerCartesianTimeAxis = () => {
  Factory.registerGraphicComponent(AxisEnum.lineAxis, (attrs: any, options: VRenderComponentOptions) => {
    return new LineAxis(attrs, options) as unknown as IGroup;
  });
  Factory.registerGraphicComponent(GridEnum.lineAxisGrid, (attrs: any, options: VRenderComponentOptions) => {
    return new LineAxisGrid(attrs, options) as unknown as IGroup;
  });
  registerAxis();
  Factory.registerComponent(CartesianTimeAxis.type, CartesianTimeAxis);
};
