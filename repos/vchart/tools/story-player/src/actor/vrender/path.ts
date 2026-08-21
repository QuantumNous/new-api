import type { IPath, IPathGraphicAttribute } from '@visactor/vrender-core';
// eslint-disable-next-line no-duplicate-imports
import { createPath } from '@visactor/vrender-core';
import { VRenderActor } from './base';
import { ActorType } from '../interface';

export class VRenderPathActor extends VRenderActor<IPath, IPathGraphicAttribute> {
  type = ActorType.vrenderPath;
  createFunc = createPath;
}
