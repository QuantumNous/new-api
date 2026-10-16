import type { DomImgActor, Player, BaseActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';
import title from '../assets/title.png';
import chartFigure from '../assets/chart.png';
import textZh from '../assets/text-zh.png';
import textEn from '../assets/text-en.png';
import { pageKey } from '../constant';

export const pageChart1990s_2Actor = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1990s_2ActorChartFigure = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'chartFigure' + pageKey,
    src: chartFigure,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '1100px',
      height: '600px',
      bottom: '10px',
      right: '-1150px'
    }
  });

  actorMap.pageChart1990s_2ActorTextEn = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'textEn' + pageKey,
    src: textEn,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '250px',
      height: '100px',
      bottom: '120px',
      left: '1430px'
    }
  });

  actorMap.pageChart1990s_2ActorTextZh = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'textZh' + pageKey,
    src: textZh,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '250px',
      height: '100px',
      top: '370px',
      left: '1430px'
    }
  });

  actorMap.pageChart1990s_2ActorTitle = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'title' + pageKey,
    src: title,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '250px',
      height: '200px',
      top: '130px',
      left: '1430px'
    }
  });
};
