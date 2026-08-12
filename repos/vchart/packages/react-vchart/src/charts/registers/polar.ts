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
  registerDomTooltipHandler,
  registerAnimate,
  registerReactAttributePlugin
} from '@visactor/vchart';

export const registers = [
  registerAnimate,
  registerReactAttributePlugin,
  registerTooltip,
  registerDomTooltipHandler,
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
