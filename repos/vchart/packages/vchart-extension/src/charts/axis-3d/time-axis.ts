import { CartesianTimeAxis, Factory, registerCartesianTimeAxis } from '@visactor/vchart';
import { axisZ } from './theme';
import { mixin } from '@visactor/vchart';
import { Axis3dMixin } from './axis-3d-mixin';

export const registerCartesianTimeAxis3d = () => {
  registerCartesianTimeAxis();
  const AxisCls = Factory.getComponentInKey(CartesianTimeAxis.type);

  (AxisCls as any).builtInTheme = {
    ...AxisCls.builtInTheme,
    axisZ: {
      ...AxisCls.builtInTheme.axisX,
      ...axisZ
    }
  };

  mixin(AxisCls, Axis3dMixin);
};
