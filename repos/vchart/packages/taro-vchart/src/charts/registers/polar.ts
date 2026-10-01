import {
  registerBrush, // optional
  registerContinuousLegend,
  registerDataZoom,
  registerDiscreteLegend,
  registerCustomMark,
  registerAllMarks,
  registerScrollBar,
  registerTitle,
  registerPolarLinearAxis, // 必选
  registerPolarBandAxis, // 必选
  registerPolarCrossHair,
  registerTooltip,
  registerCanvasTooltipHandler,
  registerAnimate
} from '@visactor/vchart';

export const registers = [
  registerAnimate,
  registerTooltip,
  registerCanvasTooltipHandler,
  registerPolarLinearAxis, // 必选
  registerPolarBandAxis, // 必选
  registerPolarCrossHair,

  registerBrush, // optional
  registerContinuousLegend,
  registerDataZoom,
  registerDiscreteLegend,
  registerCustomMark,
  registerAllMarks,
  registerScrollBar,
  registerTitle
];
