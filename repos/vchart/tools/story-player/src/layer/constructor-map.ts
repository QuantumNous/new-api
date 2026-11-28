import { CanvasLayer } from './canvas-layer';
import { DomLayer } from './dom-layer';
import type { LayerConstructorMap } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { LayerType } from './interface';
import { VRenderLayer } from './vrender-layer';

export const layerConstructorMap: LayerConstructorMap = {
  [LayerType.canvas]: CanvasLayer,
  [LayerType.dom]: DomLayer,
  [LayerType.vrender]: VRenderLayer,
};
