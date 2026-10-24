import type { DomImgActor, Player, BaseActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';
import textZh from '../assets/text-zh.png';
import textEn from '../assets/text-en.png';
import chart from '../assets/chart.png';
import atom from '../assets/atom.png';
import titleImage from '../assets/title-image.png';
import bgDecoration from '../assets/bg-decoration.png';
import { pageKey } from '../constant';

export const pageChart1765Actor = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1765ActorTitleImage = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'titleImage' + pageKey,
    src: titleImage,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '250px',
      height: '500px',
      top: '-500px',
      left: '188px'
    }
  });

  actorMap.pageChart1765ActorTextZh = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'textZh' + pageKey,
    src: textZh,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '190px',
      height: '100px',
      top: '-100px',
      left: '489px'
    }
  });

  actorMap.pageChart1765ActorChartFigure = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'chartFigure' + pageKey,
    src: chart,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '302px',
      height: '500px',
      top: '-500px',
      left: '790px'
    }
  });

  actorMap.pageChart1765ActorAtom = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'atom' + pageKey,
    src: atom,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '400px',
      height: '200px',
      top: '720px',
      left: '188px'
    }
  });

  actorMap.pageChart1765ActorTextEn = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'atom' + pageKey,
    src: textEn,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '400px',
      height: '200px',
      top: '720px',
      left: '692px'
    }
  });

  actorMap.pageChart1765ActorBg1 = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bg1-' + pageKey,
    src: bgDecoration,
    defaultStyle: {
      backgroundSize: 'contain',
      backgroundColor: '#E3E4E5',
      backgroundPositionX: '37px',
      width: '100%',
      height: '540px',
      top: '-540px',
      left: '0px'
    }
  });

  actorMap.pageChart1765ActorBg2 = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bg2-' + pageKey,
    defaultStyle: {
      backgroundColor: 'white',
      width: '100%',
      height: '180px',
      top: '720px',
      left: '0px'
    }
  });
};
