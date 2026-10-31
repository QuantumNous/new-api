import { CartesianSymlogAxis, Factory, registerCartesianLogAxis } from '@visactor/vchart';
import { axisZ } from './theme';
import { mixin } from '@visactor/vchart';
import { Axis3dMixin } from './axis-3d-mixin';

export const registerCartesianSymlogAxis3d = () => {
  registerCartesianLogAxis();
  const AxisCls = Factory.getComponentInKey(CartesianSymlogAxis.type);

  (AxisCls as any).builtInTheme = {
    ...AxisCls.builtInTheme,
    axisZ: {
      ...AxisCls.builtInTheme.axisX,
      ...axisZ
    }
  };

  mixin(AxisCls, Axis3dMixin);
};
