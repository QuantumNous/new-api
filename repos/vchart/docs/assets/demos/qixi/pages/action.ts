import type { BaseActor, BaseLayer, Page, Player } from '@internal/story-player';
import { OriginalData } from '../data/interface';
import { page01Action } from './01/action';
import { page02Action } from './02/action';
import { page03Action } from './03/action';
import { page04Action } from './04/action';

export const createActions = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>,
  data: OriginalData
) => {
  page01Action(player, layerMap, pageMap, actorMap, data);
  page02Action(player, layerMap, pageMap, actorMap, data);
  page03Action(player, layerMap, pageMap, actorMap, data);
  page04Action(player, layerMap, pageMap, actorMap, data);

  return actorMap;
};
