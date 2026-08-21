import type { ILine, ILineGraphicAttribute } from '@visactor/vrender-core';
// eslint-disable-next-line no-duplicate-imports
import { createLine } from '@visactor/vrender-core';
import { VRenderActor } from './base';
import { ActorType } from '../interface';

export class VRenderLineActor extends VRenderActor<ILine, ILineGraphicAttribute> {
  type = ActorType.vrenderLine;
  createFunc = createLine;
}
