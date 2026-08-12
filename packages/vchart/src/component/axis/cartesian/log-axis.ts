import { CartesianLinearAxis } from './linear-axis';
import { ComponentTypeEnum } from '../../interface/type';
import { LinearAxisMixin } from '../mixin/linear-axis-mixin';
import { LogScale } from '@visactor/vscale';
import { mixin } from '@visactor/vutils';
import type { ICartesianLogAxisSpec } from './interface';
import { Factory } from '../../../core/factory';
import { registerAxis } from '../base-axis';
import { continuousTicks, LineAxis, LineAxisGrid } from '@visactor/vrender-components';
import { registerDataSetInstanceTransform } from '../../../data/register';
import type { VRenderComponentOptions } from '../../../core/interface';
import type { IGroup } from '@visactor/vrender-core';
import { AxisEnum, GridEnum } from '../interface';
import { commonAxis } from '../../../theme/builtin/common/component/axis/common-axis';
import { axisLinear } from '../../../theme/builtin/common/component/axis/linear-axis';
import { axisX, axisY } from '../../../theme/builtin/common/component/axis/cartesian-axis';

export interface CartesianLogAxis<T extends ICartesianLogAxisSpec = ICartesianLogAxisSpec>
  extends Pick<LinearAxisMixin, 'valueToPosition'>,
    CartesianLinearAxis<T> {}

export class CartesianLogAxis<T extends ICartesianLogAxisSpec = ICartesianLogAxisSpec> extends CartesianLinearAxis<T> {
  static type = ComponentTypeEnum.cartesianLogAxis;
  type = ComponentTypeEnum.cartesianLogAxis;

  static specKey = 'axes';
  static readonly builtInTheme = {
    axis: commonAxis,
    axisLinear,
    axisX,
    axisY
  };

  protected _zero: boolean = false;

  protected _scale: LogScale = new LogScale();
  protected declare _scales: LogScale[];

  /**
   * @override
   */
  protected initScales() {
    super.initScales();
    this._scale.base(this._spec.base ?? 10);
    this._scale.clamp(true, null, false);
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

mixin(CartesianLogAxis, LinearAxisMixin);

export const registerCartesianLogAxis = () => {
  Factory.registerGraphicComponent(AxisEnum.lineAxis, (attrs: any, options: VRenderComponentOptions) => {
    return new LineAxis(attrs, options) as unknown as IGroup;
  });
  Factory.registerGraphicComponent(GridEnum.lineAxisGrid, (attrs: any, options: VRenderComponentOptions) => {
    return new LineAxisGrid(attrs, options) as unknown as IGroup;
  });
  registerAxis();
  Factory.registerComponent(CartesianLogAxis.type, CartesianLogAxis);
};
