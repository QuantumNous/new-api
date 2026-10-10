import type { DomImgActor, Player, BaseActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';
import title from '../assets/title.png';
import chartFigure from '../assets/chart.png';
import text from '../assets/text.png';
import image1 from '../assets/image1.png';
import image2 from '../assets/image2.png';
import bgDecoration from '../assets/bg-decoration.png';
import { pageKey } from '../constant';

export const pageChart1833Actor = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1833ActorChartFigure = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'chartFigure' + pageKey,
    src: chartFigure,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '400px',
      height: '300px',
      top: '-300px',
      left: '1280px'
    }
  });

  actorMap.pageChart1833ActorImage1 = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'iamge1-' + pageKey,
    src: image1,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '320px',
      height: '400px',
      bottom: '-400px',
      left: '-320px'
    }
  });

  actorMap.pageChart1833ActorImage2 = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'iamge2-' + pageKey,
    src: image2,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '200px',
      height: '200px',
      top: '720px',
      left: '1280px'
    }
  });

  actorMap.pageChart1833ActorText = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'text' + pageKey,
    src: text,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '350px',
      height: '220px',
      top: '420px',
      left: '90px',
      opacity: '0'
    }
  });

  actorMap.pageChart1833ActorTitle = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'title' + pageKey,
    src: title,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '380px',
      height: '140px',
      top: '130px',
      left: '115px',
      opacity: '0'
    }
  });

  actorMap.pageChart1833ActorBg = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bg' + pageKey,
    src: bgDecoration,
    defaultStyle: {
      backgroundColor: '#242526',
      backgroundPosition: '100px 70px',
      backgroundSize: '1180px 650px',
      width: '100%',
      height: '100%',
      top: '720px',
      left: '0px'
    }
  });
};
