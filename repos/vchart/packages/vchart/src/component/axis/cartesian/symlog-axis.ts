import { CartesianLinearAxis } from './linear-axis';
import { ComponentTypeEnum } from '../../interface/type';
import { LinearAxisMixin } from '../mixin/linear-axis-mixin';
import { SymlogScale } from '@visactor/vscale';
import { mixin } from '@visactor/vutils';
import type { ICartesianSymlogAxisSpec } from './interface';
import { Factory } from '../../../core/factory';
import { registerAxis } from '../base-axis';
import { continuousTicks, LineAxis, LineAxisGrid } from '@visactor/vrender-components';
import { registerDataSetInstanceTransform } from '../../../data/register';
import type { VRenderComponentOptions } from '../../../core/interface';
import type { IGroup } from '@visactor/vrender-core';
import { AxisEnum, GridEnum } from '../interface/common';
import { commonAxis } from '../../../theme/builtin/common/component/axis/common-axis';
import { axisLinear } from '../../../theme/builtin/common/component/axis/linear-axis';
import { axisX, axisY } from '../../../theme/builtin/common/component/axis/cartesian-axis';

export interface CartesianSymlogAxis<T extends ICartesianSymlogAxisSpec = ICartesianSymlogAxisSpec>
  extends Pick<LinearAxisMixin, 'valueToPosition'>,
    CartesianLinearAxis<T> {}

export class CartesianSymlogAxis<
  T extends ICartesianSymlogAxisSpec = ICartesianSymlogAxisSpec
> extends CartesianLinearAxis<T> {
  static type = ComponentTypeEnum.cartesianSymlogAxis;
  type = ComponentTypeEnum.cartesianSymlogAxis;

  static specKey = 'axes';
  static readonly builtInTheme = {
    axis: commonAxis,
    axisLinear,
    axisX,
    axisY
  };

  protected _zero: boolean = false;

  protected _scale: SymlogScale = new SymlogScale();
  protected declare _scales: SymlogScale[];

  /**
   * @override
   */
  protected initScales() {
    super.initScales();
    this._scale.constant(this._spec.constant ?? 10);
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

mixin(CartesianSymlogAxis, LinearAxisMixin);

export const registerCartesianSymlogAxis = () => {
  Factory.registerGraphicComponent(AxisEnum.lineAxis, (attrs: any, options: VRenderComponentOptions) => {
    return new LineAxis(attrs, options) as unknown as IGroup;
  });
  Factory.registerGraphicComponent(GridEnum.lineAxisGrid, (attrs: any, options: VRenderComponentOptions) => {
    return new LineAxisGrid(attrs, options) as unknown as IGroup;
  });
  registerAxis();
  Factory.registerComponent(CartesianSymlogAxis.type, CartesianSymlogAxis);
};
