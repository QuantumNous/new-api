import type { IComponentTheme } from '../../../../component/interface';
import { axisBand } from './axis/band-axis';
import { axisX, axisY } from './axis/cartesian-axis';
import { commonAxis } from './axis/common-axis';
import { axisLinear } from './axis/linear-axis';
import { axisAngle, axisRadius } from './axis/polar-axis';
import { brush } from './brush';
import { crosshair } from './crosshair';
import { dataZoom } from './data-zoom';
import { indicator } from './indicator';
import { colorLegend } from './legend/color-legend';
import { discreteLegend } from './legend/discrete-legend';
import { sizeLegend } from './legend/size-legend';
import { markArea } from './mark-area';
import { markLine } from './mark-line';
import { markPoint } from './mark-point';
import { player } from './player';
import { title } from './title';
import { tooltip } from './tooltip';
import { poptip } from './poptip';
import { totalLabel } from './total-label';
import { scrollBar } from './scroll-bar';

export const component: IComponentTheme = {
  discreteLegend,
  colorLegend,
  sizeLegend,
  axis: commonAxis,
  axisBand,
  axisLinear,
  axisX,
  axisY,
  axisAngle,
  axisRadius,
  markLine: markLine,
  markArea: markArea,
  markPoint: markPoint,
  polarMarkLine: markLine,
  polarMarkArea: markArea,
  polarMarkPoint: markPoint,
  geoMarkPoint: markPoint,
  tooltip,
  dataZoom,
  crosshair,
  player,
  brush,
  indicator,
  title,
  poptip,
  totalLabel,
  scrollBar
};
