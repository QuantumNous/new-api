import type { ActorConstructorMap } from '../interface';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '../interface';
import { VRenderCircleActor } from './circle';
import { VRenderLineActor } from './line';
import { VRenderPathActor } from './path';
import { VRenderTextActor } from './text';

export const vrenderActorConstructorMap: ActorConstructorMap = {
  [ActorType.vrenderCircle]: VRenderCircleActor,
  [ActorType.vrenderText]: VRenderTextActor,
  [ActorType.vrenderLine]: VRenderLineActor,
  [ActorType.vrenderPath]: VRenderPathActor,
};
