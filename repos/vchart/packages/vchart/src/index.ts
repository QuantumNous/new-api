import { VChart } from './vchart-all';

export default VChart;

export * from './core';

// chart model for extension
export * from './chart';
export * from './chart/base';
export * from './chart/cartesian';
export * from './chart/common';
export * from './chart/stack';
export * from './series';
export * from './mark';
export * from './component';
export * from './layout';
export * from './env';
export * from './event';
// plugin路径太深，如果直接引用，会导致tree-shaking失效
export * from './plugin/chart';
export * from './plugin/components/tooltip-handler';
export * from './plugin/components/axis-sync';
export * from './plugin/other';
export * from './plugin/base/base-plugin';
export * from './vrender-tools';
// util
export * from './util/data';
export * from './util/spec/transform';
export * from './util/mark';
export * from './util/region';
export * from './util/scale';
// constant
export * from './constant/data';

// base component model for extension
export * from './component/base';
export * from './compile/data/compilable-data';
export * from './animation';
export * from './interaction';

export { createImage, createPath, graphicCreator } from './vrender-bridge';
export {
  createArc3d,
  createPyramid3d,
  createRect3d,
  registerArc3d,
  registerLine,
  registerPyramid3d,
  registerRect,
  registerRect3d,
  registerShadowRoot
} from './vrender-bridge';
export {
  registerDirectionalLight,
  registerOrthoCamera,
  registerViewTransform3dPlugin
} from '@visactor/vrender-core/plugin/3d';
export {
  type IGraphic,
  type IGlyph,
  type IGroup,
  type IText,
  type ILine,
  type IArea,
  type IRect,
  type INode,
  type IStage,
  type EasingType,
  type ILineGraphicAttribute,
  type ITextGraphicAttribute,
  type IRectGraphicAttribute,
  type IGroupGraphicAttribute,
  type TextAlignType,
  type TextBaselineType,
  type GraphicEventType,
  type IAreaGraphicAttribute,
  type ISymbolGraphicAttribute
} from '@visactor/vrender-core';

export { ACustomAnimate } from '@visactor/vrender-animate/custom/custom-animate';
export { AnimateExecutor } from '@visactor/vrender-animate/executor/animate-executor';
export { RotateBySphereAnimate } from '@visactor/vrender-animate/custom/sphere';

// vrender-components
export {
  AbstractComponent,
  Segment,
  MarkPoint,
  type SegmentAttributes,
  type Point
} from '@visactor/vrender-components';

// vlayouts
export * from '@visactor/vlayouts';

// vdataset
export { DataView, DataSet, svgParser } from '@visactor/vdataset';
export type { SVGParsedElement, SVGParserResult, ISVGSourceOption } from '@visactor/vdataset';

// vutils
// @ts-ignore
export * from '@visactor/vutils';
