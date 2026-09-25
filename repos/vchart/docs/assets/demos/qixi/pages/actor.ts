import type { BaseActor, Player } from '@internal/story-player';
import { OriginalData } from '../data/interface';
import { actorCommon } from '../common/actor/asset';
import { page01Actor } from './01/actor';
import { page02Actor } from './02/actor';
import { page03Actor } from './03/actor';
import { page04Actor } from './04/actor';

export const createActors = (player: Player, actorMap: Record<string, BaseActor>, data: OriginalData) => {
  actorCommon(player, actorMap);

  page01Actor(player, actorMap, data);
  page02Actor(player, actorMap, data);
  page03Actor(player, actorMap, data);
  page04Actor(player, actorMap, data);

  return actorMap;
};
