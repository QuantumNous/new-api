import { registerLayout3d } from '../3d/layout';
import { register3DPlugin } from '../3d/plugin';
import { registerCartesianBandAxis3d } from './band-axis';
import { registerCartesianLinearAxis3d } from './linear-axis';
import { registerCartesianLogAxis3d } from './log-axis';
import { registerCartesianSymlogAxis3d } from './symlog-axis';
import { registerCartesianTimeAxis3d } from './time-axis';

export const registerAxis3dPlugin = () => {
  register3DPlugin();
  registerLayout3d();
  registerCartesianBandAxis3d();
  registerCartesianLinearAxis3d();
  registerCartesianTimeAxis3d();
  registerCartesianSymlogAxis3d();
  registerCartesianLogAxis3d();
};
