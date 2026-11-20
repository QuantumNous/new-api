import type { DomImgActor, BaseActor, Player, DomDivActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';
import titleImage from '../assets/title-image.png';
import textZh from '../assets/text-zh.png';
import textEn from '../assets/text-en.png';
import chart1 from '../assets/chart-1.png';
import chart2 from '../assets/chart-2.png';
import chart3 from '../assets/chart-3.png';
import chart4 from '../assets/chart-4.png';
import chart5 from '../assets/chart-5.png';
import bgDecoration from '../assets/decoration.png';
import { pageKey } from '../constant';

export const pageChart1486Actor = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1486ActorTitleImage = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'titleImage' + pageKey,
    src: titleImage,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '300px',
      height: '100%',
      top: '-50px',
      left: '1280px'
    }
  });

  actorMap.pageChart1486ActorTextZh = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'textZh' + pageKey,
    src: textZh,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '500px',
      height: '100%',
      top: '720px',
      left: '640px'
    }
  });

  actorMap.pageChart1486ActorChartFigure1 = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'chartFigure1-' + pageKey,
    src: chart1,
    defaultStyle: {
      backgroundSize: 'contain',
      backgroundColor: 'white',
      width: '173px',
      height: '144px',
      top: '720px',
      left: '640px'
    }
  });

  actorMap.pageChart1486ActorChartFigure2 = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'chartFigure2-' + pageKey,
    src: chart2,
    defaultStyle: {
      backgroundSize: 'contain',
      backgroundColor: 'white',
      width: '173px',
      height: '144px',
      top: '720px',
      left: '828px'
    }
  });

  actorMap.pageChart1486ActorChartFigure3 = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'chartFigure3-' + pageKey,
    src: chart3,
    defaultStyle: {
      backgroundSize: 'contain',
      backgroundColor: 'white',
      width: '173px',
      height: '144px',
      top: '720px',
      left: '640px'
    }
  });

  actorMap.pageChart1486ActorChartFigure4 = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'chartFigure4-' + pageKey,
    src: chart4,
    defaultStyle: {
      backgroundSize: 'contain',
      backgroundColor: 'white',
      width: '173px',
      height: '144px',
      top: '720px',
      left: '828px'
    }
  });

  actorMap.pageChart1486ActorChartFigure5 = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'chartFigure5-' + pageKey,
    src: chart5,
    defaultStyle: {
      backgroundSize: 'contain',
      backgroundColor: 'white',
      width: '173px',
      height: '302px',
      top: '720px',
      left: '1016px'
    }
  });

  actorMap.pageChart1486ActorTextEn = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'textEn' + pageKey,
    src: textEn,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '500px',
      height: '100%',
      top: '720px',
      left: '640px'
    }
  });

  actorMap.pageChart1486ActorBg = player.createActor<DomDivActor>(ActorType.domDiv, {
    name: 'bg' + pageKey,
    defaultStyle: {
      backgroundColor: '#D9D4CA',
      width: '100%',
      height: '100%',
      top: '0px',
      left: '1280px'
    }
  });

  actorMap.pageChart1486ActorBgDecoration = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bgDecoration' + pageKey,
    src: bgDecoration,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '960px',
      height: '100%',
      top: '0px',
      left: '1280px'
    }
  });
};
