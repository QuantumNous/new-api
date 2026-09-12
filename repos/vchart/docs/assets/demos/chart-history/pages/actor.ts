import type { BaseActor, Player } from '@internal/story-player';
import { actorCommon } from '../common/actor/asset';
import { pageChart1486Actor } from './chart1486/actor/asset';
import { pageChart1486ActorChart } from './chart1486/actor/chart';
import { pageChart1644Actor } from './chart1644/actor/asset';
import { pageChart1644ActorChart } from './chart1644/actor/chart';
import { pageChart1765Actor } from './chart1765/actor/asset';
import { pageChart1765ActorChart } from './chart1765/actor/chart';
import { pageChart1786Actor } from './chart1786/actor/asset';
import { pageChart1786_2Actor } from './chart1786-2/actor/asset';
import { pageChart1801Actor } from './chart1801/actor/asset';
import { pageChart1833Actor } from './chart1833/actor/asset';
import { pageChart1856Actor } from './chart1856/actor/asset';
import { pageChart1877Actor } from './chart1877/actor/asset';
import { pageChart1976Actor } from './chart1976/actor/asset';
import { pageChart1990sActor } from './chart1990s/actor/asset';
import { pageChart1990s_2Actor } from './chart1990s-2/actor/asset';
import { pageTitleActor } from './title/actor/asset';
import { pageTitleActorChart } from './title/actor/chart';
import { pageTimelineActor } from './timeline/actor/asset';
import { pageChart1786ActorChart } from './chart1786/actor/chart';
import { pageChart1786_2ActorChart } from './chart1786-2/actor/chart';
import { pageChart1801ActorChart } from './chart1801/actor/chart';
import { pageChart1833ActorChart } from './chart1833/actor/chart';
import { pageChart1856ActorChart } from './chart1856/actor/chart';
import { pageChart1877ActorChart } from './chart1877/actor/chart';
import { pageChart1976ActorChart } from './chart1976/actor/chart';
import { pageChart1990sActorChart } from './chart1990s/actor/chart';
import { pageChart1990s_2ActorChart } from './chart1990s-2/actor/chart';

export const createActors = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorCommon(player, actorMap);

  pageTitleActor(player, actorMap);
  pageTitleActorChart(player, actorMap);

  pageTimelineActor(player, actorMap);

  pageChart1486Actor(player, actorMap);
  pageChart1486ActorChart(player, actorMap);

  pageChart1644Actor(player, actorMap);
  pageChart1644ActorChart(player, actorMap);

  pageChart1765Actor(player, actorMap);
  pageChart1765ActorChart(player, actorMap);

  pageChart1786Actor(player, actorMap);
  pageChart1786ActorChart(player, actorMap);

  pageChart1786_2Actor(player, actorMap);
  pageChart1786_2ActorChart(player, actorMap);

  pageChart1801Actor(player, actorMap);
  pageChart1801ActorChart(player, actorMap);

  pageChart1833Actor(player, actorMap);
  pageChart1833ActorChart(player, actorMap);

  pageChart1856Actor(player, actorMap);
  pageChart1856ActorChart(player, actorMap);

  pageChart1877Actor(player, actorMap);
  pageChart1877ActorChart(player, actorMap);

  pageChart1976Actor(player, actorMap);
  pageChart1976ActorChart(player, actorMap);

  pageChart1990sActor(player, actorMap);
  pageChart1990sActorChart(player, actorMap);

  pageChart1990s_2Actor(player, actorMap);
  pageChart1990s_2ActorChart(player, actorMap);

  return actorMap;
};
