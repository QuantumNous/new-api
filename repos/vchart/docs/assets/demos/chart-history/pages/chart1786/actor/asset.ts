import type { DomImgActor, Player, BaseActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';
import mainImage from '../assets/main-image.png';
import { pageKey } from '../constant';
import bgDecoration from '../assets/bg-decoration.png';

export const pageChart1786Actor = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1786ActorMainImage = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'mainImage' + pageKey,
    src: mainImage,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '92px',
      height: '50px',
      top: '335px',
      left: '594px',
      opacity: '0'
    }
  });

  actorMap.pageChart1786ActorBg = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bg' + pageKey,
    defaultStyle: {
      backgroundColor: '#D9D3C8',
      width: '100%',
      height: '100%',
      top: '0px',
      left: '0px',
      opacity: '0'
    }
  });

  actorMap.pageChart1786ActorBgDecoration = player.createActor<DomImgActor>(ActorType.domImg, {
    name: 'bg-decoration' + pageKey,
    src: bgDecoration,
    defaultStyle: {
      backgroundSize: 'contain',
      width: '1100px',
      height: '200px',
      top: '550px',
      right: '0px',
      opacity: '0'
    }
  });
};
