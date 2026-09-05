import type { BaseActor, BaseLayer, Page, Player } from '@internal/story-player';
import { pageChart1486Action } from './chart1486';
import { pageChart1644Action } from './chart1644';
import { pageChart1765Action } from './chart1765';
import { pageChart1786Action } from './chart1786';
import { pageChart1786_2Action } from './chart1786-2';
import { pageChart1801Action } from './chart1801';
import { pageChart1833Action } from './chart1833';
import { pageChart1856Action } from './chart1856';
import { pageChart1877Action } from './chart1877';
import { pageChart1976Action } from './chart1976';
import { pageChart1990sAction } from './chart1990s';
import { pageChart1990s_2Action } from './chart1990s-2';
import { pageTitleAction } from './title';
import { pageTimelineAction } from './timeline';

export const createActions = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>
) => {
  pageTitleAction(player, layerMap, pageMap, actorMap);

  pageTimelineAction(player, layerMap, pageMap, actorMap);

  pageChart1486Action(player, layerMap, pageMap, actorMap);

  pageChart1644Action(player, layerMap, pageMap, actorMap);

  pageChart1765Action(player, layerMap, pageMap, actorMap);

  pageChart1786Action(player, layerMap, pageMap, actorMap);

  pageChart1786_2Action(player, layerMap, pageMap, actorMap);

  pageChart1801Action(player, layerMap, pageMap, actorMap);

  pageChart1833Action(player, layerMap, pageMap, actorMap);

  pageChart1856Action(player, layerMap, pageMap, actorMap);

  pageChart1877Action(player, layerMap, pageMap, actorMap);

  pageChart1976Action(player, layerMap, pageMap, actorMap);

  pageChart1990sAction(player, layerMap, pageMap, actorMap);

  pageChart1990s_2Action(player, layerMap, pageMap, actorMap);

  return actorMap;
};
