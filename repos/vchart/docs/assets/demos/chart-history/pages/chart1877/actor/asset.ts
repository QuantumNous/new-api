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

export const pageChart1877Actor = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1877ActorChartFigure = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'chartFigure' + pageKey,
    src: chartFigure,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '300px',
      height: '300px',
      bottom: '0px',
      left: '460px',
      opacity: '0'
    }
  });

  actorMap.pageChart1877ActorPerson = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'person' + pageKey,
    src: person,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '400px',
      height: '500px',
      bottom: '0px',
      left: '1280px'
    }
  });

  actorMap.pageChart1877ActorTextEn = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'textEn' + pageKey,
    src: textEn,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '240px',
      height: '180px',
      bottom: '290px',
      left: '470px',
      opacity: '0'
    }
  });

  actorMap.pageChart1877ActorTextZh = player.createActor<DomImgActor>(ActorType.domImg, {
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

  actorMap.pageChart1877ActorTitle = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'title' + pageKey,
    src: title,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '300px',
      height: '200px',
      top: '90px',
      left: '168px',
      opacity: '0'
    }
  });

  actorMap.pageChart1877ActorBg = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bg' + pageKey,
    src: bgDecoration,
    defaultStyle: {
      backgroundColor: '#2E4254',
      backgroundPosition: '-6px 0px',
      backgroundSize: '1200px 440px',
      width: '100%',
      height: '100%',
      top: '0px',
      left: '0px',
      opacity: '0'
    }
  });
};
