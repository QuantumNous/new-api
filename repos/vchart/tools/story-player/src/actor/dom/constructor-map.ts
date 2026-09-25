import type { ActorConstructorMap } from '../interface';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '../interface';
import { DomDivActor } from './div';
import { DomImgActor } from './img';
import { DomVideoActor } from './video';

export const domActorConstructorMap: ActorConstructorMap = {
  [ActorType.domDiv]: DomDivActor,
  [ActorType.domImg]: DomImgActor,
  [ActorType.domVideo]: DomVideoActor,
};
