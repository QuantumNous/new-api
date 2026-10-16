import { domActorConstructorMap } from './dom/constructor-map';
import type { ActorConstructorMap } from './interface';
import { vchartActorConstructorMap } from './vchart/constructor-map';
import { vrenderActorConstructorMap } from './vrender/constructor-map';

export const actorConstructorMap: ActorConstructorMap = {
  ...vrenderActorConstructorMap,
  ...domActorConstructorMap,
  ...vchartActorConstructorMap,
};
