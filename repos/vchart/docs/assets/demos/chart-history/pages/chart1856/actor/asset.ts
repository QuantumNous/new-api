import type { DomImgActor, Player, BaseActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';
import title from '../assets/title.png';
import chartFigure from '../assets/chart.png';
import person from '../assets/person.png';
import textZh from '../assets/text-zh.png';
import textEn from '../assets/text-en.png';
import bgDecoration from '../assets/bg-decoration.png';
import { pageKey } from '../constant';

export const pageChart1856Actor = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1856ActorChartFigure = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'chartFigure' + pageKey,
    src: chartFigure,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '750px',
      height: '550px',
      bottom: '0px',
      left: '400px',
      opacity: '0'
    }
  });

  actorMap.pageChart1856ActorPerson = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'person' + pageKey,
    src: person,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '400px',
      height: '530px',
      bottom: '0px',
      left: '1280px'
    }
  });

  actorMap.pageChart1856ActorTextEn = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'textEn' + pageKey,
    src: textEn,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '240px',
      height: '180px',
      bottom: '30px',
      left: '165px',
      opacity: '0'
    }
  });

  actorMap.pageChart1856ActorTextZh = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'textZh' + pageKey,
    src: textZh,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '240px',
      height: '120px',
      bottom: '200px',
      left: '165px',
      opacity: '0'
    }
  });

  actorMap.pageChart1856ActorTitle = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'title' + pageKey,
    src: title,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '300px',
      height: '200px',
      top: '70px',
      left: '160px',
      opacity: '0'
    }
  });

  actorMap.pageChart1856ActorBg = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bg' + pageKey,
    src: bgDecoration,
    defaultStyle: {
      backgroundColor: '#CFC9BE',
      backgroundPosition: '0px 0px',
      backgroundSize: '1110px 440px',
      width: '100%',
      height: '100%',
      top: '0px',
      left: '0px',
      opacity: '0'
    }
  });
};
