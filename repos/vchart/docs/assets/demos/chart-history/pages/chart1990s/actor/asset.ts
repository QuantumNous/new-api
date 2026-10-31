import type { DomImgActor, Player, BaseActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';
import title from '../assets/title.png';
import chartFigure from '../assets/chart.png';
import textZh from '../assets/text-zh.png';
import textEn from '../assets/text-en.png';
import bgDecoration from '../assets/bg-decoration.png';
import { pageKey } from '../constant';

export const pageChart1990sActor = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1990sActorChartFigure = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'chartFigure' + pageKey,
    src: chartFigure,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '1100px',
      height: '600px',
      bottom: '-600px',
      right: '130px'
    }
  });

  actorMap.pageChart1990sActorTextEn = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'textEn' + pageKey,
    src: textEn,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '250px',
      height: '100px',
      bottom: '120px',
      left: '150px',
      opacity: '0'
    }
  });

  actorMap.pageChart1990sActorTextZh = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'textZh' + pageKey,
    src: textZh,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '250px',
      height: '100px',
      top: '370px',
      left: '150px',
      opacity: '0'
    }
  });

  actorMap.pageChart1990sActorTitle = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'title' + pageKey,
    src: title,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '250px',
      height: '200px',
      top: '130px',
      left: '150px',
      opacity: '0'
    }
  });

  actorMap.pageChart1990sActorBg = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bg' + pageKey,
    defaultStyle: {
      backgroundColor: '#FAFAFA',
      backgroundImage: 'linear-gradient(231deg, #BED7DC 16.36%, #E4F0F2 100%)',
      width: '100%',
      height: '100%',
      top: '0px',
      left: '0px',
      opacity: '0'
    }
  });

  actorMap.pageChart1990sActorBgBottom = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bgBottom' + pageKey,
    defaultStyle: {
      backgroundColor: '#658A92',
      width: '100%',
      height: '240px',
      bottom: '-240px',
      left: '0px'
    }
  });

  actorMap.pageChart1990sActorBgDecoration = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bgDecoration' + pageKey,
    src: bgDecoration,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '340px',
      height: '100%',
      top: '-40px',
      right: '90px',
      opacity: '0'
    }
  });
};
