import { CartesianBandAxis, Factory, registerCartesianBandAxis } from '@visactor/vchart';
import { axisZ } from './theme';
import { mixin } from '@visactor/vchart';
import { Axis3dMixin } from './axis-3d-mixin';

export const registerCartesianBandAxis3d = () => {
  registerCartesianBandAxis();
  const AxisCls = Factory.getComponentInKey(CartesianBandAxis.type);

  (AxisCls as any).builtInTheme = {
    ...AxisCls.builtInTheme,
    axisZ: {
      ...CartesianBandAxis.builtInTheme.axisX,
      ...axisZ
    }
  };

  mixin(AxisCls, Axis3dMixin);
};
