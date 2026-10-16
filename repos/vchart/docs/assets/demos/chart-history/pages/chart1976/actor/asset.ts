import type { DomImgActor, Player, BaseActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';
import title from '../assets/title.png';
import chartFigure from '../assets/chart.png';
import textZh from '../assets/text-zh.png';
import textEn from '../assets/text-en.png';
import bgDecoration from '../assets/bg-decoration.png';
import { pageKey } from '../constant';

export const pageChart1976Actor = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1976ActorChartFigure = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'chartFigure' + pageKey,
    src: chartFigure,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '400px',
      height: '300px',
      top: '-300px',
      left: '140px',
      opacity: '1'
    }
  });

  actorMap.pageChart1976ActorTextEn = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'textEn' + pageKey,
    src: textEn,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '390px',
      height: '180px',
      bottom: '950px',
      right: '140px',
      opacity: '0'
    }
  });

  actorMap.pageChart1976ActorTextZh = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'textZh' + pageKey,
    src: textZh,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '240px',
      height: '120px',
      bottom: '840px',
      left: '140px',
      opacity: '0'
    }
  });

  actorMap.pageChart1976ActorTitle = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'title' + pageKey,
    src: title,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '460px',
      height: '200px',
      top: '-200px',
      right: '140px',
      opacity: '0'
    }
  });

  actorMap.pageChart1976ActorBg = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bg' + pageKey,
    src: bgDecoration,
    defaultStyle: {
      backgroundColor: '#FAFAFA',
      backgroundPosition: '140px 160px',
      backgroundSize: '1000px 500px',
      width: '100%',
      height: '100%',
      top: '0px',
      left: '0px',
      opacity: '0'
    }
  });
};
