import { CartesianLinearAxis, Factory, registerCartesianLinearAxis } from '@visactor/vchart';
import { axisZ } from './theme';
import { mixin } from '@visactor/vchart';
import { Axis3dMixin } from './axis-3d-mixin';

export const registerCartesianLinearAxis3d = () => {
  registerCartesianLinearAxis();
  const AxisCls = Factory.getComponentInKey(CartesianLinearAxis.type);

  (AxisCls as any).builtInTheme = {
    ...AxisCls.builtInTheme,
    axisZ: {
      ...CartesianLinearAxis.builtInTheme.axisX,
      ...axisZ
    }
  };

  mixin(AxisCls, Axis3dMixin);
};
