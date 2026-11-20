import { LinearScale } from '@visactor/vscale';
import { ComponentTypeEnum } from '../../interface/type';
import { PolarAxis } from './axis';
import type { IPolarLinearAxisSpec } from './interface/spec';
import { LinearAxisMixin } from '../mixin/linear-axis-mixin';
import { mixin } from '@visactor/vutils';
import { Factory } from '../../../core/factory';
import { registerAxis } from '../base-axis';
import type { IPolarAxisHelper } from './interface';
import { CircleAxis, CircleAxisGrid, continuousTicks, LineAxis, LineAxisGrid } from '@visactor/vrender-components';
import { registerDataSetInstanceTransform } from '../../../data/register';
import type { IGroup } from '@visactor/vrender-core';
import type { VRenderComponentOptions } from '../../../core/interface';
import { GridEnum, AxisEnum } from '../interface';
import { axisLinear } from '../../../theme/builtin/common/component/axis/linear-axis';
import { commonAxis } from '../../../theme/builtin/common/component/axis/common-axis';
import { axisAngle, axisRadius } from '../../../theme/builtin/common/component/axis/polar-axis';

export interface PolarLinearAxis<T extends IPolarLinearAxisSpec = IPolarLinearAxisSpec>
  extends Pick<
      LinearAxisMixin,
      | 'setExtraAttrFromSpec'
      | 'transformScaleDomain'
      | 'valueToPosition'
      | 'computeLinearDomain'
      | 'setScaleNice'
      | 'setExtendDomain'
    >,
    PolarAxis<T> {}

export class PolarLinearAxis<T extends IPolarLinearAxisSpec = IPolarLinearAxisSpec> extends PolarAxis<T> {
  static type = ComponentTypeEnum.polarLinearAxis;
  type = ComponentTypeEnum.polarLinearAxis;

  static specKey = 'axes';
  static readonly builtInTheme = {
    axis: commonAxis,
    axisLinear,
    axisAngle,
    axisRadius
  };

  protected _zero: boolean = true;
  protected _nice: boolean = true;
  protected _extend: { [key: string]: number } = {};

  protected _scale = new LinearScale();
  protected declare _groupScales: LinearScale[];

  setAttrFromSpec(): void {
    super.setAttrFromSpec();
    this.setExtraAttrFromSpec();
    const tickTransform = this._tickData?.[0]
      ?.getDataView()
      .transformsArr.find(t => t.type === this.registerTicksTransform());
    tickTransform && (tickTransform.options = this._tickTransformOption());
  }

  protected initScales() {
    super.initScales();
    this.setScaleNice();
  }

  protected computeDomain(data: { min: number; max: number; values: any[] }[]): number[] {
    return this.computeLinearDomain(data);
  }

  protected axisHelper() {
    const helper: IPolarAxisHelper = super.axisHelper();
    helper.setExtendDomain = this.setExtendDomain.bind(this);
    return helper as any;
  }

  protected registerTicksTransform() {
    const name = `${this.type}-ticks`;
    registerDataSetInstanceTransform(this._option.dataSet, name, continuousTicks);

    return name;
  }
}

mixin(PolarLinearAxis, LinearAxisMixin);

export const registerPolarLinearAxis = () => {
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
  Factory.registerComponent(PolarLinearAxis.type, PolarLinearAxis);
};
