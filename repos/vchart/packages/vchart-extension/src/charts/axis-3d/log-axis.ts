import { CartesianLogAxis, Factory, registerCartesianLogAxis } from '@visactor/vchart';
import { axisZ } from './theme';
import { mixin } from '@visactor/vchart';
import { Axis3dMixin } from './axis-3d-mixin';

export const registerCartesianLogAxis3d = () => {
  registerCartesianLogAxis();
  const AxisCls = Factory.getComponentInKey(CartesianLogAxis.type);

  (AxisCls as any).builtInTheme = {
    ...AxisCls.builtInTheme,
    axisZ: {
      ...CartesianLogAxis.builtInTheme.axisX,
      ...axisZ
    }
  };

  mixin(AxisCls, Axis3dMixin);
};
