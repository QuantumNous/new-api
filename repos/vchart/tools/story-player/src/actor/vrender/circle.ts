import type { ICircle, ICircleGraphicAttribute } from '@visactor/vrender-core';
// eslint-disable-next-line no-duplicate-imports
import { createCircle } from '@visactor/vrender-core';
import { VRenderActor } from './base';
import { ActorType } from '../interface';

export class VRenderCircleActor extends VRenderActor<ICircle, ICircleGraphicAttribute> {
  type = ActorType.vrenderCircle;
  createFunc = createCircle;
}
