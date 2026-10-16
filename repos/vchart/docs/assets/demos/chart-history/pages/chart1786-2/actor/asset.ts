import type { DomImgActor, Player, BaseActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';
import mainImage from '../assets/main-image.png';
import chartFigure from '../assets/chart.png';
import text from '../assets/text.png';
import { pageKey } from '../constant';

export const pageChart1786_2Actor = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1786_2ActorMainImage = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'mainImage' + pageKey,
    src: mainImage,
    defaultStyle: {
      backgroundSize: 'contain',
      backgroundColor: '#E8E8E8',
      width: '1280px',
      height: '780px',
      top: '0px',
      left: '0px',
      opacity: '0'
    }
  });

  actorMap.pageChart1786_2ActorChartFigure = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'chartFigure' + pageKey,
    src: chartFigure,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '520px',
      height: '500px',
      top: '720px',
      left: '79px',
      opacity: '0'
    }
  });

  actorMap.pageChart1786_2ActorText = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'text' + pageKey,
    src: text,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '300px',
      height: '300px',
      top: '720px',
      left: '700px',
      opacity: '0'
    }
  });

  actorMap.pageChart1786_2ActorBg1 = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bg1-' + pageKey,
    defaultStyle: {
      backgroundColor: '#E8E8E8',
      width: '78px',
      height: '100%',
      top: '0px',
      left: '-78px'
    }
  });

  actorMap.pageChart1786_2ActorBg2 = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bg2-' + pageKey,
    defaultStyle: {
      backgroundColor: '#E8E8E8',
      width: '78px',
      height: '100%',
      top: '0px',
      left: '1280px'
    }
  });
};
