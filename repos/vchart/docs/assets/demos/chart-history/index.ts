import type { BaseActor, BaseLayer, Page } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { Player } from '@internal/story-player';
import { createActions } from './pages';
import { createPages } from './pages/page';
import { createLayers } from './layer';
import { createActors } from './pages/actor';

const CONTAINER_WIDTH = 1280;
const CONTAINER_HEIGHT = 720;

export const initPlayer = (parentEl: HTMLElement) => {
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

  createPages(player, pageMap);
  createLayers(player, layerMap);
  createActors(player, actorMap);
  createActions(player, layerMap, pageMap, actorMap);

  return player;
};
