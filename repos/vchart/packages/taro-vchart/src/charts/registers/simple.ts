import {
  registerContinuousLegend,
  registerDiscreteLegend,
  registerCustomMark,
  registerAllMarks,
  registerTitle,
  registerTooltip,
  registerCanvasTooltipHandler,
  registerAnimate
} from '@visactor/vchart';

export const registers = [
  registerAnimate,
  registerTooltip,
  registerCanvasTooltipHandler,
  registerDiscreteLegend,
  registerContinuousLegend,
  registerCustomMark,
  registerAllMarks,
  registerTitle
];
