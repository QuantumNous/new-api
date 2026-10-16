import {
  registerBrush, // optional
  registerContinuousLegend,
  registerDataZoom,
  registerDiscreteLegend,
  registerCustomMark,
  registerAllMarks,
  registerMarkArea,
  registerMarkLine,
  registerMarkPoint,
  registerScrollBar,
  registerTitle,
  registerCartesianLinearAxis,
  registerCartesianBandAxis,
  registerCartesianTimeAxis,
  registerCartesianLogAxis,
  registerCartesianCrossHair,
  registerTooltip,
  registerCanvasTooltipHandler,
  registerAnimate
} from '@visactor/vchart';

export const registers = [
  registerAnimate,
  registerTooltip,
  registerCanvasTooltipHandler,
  registerCartesianLinearAxis,
  registerCartesianBandAxis,
  registerCartesianTimeAxis,
  registerCartesianLogAxis,
  registerCartesianCrossHair,
  registerBrush, // optional
  registerContinuousLegend,
  registerDataZoom,
  registerDiscreteLegend,
  registerCustomMark,
  registerAllMarks,
  registerMarkArea,
  registerMarkLine,
  registerMarkPoint,
  registerScrollBar,
  registerTitle
];
