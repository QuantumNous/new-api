import type { VRenderTextActor, DomImgActor, Player, BaseActor, DomDivActor } from '@internal/story-player';
import { ActorType } from '@internal/story-player';
import subTitle from '../assets/powered-by-vchart.png';

export const pageTitleActor = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageTitleActorTitle1 = player.createActor<VRenderTextActor>(ActorType.vrenderText, {
    name: 'titleLine1',
    defaultAttribute: {
      text: '',
      fontSize: 80,
      fontWeight: 'bold',
      x: 640,
      y: 230,
      fill: 'black',
      textBaseline: 'top',
      textAlign: 'center'
    }
  });

  actorMap.pageTitleActorTitle2 = player.createActor<VRenderTextActor>(ActorType.vrenderText, {
    name: 'titleLine2',
    defaultAttribute: {
      text: '',
      fontSize: 80,
      fontWeight: 'bold',
      x: 640,
      y: 330,
      fill: 'black',
      textBaseline: 'top',
      textAlign: 'center'
    }
  });

  actorMap.pageTitleActorSubTitle = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'subTitle',
    src: subTitle,
    defaultStyle: {
      width: '100%',
      height: '24px',
      top: '450px',
      left: '0px',
      opacity: '0'
    }
  });

  actorMap.pageTitleActorBg = player.createActor<DomDivActor>(ActorType.domDiv, {
    name: 'whiteBg',
    defaultStyle: {
      backgroundColor: 'white',
      width: '100%',
      height: '100%',
      top: '0px',
      left: '0px'
    }
  });
};
