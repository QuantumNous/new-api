import type { BaseActor, BaseLayer, Page } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { Player } from '@internal/story-player';
import { createActions } from './action';
import { createPages } from './page';
import { createLayers } from './layer';
import { createActors } from './actor';
import { OriginalData } from '../data/interface';
import { CONTAINER_HEIGHT, CONTAINER_WIDTH } from './constant';

export const initPlayer = (parentEl: HTMLElement, data: OriginalData) => {
  const player = new Player(
    {},
    {
      width: CONTAINER_WIDTH,
      height: CONTAINER_HEIGHT,
      parentEl
    }
  );

  const pageMap: Record<string, Page> = {};
  const layerMap: Record<string, BaseLayer> = {};
  const actorMap: Record<string, BaseActor> = {};

  createPages(player, pageMap, data);
  createLayers(player, layerMap);
  createActors(player, actorMap, data);
  createActions(player, layerMap, pageMap, actorMap, data);

  return player;
};
