import type { DomImgActor, Player, BaseActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';
import textZh from '../assets/text-zh.png';
import textEn from '../assets/text-en.png';
import chart from '../assets/chart.png';
import lineLong from '../assets/line-long.png';
import lineShort from '../assets/line-short.png';
import blocks from '../assets/blocks.png';
import titleDecoration from '../assets/title-decoration.png';
import title from '../assets/title.png';
import name from '../assets/name.png';
import matrix from '../assets/matrix.png';
import decoration from '../assets/decoration.png';
import bgDecoration from '../assets/bg-decoration.png';
import { pageKey } from '../constant';

export const pageChart1644Actor = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1644ActorLineLong = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'lineLong' + pageKey,
    src: lineLong,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '10px',
      height: '460px',
      top: '-460px',
      left: '175px'
    }
  });

  actorMap.pageChart1644ActorBlocks = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'blocks' + pageKey,
    src: blocks,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '50px',
      height: '60px',
      top: '-60px',
      left: '155px'
    }
  });

  actorMap.pageChart1644ActorTitleDecoration = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'titleDecoration' + pageKey,
    src: titleDecoration,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '150px',
      height: '50px',
      top: '-50px',
      left: '200px'
    }
  });

  actorMap.pageChart1644ActorTitle = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'title' + pageKey,
    src: title,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '430px',
      height: '80px',
      top: '-80px',
      left: '200px'
    }
  });

  actorMap.pageChart1644ActorName = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'name' + pageKey,
    src: name,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '300px',
      height: '50px',
      top: '-50px',
      left: '200px'
    }
  });

  actorMap.pageChart1644ActorChartFigure = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'chartFigure' + pageKey,
    src: chart,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '450px',
      height: '100%',
      top: '0px',
      left: '200px',
      opacity: '0'
    }
  });

  actorMap.pageChart1644ActorTextZh = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'textZh' + pageKey,
    src: textZh,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '290px',
      height: '100px',
      top: '720px',
      left: '350px'
    }
  });

  actorMap.pageChart1644ActorTextEn = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'textEn' + pageKey,
    src: textEn,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '290px',
      height: '100px',
      top: '720px',
      left: '660px'
    }
  });

  actorMap.pageChart1644ActorLineShort = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'lineShort' + pageKey,
    src: lineShort,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '10px',
      height: '66px',
      top: '720px',
      left: '330px'
    }
  });

  actorMap.pageChart1644ActorGreenBlock = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'greenBlock' + pageKey,
    src: matrix,
    defaultStyle: {
      backgroundSize: 'contain',
      backgroundColor: '#82887C',
      width: '120px',
      height: '105px',
      top: '-105px',
      left: '650px'
    }
  });

  actorMap.pageChart1644ActorMiddleBlock = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'middleBlock' + pageKey,
    src: decoration,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '120px',
      height: '140px',
      top: '720px',
      left: '760px'
    }
  });

  actorMap.pageChart1644ActorColorBlock = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'colorBlock' + pageKey,
    defaultStyle: {
      backgroundColor: '#AFA7A1',
      width: '320px',
      height: '116px',
      top: '315px',
      left: '1280px'
    }
  });

  actorMap.pageChart1644ActorBgDecoration = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bgDecoration' + pageKey,
    src: bgDecoration,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '1080px',
      height: '100%',
      top: '500px',
      right: '0px'
    }
  });
};
