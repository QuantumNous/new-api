import type { DomImgActor, Player, BaseActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';
import title from '../assets/title.png';
import chartFigure from '../assets/chart.png';
import textZh from '../assets/text-zh.png';
import textEn from '../assets/text-en.png';
import pie from '../assets/pie.png';
import bgDecoration from '../assets/bg-decoration.png';
import { pageKey } from '../constant';

export const pageChart1801Actor = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1801ActorTitle = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'title' + pageKey,
    src: title,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '600px',
      height: '400px',
      top: '40px',
      left: '130px',
      opacity: '0'
    }
  });

  actorMap.pageChart1801ActorChartFigure = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'chartFigure' + pageKey,
    src: chartFigure,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '500px',
      height: '300px',
      top: '-300px',
      left: '470px'
    }
  });

  actorMap.pageChart1801ActorTextEn = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'textEn' + pageKey,
    src: textEn,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '250px',
      height: '140px',
      top: '-140px',
      left: '980px'
    }
  });

  actorMap.pageChart1801ActorTextZh = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'textEn' + pageKey,
    src: textZh,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '220px',
      height: '140px',
      top: '388px',
      left: '-220px'
    }
  });

  actorMap.pageChart1801ActorPie = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'pie' + pageKey,
    src: pie,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '220px',
      height: '220px',
      top: '440px',
      left: '1010px',
      opacity: '0'
    }
  });

  actorMap.pageChart1801ActorBg = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bg' + pageKey,
    defaultStyle: {
      backgroundColor: '#E8E8E8',
      width: '100%',
      height: '100%',
      top: '0px',
      left: '0px'
    }
  });

  actorMap.pageChart1801ActorBgTop = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bgTop' + pageKey,
    defaultStyle: {
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
      width: '1124px',
      height: '60px',
      top: '0px',
      left: '79px',
      opacity: '0'
    }
  });

  actorMap.pageChart1801ActorBgBottom = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bgTop' + pageKey,
    src: bgDecoration,
    defaultStyle: {
      backgroundColor: '#242526',
      backgroundSize: 'cover',
      width: '1124px',
      height: '131px',
      bottom: '0px',
      left: '79px',
      opacity: '0'
    }
  });
};
