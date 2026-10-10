import { BandScale } from '@visactor/vscale';
import { ComponentTypeEnum } from '../../interface/type';
import { PolarAxis } from './axis';
import { mixin } from '@visactor/vutils';
import { BandAxisMixin } from '../mixin/band-axis-mixin';
import type { StringOrNumber } from '../../../typings';
import type { IPolarBandAxisSpec } from './interface';
import { Factory } from '../../../core/factory';
import { registerAxis } from '../base-axis';
import { registerDataSetInstanceTransform } from '../../../data/register';
import {
  CircleAxis,
  CircleAxisGrid,
  LineAxis,
  LineAxisGrid,
  polarAngleAxisDiscreteTicks
} from '@visactor/vrender-components';
import type { IGroup } from '@visactor/vrender-core';
import type { VRenderComponentOptions } from '../../../core/interface';
import { GridEnum, AxisEnum } from '../interface';
import { commonAxis } from '../../../theme/builtin/common/component/axis/common-axis';
import { axisBand } from '../../../theme/builtin/common/component/axis/band-axis';
import { axisAngle, axisRadius } from '../../../theme/builtin/common/component/axis/polar-axis';

export interface PolarBandAxis<T extends IPolarBandAxisSpec = IPolarBandAxisSpec>
  extends Pick<
      BandAxisMixin,
      'valueToPosition' | 'updateGroupScaleRange' | 'getPosition' | 'calcScales' | 'computeBandDomain'
    >,
    PolarAxis<T> {}

export class PolarBandAxis<T extends IPolarBandAxisSpec = IPolarBandAxisSpec> extends PolarAxis<T> {
  static type = ComponentTypeEnum.polarBandAxis;
  type = ComponentTypeEnum.polarBandAxis;

  static specKey = 'axes';
  static readonly builtInTheme = {
    axis: commonAxis,
    axisBand,
    axisAngle,
    axisRadius
  };

  protected _scale: BandScale = new BandScale();

  protected declare _scales: BandScale[];
  protected declare _updateData: () => void;

  protected computeDomain(data: { min: number; max: number; values: any[] }[]): StringOrNumber[] {
    return this.computeBandDomain(data);
  }

  updateScaleRange() {
    const isChanged = super.updateScaleRange();
    this.updateGroupScaleRange();

    return isChanged;
  }

  // axisHelper
  protected axisHelper() {
    const helper = super.axisHelper();
    const getBandwidth = (depth: number) => {
      return (helper.getScale(depth) as BandScale).bandwidth();
    };

    return { ...helper, getBandwidth };
  }

  protected initScales() {
    super.initScales();
    this.calcScales(this._defaultBandInnerPadding, this._defaultBandOuterPadding);
  }

  reInit(spec?: T): void {
    super.reInit(spec);

    this._updateData();
  }

  protected registerTicksTransform() {
    const name = `${this.type}-ticks`;
    registerDataSetInstanceTransform(this._option.dataSet, name, polarAngleAxisDiscreteTicks);
    return name;
  }
  transformScaleDomain() {
    // do nothing
  }
}
mixin(PolarBandAxis, BandAxisMixin);

export const registerPolarBandAxis = () => {
  Factory.registerGraphicComponent(AxisEnum.lineAxis, (attrs: any, options: VRenderComponentOptions) => {
    return new LineAxis(attrs, options) as unknown as IGroup;
  });
  Factory.registerGraphicComponent(GridEnum.lineAxisGrid, (attrs: any, options: VRenderComponentOptions) => {
    return new LineAxisGrid(attrs, options) as unknown as IGroup;
  });

  Factory.registerGraphicComponent(AxisEnum.circleAxis, (attrs: any, options: VRenderComponentOptions) => {
    return new CircleAxis(attrs, options) as unknown as IGroup;
  });
  Factory.registerGraphicComponent(GridEnum.circleAxisGrid, (attrs: any, options: VRenderComponentOptions) => {
    return new CircleAxisGrid(attrs, options) as unknown as IGroup;
  });
  registerAxis();
  Factory.registerComponent(PolarBandAxis.type, PolarBandAxis);
};
